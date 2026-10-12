// Shared List state for the Saved and Roommates tabs. One controller owns the provider calls and the realtime
// subscription; screens stay declarative. Per-Member Fit Scores live on each Saved Listing (fitScores) so Build 7's
// Group Fit reads them straight from state.
import type { Preferences, SavedListing } from "@/core/domain";
import { fitScore } from "@/core/scoring";
import { SharingError, type SharedList } from "@/core/sharing/provider";
import { parseInvite } from "@/core/sharing/invite";
import { KEYS, type Services } from "../services";
import { createStore, type Store } from "./store";

export type SharingStatus = { kind: "idle" } | { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

export interface SharingState {
  loaded: boolean;
  identityId: string | null;
  lists: SharedList[];
  currentListId: string | null;
  list: SharedList | null;
  saved: SavedListing[];
  /** Owner only: the current invite token, kept in chrome.storage.local so the Owner can copy it again later. */
  inviteToken: string | null;
  status: SharingStatus;
  connection: "online" | "offline";
  prefs: Preferences | null;
  /** The Saved Listing open in the detail screen, if any. */
  detailId: string | null;
  /** Last action outcome for inline feedback (join errors, copy confirmations). */
  notice: { tone: "success" | "danger" | "info"; text: string } | null;
}

export const initialSharingState: SharingState = {
  loaded: false,
  identityId: null,
  lists: [],
  currentListId: null,
  list: null,
  saved: [],
  inviteToken: null,
  status: { kind: "idle" },
  connection: "online",
  prefs: null,
  detailId: null,
  notice: null,
};

const INVITE_TOKENS_KEY = "mhm.inviteTokens";

export const DEFAULT_INVITE_BASE = "https://aabro1325.github.io/mustang-housing-match/join/";

function message(e: unknown): string {
  if (e instanceof SharingError) {
    switch (e.code) {
      case "unauthorized": return "That invitation link didn't work. Ask the list owner for a fresh one.";
      case "not-found": return "That list no longer exists.";
      case "duplicate": return "This listing is already on the list.";
      case "offline": return "You're offline. Changes will show once you're back online.";
      default: return e.message || "Something went wrong.";
    }
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export class SharingController {
  readonly store: Store<SharingState>;
  private unsubscribe: (() => void) | undefined;
  private scoreTimer: ReturnType<typeof setTimeout> | undefined;
  private stopOnline: (() => void) | undefined;

  constructor(
    private readonly services: Services,
    private readonly options: { scoreDebounceMs?: number; store?: Store<SharingState> } = {},
  ) {
    this.store = options.store ?? createStore(initialSharingState);
  }

  get state() {
    return this.store.get();
  }

  private patch(p: Partial<SharingState>) {
    this.store.set((s) => ({ ...s, ...p }));
  }

  async init(): Promise<void> {
    if (this.state.loaded) {
      await this.refresh();
      return;
    }
    this.patch({ status: { kind: "loading" } });
    try {
      const { id } = await this.services.sharing.identity();
      this.patch({ identityId: id });
    } catch (e) {
      this.patch({ loaded: true, status: { kind: "error", message: message(e) } });
      return;
    }
    await this.refresh();
    this.patch({ loaded: true });
    if (typeof globalThis.addEventListener === "function") {
      const online = () => { void this.reconnect(); };
      const offline = () => this.patch({ connection: "offline" });
      globalThis.addEventListener("online", online);
      globalThis.addEventListener("offline", offline);
      this.stopOnline = () => {
        globalThis.removeEventListener("online", online);
        globalThis.removeEventListener("offline", offline);
      };
    }
  }

  dispose() {
    this.unsubscribe?.();
    this.stopOnline?.();
    if (this.scoreTimer) clearTimeout(this.scoreTimer);
  }

  /** Reloads lists, the current list and its Saved Listings. Safe to call often; it is the realtime handler too. */
  async refresh(): Promise<void> {
    const sharing = this.services.sharing;
    try {
      const lists = await sharing.myLists();
      const storedId = await this.services.local.get<string>(KEYS.currentListId);
      const current = lists.find((l) => l.id === storedId) ?? lists[0] ?? null;
      if (current && current.id !== storedId) await this.services.local.set(KEYS.currentListId, current.id);
      if (!current) {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.patch({ lists, currentListId: null, list: null, saved: [], inviteToken: null, status: { kind: "ready" }, connection: "online", detailId: null });
        return;
      }
      const [list, saved, tokens] = await Promise.all([
        sharing.getList(current.id),
        sharing.listSavedListings(current.id),
        this.services.local.get<Record<string, string>>(INVITE_TOKENS_KEY),
      ]);
      const detailId = this.state.detailId && saved.some((s) => s.id === this.state.detailId) ? this.state.detailId : null;
      this.patch({
        lists, currentListId: current.id, list, saved, inviteToken: tokens?.[current.id] ?? null,
        status: { kind: "ready" }, connection: "online", detailId,
      });
      this.ensureSubscribed(current.id);
      this.scheduleScoreSync();
    } catch (e) {
      const offline = e instanceof SharingError && e.code === "offline";
      this.patch({ status: { kind: "error", message: message(e) }, connection: offline ? "offline" : this.state.connection });
    }
  }

  private subscribedTo: string | null = null;

  private ensureSubscribed(listId: string) {
    if (this.subscribedTo === listId) return;
    this.unsubscribe?.();
    this.subscribedTo = listId;
    this.unsubscribe = this.services.sharing.subscribe(listId, () => { void this.reloadSaved(listId); });
  }

  private async reloadSaved(listId: string) {
    if (this.state.currentListId !== listId) return;
    try {
      const [list, saved] = await Promise.all([this.services.sharing.getList(listId), this.services.sharing.listSavedListings(listId)]);
      if (this.state.currentListId !== listId) return;
      this.patch({ list, saved, connection: "online" });
      this.scheduleScoreSync();
    } catch {
      /* a failed reload keeps the last good state; the next change or refresh retries */
    }
  }

  /** Called when the connection comes back (window online, Amplify Hub Connected): re-query, since missed events are not replayed. */
  async reconnect(): Promise<void> {
    this.patch({ connection: "online" });
    await this.refresh();
  }

  private async rememberToken(listId: string, token: string) {
    const tokens = (await this.services.local.get<Record<string, string>>(INVITE_TOKENS_KEY)) ?? {};
    tokens[listId] = token;
    await this.services.local.set(INVITE_TOKENS_KEY, tokens);
  }

  async createList(name: string, displayName: string): Promise<void> {
    const n = name.trim();
    const d = displayName.trim();
    if (!n || !d) {
      this.patch({ notice: { tone: "danger", text: "Give the list a name and tell your roommates who you are." } });
      return;
    }
    this.patch({ status: { kind: "loading" }, notice: null });
    try {
      const { list, inviteToken } = await this.services.sharing.createList(n, d);
      await this.rememberToken(list.id, inviteToken);
      await this.services.local.set(KEYS.currentListId, list.id);
      await this.refresh();
      this.patch({ notice: { tone: "success", text: `Created ${list.name}. Copy the invitation link to bring your roommates in.` } });
    } catch (e) {
      this.patch({ status: { kind: "error", message: message(e) } });
    }
  }

  async joinFromInput(input: string, displayName: string): Promise<void> {
    const invite = parseInvite(input);
    const d = displayName.trim();
    if (!invite) {
      this.patch({ notice: { tone: "danger", text: "That doesn't look like an invitation link. Paste the whole link or the code your roommate sent." } });
      return;
    }
    if (!d) {
      this.patch({ notice: { tone: "danger", text: "Add your name so your roommates know who joined." } });
      return;
    }
    this.patch({ status: { kind: "loading" }, notice: null });
    try {
      const list = await this.services.sharing.joinList(invite.listId, invite.token, d);
      await this.services.local.set(KEYS.currentListId, list.id);
      await this.refresh();
      this.patch({ notice: { tone: "success", text: `You're in. ${list.name} is now your current list.` } });
    } catch (e) {
      this.patch({ status: { kind: "ready" }, notice: { tone: "danger", text: message(e) } });
    }
  }

  async switchList(listId: string): Promise<void> {
    await this.services.local.set(KEYS.currentListId, listId);
    this.patch({ detailId: null });
    await this.refresh();
  }

  async rotateInvite(): Promise<void> {
    const listId = this.state.currentListId;
    if (!listId) return;
    try {
      const token = await this.services.sharing.rotateInviteToken(listId);
      await this.rememberToken(listId, token);
      this.patch({ inviteToken: token, notice: { tone: "success", text: "New invitation link ready. Old links no longer work." } });
    } catch (e) {
      this.patch({ notice: { tone: "danger", text: message(e) } });
    }
  }

  async removeMember(memberId: string): Promise<void> {
    const listId = this.state.currentListId;
    if (!listId) return;
    try {
      await this.services.sharing.removeMember(listId, memberId);
      await this.reloadSaved(listId);
    } catch (e) {
      this.patch({ notice: { tone: "danger", text: message(e) } });
    }
  }

  async leave(): Promise<void> {
    const listId = this.state.currentListId;
    if (!listId) return;
    try {
      await this.services.sharing.leaveList(listId);
      await this.services.local.remove(KEYS.currentListId);
      this.subscribedTo = null;
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      await this.refresh();
      this.patch({ notice: { tone: "info", text: "You left the list." } });
    } catch (e) {
      this.patch({ notice: { tone: "danger", text: message(e) } });
    }
  }

  async removeSaved(savedListingId: string): Promise<void> {
    const listId = this.state.currentListId;
    if (!listId) return;
    try {
      await this.services.sharing.removeSavedListing(listId, savedListingId);
      if (this.state.detailId === savedListingId) this.patch({ detailId: null });
      await this.reloadSaved(listId);
    } catch (e) {
      this.patch({ notice: { tone: "danger", text: message(e) } });
    }
  }

  openDetail(savedListingId: string) {
    this.patch({ detailId: savedListingId });
  }

  closeDetail() {
    this.patch({ detailId: null });
  }

  clearNotice() {
    this.patch({ notice: null });
  }

  /** Preferences changed (or arrived): recompute this Member's Fit Score for every Saved Listing and write the ones that changed. */
  setPreferences(prefs: Preferences) {
    if (this.state.prefs === prefs) return;
    this.patch({ prefs });
    this.scheduleScoreSync();
  }

  private scheduleScoreSync() {
    if (this.scoreTimer) clearTimeout(this.scoreTimer);
    const ms = this.options.scoreDebounceMs ?? 300;
    this.scoreTimer = setTimeout(() => { void this.syncScores(); }, ms);
  }

  async syncScores(): Promise<void> {
    const { prefs, identityId, currentListId, saved } = this.state;
    if (!prefs || !identityId || !currentListId) return;
    const writes = saved
      .map((s) => ({ s, score: fitScore(s.listing.facts, s.commute, prefs).score }))
      .filter(({ s, score }) => s.fitScores[identityId]?.score !== score);
    if (writes.length === 0) return;
    try {
      for (const { s, score } of writes) await this.services.sharing.setFitScore(currentListId, s.id, score);
    } catch {
      /* scores are a convenience for Group Fit; the next change retries */
    }
  }
}
