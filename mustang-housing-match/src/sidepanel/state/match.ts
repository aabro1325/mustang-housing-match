// The Match tab flow: Welcome → Preferences → Analyze → Review → Scorecard, with Save.
// All state lives in one store; the controller owns every side effect so screens stay declarative.
import {
  DEFAULT_PREFERENCES, emptyFacts, listed, corrected, type Commute, type Fact, type FloorPlan, type Listing, type ListingFacts,
  type Preferences, type RentBasis, type SourceId,
} from "@/core/domain";
import { releaseScope, type ReleaseScope } from "@/core/release";
import { fitScore, type FitScoreResult } from "@/core/scoring";
import { landlordQuestions } from "@/core/cost";
import { listingIdentity } from "@/core/address";
import { detectSource, isTextListingPage, type DetectedSource } from "@/core/supportedPage";
import { parseTextListing } from "@/core/textListing";
import { SharingError } from "@/core/sharing/provider";
import type { RawCapture } from "@/capture/readers/types";
import { KEYS, type Services } from "../services";
import { createStore, type Store } from "./store";

export type Screen = "welcome" | "preferences" | "analyze" | "review" | "scorecard";

export type PageState =
  | { status: "unknown" }
  | { status: "supported"; tabId: number; url: string; title: string; detected: DetectedSource }
  | { status: "unsupported"; tabId: number | null; url: string | null; title: string; textListingHint: boolean };

export type ReviewMode = "captured" | "text" | "manual";

export interface ReviewDraft {
  mode: ReviewMode;
  source: SourceId;
  sourceUrl: string | null;
  title: string;
  facts: ListingFacts;
  floorPlans: FloorPlan[];
  floorPlanId: string | null;
  warnings: string[];
  /** Facts as captured, before the student touched anything; restores on floor plan switch. */
  captured: ListingFacts;
}

export type CommuteState = { status: "idle" } | { status: "loading" } | { status: "done"; value: Commute };

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; listName: string; createdDefault: boolean }
  | { status: "duplicate" }
  | { status: "error"; message: string };

export interface MatchState {
  loaded: boolean;
  prefs: Preferences;
  onboarded: boolean;
  screen: Screen;
  page: PageState;
  capture: { status: "idle" } | { status: "capturing" } | { status: "error"; message: string };
  textInput: string;
  textError: string | null;
  review: ReviewDraft | null;
  listing: Listing | null;
  commute: CommuteState;
  scorecard: FitScoreResult | null;
  save: SaveState;
}

export const initialMatchState: MatchState = {
  loaded: false,
  prefs: DEFAULT_PREFERENCES,
  onboarded: false,
  screen: "welcome",
  page: { status: "unknown" },
  capture: { status: "idle" },
  textInput: "",
  textError: null,
  review: null,
  listing: null,
  commute: { status: "idle" },
  scorecard: null,
  save: { status: "idle" },
};

export const SOURCE_LABEL: Record<SourceId, string> = {
  zillow: "Zillow", craigslist: "Craigslist", apartments: "Apartments.com", text: "Text listing", manual: "Manual listing",
};

export const UNSUPPORTED_TEXT =
  "This page isn't a supported listing. Supported: Zillow, Craigslist, Apartments.com. You can add this listing manually or paste the post text.";

function applyFloorPlan(base: ListingFacts, plan: FloorPlan | undefined): ListingFacts {
  if (!plan) return base;
  return { ...base, ...plan.facts } as ListingFacts;
}

export class MatchController {
  readonly store: Store<MatchState>;
  private stopTabs: (() => void) | undefined;

  constructor(private readonly services: Services, store?: Store<MatchState>, private readonly scope: ReleaseScope = releaseScope()) {
    this.store = store ?? createStore(initialMatchState);
  }

  private patch(p: Partial<MatchState>) {
    this.store.set((s) => ({ ...s, ...p }));
  }

  get state() {
    return this.store.get();
  }

  async init(): Promise<void> {
    const [prefs, onboarded] = await Promise.all([
      this.services.sync.get<Preferences>(KEYS.preferences),
      this.services.sync.get<boolean>(KEYS.onboarded),
    ]);
    const hasPrefs = !!prefs;
    this.patch({
      loaded: true,
      prefs: prefs ? { ...DEFAULT_PREFERENCES, ...prefs } : DEFAULT_PREFERENCES,
      onboarded: !!onboarded || hasPrefs,
      screen: !!onboarded || hasPrefs ? "analyze" : "welcome",
    });
    await this.refreshPage();
    this.stopTabs = this.services.tabs.onChange(() => { void this.refreshPage(); });
  }

