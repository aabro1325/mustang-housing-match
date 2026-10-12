import type { Commute, Listing, Note, SavedListing } from "@/core/domain";
import type { KeyValueStore } from "@/core/storage";
import { SharingError, type ListChange, type Member, type SavedListingPatch, type SharedList, type SharingProvider } from "@/core/sharing/provider";
import { randomToken } from "@/core/sharing/invite";

interface LocalState {
  identityId: string;
  lists: Record<string, { list: SharedList; inviteToken: string; saved: Record<string, SavedListing> }>;
}

const KEY = "mhm.sharing.local";

export interface LocalDeps {
  store: KeyValueStore;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Single-Member Shared Lists kept in a key-value store. Used in tests, in the fixture demo, and whenever the
 * build has no AppSync endpoint. Invitation Links "work" only within this browser profile.
 */
export function localSharingProvider(deps: LocalDeps): SharingProvider {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => globalThis.crypto.randomUUID());
  const listeners = new Map<string, Set<(c: ListChange) => void>>();

  async function load(): Promise<LocalState> {
    const s = await deps.store.get<LocalState>(KEY);
    if (s) return s;
    const fresh: LocalState = { identityId: "local-" + newId(), lists: {} };
    await deps.store.set(KEY, fresh);
    return fresh;
  }
  async function save(s: LocalState) {
    await deps.store.set(KEY, s);
  }
  function emit(listId: string, change: Omit<ListChange, "listId" | "at" | "actorId">, actorId: string) {
    const c: ListChange = { listId, actorId, at: now().toISOString(), ...change };
    for (const l of listeners.get(listId) ?? []) l(c);
  }
  function entry(s: LocalState, listId: string) {
    const e = s.lists[listId];
    if (!e) throw new SharingError("not-found", "No such list");
    if (!e.list.members.some((m) => m.id === s.identityId)) throw new SharingError("unauthorized");
    return e;
  }
  function savedOf(e: LocalState["lists"][string], id: string) {
    const sl = e.saved[id];
    if (!sl) throw new SharingError("not-found", "No such saved listing");
    return sl;
  }

  return {
    id: "local",
    async identity() {
      return { id: (await load()).identityId };
    },
    async myLists() {
      const s = await load();
      return Object.values(s.lists).filter((e) => e.list.members.some((m) => m.id === s.identityId)).map((e) => e.list);
    },
    async createList(name, displayName) {
      const s = await load();
      const at = now().toISOString();
      const id = newId();
      const owner: Member = { id: s.identityId, displayName, role: "owner", joinedAt: at };
      const list: SharedList = { id, name, ownerId: s.identityId, createdAt: at, members: [owner] };
      const inviteToken = randomToken();
      s.lists[id] = { list, inviteToken, saved: {} };
      await save(s);
      return { list, inviteToken };
    },
    async joinList(listId, inviteToken, displayName) {
      const s = await load();
      const e = s.lists[listId];
      if (!e || e.inviteToken !== inviteToken) throw new SharingError("unauthorized", "Invalid invitation link");
      if (!e.list.members.some((m) => m.id === s.identityId)) {
        e.list.members.push({ id: s.identityId, displayName, role: "member", joinedAt: now().toISOString() });
        await save(s);
        emit(listId, { kind: "membership" }, s.identityId);
      }
      return e.list;
    },
    async getList(listId) {
      return entry(await load(), listId).list;
    },
    async rotateInviteToken(listId) {
      const s = await load();
      const e = entry(s, listId);
      if (e.list.ownerId !== s.identityId) throw new SharingError("unauthorized", "Only the owner can rotate the link");
      e.inviteToken = randomToken();
      await save(s);
      return e.inviteToken;
    },
    async removeMember(listId, memberId) {
      const s = await load();
      const e = entry(s, listId);
      if (e.list.ownerId !== s.identityId) throw new SharingError("unauthorized", "Only the owner can remove members");
      if (memberId === e.list.ownerId) throw new SharingError("unauthorized", "The owner cannot be removed");
      e.list.members = e.list.members.filter((m) => m.id !== memberId);
      await save(s);
      emit(listId, { kind: "membership" }, s.identityId);
    },
    async leaveList(listId) {
      const s = await load();
      const e = entry(s, listId);
      e.list.members = e.list.members.filter((m) => m.id !== s.identityId);
      if (e.list.members.length === 0) delete s.lists[listId];
      await save(s);
    },
    async listSavedListings(listId) {
      const e = entry(await load(), listId);
      return Object.values(e.saved).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async addSavedListing(listId, listing: Listing, commute: Commute | null, landlordQuestions) {
      const s = await load();
      const e = entry(s, listId);
      if (Object.values(e.saved).some((sl) => sl.listing.id === listing.id)) throw new SharingError("duplicate", "Already on the list");
      const at = now().toISOString();
      const sl: SavedListing = {
        id: newId(), listing, commute, status: "saved", finalist: false, tourAt: null, landlordQuestions,
        notes: [], fitScores: {}, addedBy: s.identityId, createdAt: at, updatedAt: at, version: 1,
      };
      e.saved[sl.id] = sl;
      await save(s);
      emit(listId, { kind: "saved-listing", savedListingId: sl.id }, s.identityId);
      return sl;
    },
    async updateSavedListing(listId, savedListingId, patch: SavedListingPatch) {
      const s = await load();
      const e = entry(s, listId);
      const sl = savedOf(e, savedListingId);
      if (patch.facts) sl.listing = { ...sl.listing, facts: patch.facts };
      if (patch.status !== undefined) sl.status = patch.status;
      if (patch.finalist !== undefined) sl.finalist = patch.finalist;
      if (patch.tourAt !== undefined) sl.tourAt = patch.tourAt;
      if (patch.landlordQuestions !== undefined) sl.landlordQuestions = patch.landlordQuestions;
      if (patch.commute !== undefined) sl.commute = patch.commute;
      if (patch.status === "selected") {
        for (const other of Object.values(e.saved)) if (other.id !== sl.id && other.status === "selected") other.status = "considering";
      }
      sl.updatedAt = now().toISOString();
      sl.version += 1;
      await save(s);
      emit(listId, { kind: "saved-listing", savedListingId }, s.identityId);
      return sl;
    },
    async removeSavedListing(listId, savedListingId) {
      const s = await load();
      const e = entry(s, listId);
      delete e.saved[savedListingId];
      await save(s);
      emit(listId, { kind: "saved-listing", savedListingId }, s.identityId);
    },
    async addNote(listId, savedListingId, text) {
      const s = await load();
      const e = entry(s, listId);
      const sl = savedOf(e, savedListingId);
      const me = e.list.members.find((m) => m.id === s.identityId);
      const note: Note = { id: newId(), authorId: s.identityId, authorName: me?.displayName ?? "You", text, createdAt: now().toISOString() };
      sl.notes.push(note);
      await save(s);
      emit(listId, { kind: "note", savedListingId }, s.identityId);
      return note;
    },
    async setFitScore(listId, savedListingId, score) {
      const s = await load();
      const e = entry(s, listId);
      const sl = savedOf(e, savedListingId);
      sl.fitScores[s.identityId] = { score, computedAt: now().toISOString() };
      await save(s);
      emit(listId, { kind: "fit-score", savedListingId }, s.identityId);
    },
    subscribe(listId, onChange) {
      let set = listeners.get(listId);
      if (!set) listeners.set(listId, (set = new Set()));
      set.add(onChange);
      return () => { set!.delete(onChange); };
    },
  };
}