  dispose() {
    this.stopTabs?.();
  }

  go(screen: Screen) {
    this.patch({ screen });
  }

  async skipWelcome() {
    await this.services.sync.set(KEYS.onboarded, true);
    this.patch({ onboarded: true, screen: "analyze" });
  }

  async savePreferences(prefs: Preferences) {
    await Promise.all([this.services.sync.set(KEYS.preferences, prefs), this.services.sync.set(KEYS.onboarded, true)]);
    this.patch({ prefs, onboarded: true, screen: this.state.listing ? "scorecard" : "analyze" });
    this.recompute();
  }

  /** Preference edits recompute the Scorecard immediately from the stored Commute; nothing is fetched. */
  previewPreferences(prefs: Preferences) {
    this.patch({ prefs });
    this.recompute();
  }

  async refreshPage() {
    const tab = await this.services.tabs.listingTab();
    if (!tab || !tab.url) {
      this.patch({ page: { status: "unsupported", tabId: tab?.id ?? null, url: null, title: tab?.title ?? "", textListingHint: false } });
      return;
    }
    const detected = detectSource(tab.url);
    if (detected) this.patch({ page: { status: "supported", tabId: tab.id, url: tab.url, title: tab.title ?? "", detected } });
    else this.patch({ page: { status: "unsupported", tabId: tab.id, url: tab.url, title: tab.title ?? "", textListingHint: isTextListingPage(tab.url) } });
  }

  async analyze() {
    const page = this.state.page;
    if (page.status !== "supported") return;
    this.patch({ capture: { status: "capturing" } });
    let raw: RawCapture;
    try {
      raw = await this.services.capture(page.tabId);
    } catch (e) {
      this.patch({ capture: { status: "error", message: e instanceof Error ? e.message : "Capture failed" } });
      return;
    }
    if (raw.source === "unsupported" || !raw.facts) {
      this.patch({ capture: { status: "error", message: raw.warnings[0] ?? "Nothing could be read from this page" } });
      return;
    }
    const floorPlans = raw.floorPlans ?? [];
    const first = floorPlans[0];
    const facts = floorPlans.length > 1 ? applyFloorPlan(raw.facts, first) : raw.facts;
    this.patch({
      capture: { status: "idle" },
      review: {
        mode: "captured", source: raw.source, sourceUrl: raw.url, title: raw.title, facts, captured: raw.facts,
        floorPlans, floorPlanId: floorPlans.length > 1 && first ? first.id : null, warnings: raw.warnings,
      },
      screen: "review",
      save: { status: "idle" },
    });
  }

  async analyzeSelectedText() {
    const page = this.state.page;
    let text = this.state.textInput.trim();
    if (!text && page.status !== "unknown" && page.tabId !== null) {
      try {
        text = (await this.services.selectedText(page.tabId)).trim();
      } catch {
        text = "";
      }
    }
    if (!text) {
      this.patch({ textError: "Select the post text on the page first, or paste it below." });
      return;
    }
    this.analyzeText(text, page.status !== "unknown" ? page.url : null);
  }

  analyzeText(text: string, sourceUrl: string | null) {
    const parsed = parseTextListing(text);
    this.patch({
      textError: null,
      review: {
        mode: "text", source: "text", sourceUrl, title: parsed.facts.address.value ?? "Text listing",
        facts: parsed.facts, captured: parsed.facts, floorPlans: [], floorPlanId: null, warnings: parsed.warnings,
      },
      screen: "review",
      save: { status: "idle" },
    });
  }

  setTextInput(textInput: string) {
    this.patch({ textInput, textError: null });
  }

  startManual() {
    const facts = emptyFacts();
    this.patch({
      review: { mode: "manual", source: "manual", sourceUrl: null, title: "Manual listing", facts, captured: facts, floorPlans: [], floorPlanId: null, warnings: [] },
      screen: "review",
      save: { status: "idle" },
    });
  }

  /** Edits a fact in the Review draft; a changed value becomes Corrected, clearing it becomes Not Listed. */
  editFact<K extends keyof ListingFacts>(key: K, value: ListingFacts[K]) {
    const review = this.state.review;
    if (!review) return;
    this.patch({ review: { ...review, facts: { ...review.facts, [key]: value } } });
  }

  editAmenity(id: keyof ListingFacts["amenities"], value: boolean | null) {
    const review = this.state.review;
    if (!review) return;
    const fact: Fact<boolean> = value === null ? { value: null, provenance: "NotListed" } : corrected(value);
    this.patch({ review: { ...review, facts: { ...review.facts, amenities: { ...review.facts.amenities, [id]: fact } } } });
  }

  setRentBasis(rentBasis: RentBasis) {
    const review = this.state.review;
    if (!review) return;
    this.patch({ review: { ...review, facts: { ...review.facts, rentBasis } } });
  }

  pickFloorPlan(floorPlanId: string) {
    const review = this.state.review;
    if (!review) return;
    const plan = review.floorPlans.find((p) => p.id === floorPlanId);
    this.patch({ review: { ...review, floorPlanId, facts: applyFloorPlan(review.captured, plan) } });
  }

  /** Builds the Listing from the Review draft and looks up its Commute. */
  async confirmReview(): Promise<void> {
    const review = this.state.review;
    if (!review) return;
    const address = review.facts.address.value?.trim() ?? "";
    const listing: Listing = {
      id: listingIdentity({ source: review.source, sourceUrl: review.sourceUrl, floorPlanId: review.floorPlanId, address: address || null }),
      source: review.source,
      sourceUrl: review.sourceUrl,
      floorPlanId: review.floorPlanId,
      title: address || review.title,
      facts: review.facts,
      capturedAt: this.services.now().toISOString(),
    };
    this.patch({ listing, screen: "scorecard", commute: { status: "idle" }, save: { status: "idle" } });
    this.recompute();
    // Alpha does not show or score Commute, so it does not look one up.
    if (this.scope !== "alpha") await this.lookupCommute();
  }

  async lookupCommute(): Promise<void> {
    const listing = this.state.listing;
    if (!listing) return;
    const address = listing.facts.address.value?.trim();
    if (!address) {
      this.patch({ commute: { status: "done", value: { kind: "address-not-found", referencePointVersion: 1 } } });
      this.recompute();
      return;
    }
    this.patch({ commute: { status: "loading" } });
    let value: Commute;
    try {
      value = await this.services.commute.lookup(address, { now: this.services.now() });
    } catch (e) {
      value = { kind: "transient-failure", message: e instanceof Error ? e.message : "Lookup failed", referencePointVersion: 1 };
    }
    if (this.state.listing !== listing) return; // the student moved on
    this.patch({ commute: { status: "done", value } });
    this.recompute();
  }

  editDetails() {
    const { listing, review } = this.state;
    if (!listing) return;
    this.patch({ review: review ? { ...review, facts: listing.facts } : null, screen: "review" });
  }

  recompute() {
    const { listing, prefs, commute } = this.state;
    if (!listing) {
      this.patch({ scorecard: null });
      return;
    }
    const c = commute.status === "done" ? commute.value : null;
    this.patch({ scorecard: fitScore(listing.facts, c, prefs, this.scope) });
  }

  async saveListing(): Promise<void> {
    const { listing, scorecard, commute } = this.state;
    if (!listing || !scorecard) return;
    this.patch({ save: { status: "saving" } });
    const sharing = this.services.sharing;
    try {
      let listId = await this.services.local.get<string>(KEYS.currentListId);
      let listName = "";
      let createdDefault = false;
      const lists = await sharing.myLists();
      const current = lists.find((l) => l.id === listId) ?? lists[0];
      if (current) {
        listId = current.id;
        listName = current.name;
      } else {
        const created = await sharing.createList("My housing list", "Me");
        listId = created.list.id;
        listName = created.list.name;
        createdDefault = true;
        // Keep the Owner's invite token where the Roommates tab looks for it (same key as SharingController).
        const tokens = (await this.services.local.get<Record<string, string>>("mhm.inviteTokens")) ?? {};
        tokens[listId] = created.inviteToken;
        await this.services.local.set("mhm.inviteTokens", tokens);
      }
      await this.services.local.set(KEYS.currentListId, listId);
      const questions = landlordQuestions(listing.facts, scorecard.breakdown);
      const saved = await sharing.addSavedListing(listId, listing, commute.status === "done" ? commute.value : null, questions);
      await sharing.setFitScore(listId, saved.id, scorecard.score);
      this.patch({ save: { status: "saved", listName, createdDefault } });
    } catch (e) {
      if (e instanceof SharingError && e.code === "duplicate") this.patch({ save: { status: "duplicate" } });
      else this.patch({ save: { status: "error", message: e instanceof Error ? e.message : "Could not save" } });
    }
  }

  /** Back to the Analyze screen, keeping the last Scorecard reachable. */
  analyzeAnother() {
    this.patch({ screen: "analyze", capture: { status: "idle" }, textInput: "", textError: null });
  }
}

export { listed };
