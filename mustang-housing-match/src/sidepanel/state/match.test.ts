import { describe, it, expect, vi } from "vitest";
import { memoryStore } from "@/core/storage";
import { DEFAULT_PREFERENCES, emptyFacts, listed, type Commute, type Preferences } from "@/core/domain";
import { MAYA } from "@/core/fixtures";
import { fixtureCommuteProvider } from "@/providers/commute/fixture";
import { localSharingProvider } from "@/providers/sharing/local";
import type { RawCapture } from "@/capture/readers/types";
import type { CommuteProvider } from "@/core/commute/provider";
import type { Services } from "../services";
import { MatchController } from "./match";

function foothillCapture(): RawCapture {
  const facts = emptyFacts();
  facts.address = listed("870 Foothill Blvd, San Luis Obispo, CA 93405");
  facts.rent = listed(1250);
  facts.rentBasis = "per-person";
  facts.bedrooms = listed(3);
  facts.bathrooms = listed(2);
  facts.leaseType = listed("12-month");
  facts.amenities.parking = listed(true);
  facts.amenities.laundry = listed(true);
  return { url: "https://www.zillow.com/homedetails/870-foothill/1_zpid/", title: "870 Foothill Blvd", source: "zillow", kind: "home", facts, warnings: [] };
}

function fakeServices(over: Partial<Services> = {}, commute: CommuteProvider = fixtureCommuteProvider()): Services {
  const local = memoryStore();
  return {
    sync: memoryStore(),
    local,
    commute,
    sharing: localSharingProvider({ store: local, now: () => new Date("2026-10-12T10:00:00Z") }),
    tabs: {
      listingTab: async () => ({ id: 7, url: "https://www.zillow.com/homedetails/870-foothill/1_zpid/", title: "870 Foothill Blvd" }),
      onChange: () => () => {},
    },
    capture: async () => foothillCapture(),
    selectedText: async () => "",
    now: () => new Date("2026-10-12T10:00:00Z"),
    ...over,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("MatchController", () => {
  it("starts on Welcome when nothing is stored, then on Analyze once onboarded", async () => {
    const s = fakeServices();
    const c = new MatchController(s);
    await c.init();
    expect(c.state.screen).toBe("welcome");
    await c.skipWelcome();
    expect(c.state.screen).toBe("analyze");
    const again = new MatchController(s);
    await again.init();
    expect(again.state.screen).toBe("analyze");
    expect(again.state.page.status).toBe("supported");
  });

  it("captures, reviews, scores with a Commute, and recomputes on preference change without a lookup", async () => {
    const lookup = vi.fn(fixtureCommuteProvider().lookup);
    const c = new MatchController(fakeServices({}, { id: "spy", lookup }));
    await c.init();
    await c.analyze();
    expect(c.state.screen).toBe("review");
    expect(c.state.review?.facts.rent.value).toBe(1250);
    await c.confirmReview();
    expect(c.state.screen).toBe("scorecard");
    expect(c.state.commute.status).toBe("done");
    expect(lookup).toHaveBeenCalledTimes(1);
    const before = c.state.scorecard!.score;
    expect(before).toBeGreaterThan(0);
    await c.savePreferences({ ...MAYA, transportMode: "walk", maxCommuteMinutes: 5 });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(c.state.scorecard!.score).toBeLessThan(before);
    expect(c.state.screen).toBe("scorecard");
  });

  it("marks edited facts as Corrected and keeps them through scoring", async () => {
    const c = new MatchController(fakeServices());
    await c.init();
    await c.analyze();
    c.editFact("rent", { value: 1100, provenance: "Corrected" });
    c.editAmenity("utilitiesIncluded", true);
    await c.confirmReview();
    expect(c.state.listing!.facts.rent).toEqual({ value: 1100, provenance: "Corrected" });
    expect(c.state.listing!.facts.amenities.utilitiesIncluded.provenance).toBe("Corrected");
  });

  it("scores Commute 0 with the address-not-found Watch-out for an unknown address", async () => {
    const c = new MatchController(fakeServices());
    await c.init();
    await c.analyze();
    c.editFact("address", { value: "1 Nowhere Lane", provenance: "Corrected" });
    await c.confirmReview();
    expect(c.state.commute).toEqual({ status: "done", value: expect.objectContaining({ kind: "address-not-found" }) });
    expect(c.state.scorecard!.categories.commute.points).toBe(0);
    expect(c.state.scorecard!.watchOuts.map((w) => w.text)).toContain("Address could not be located; Commute not scored");
  });

  it("treats a thrown lookup as transient and retries on demand", async () => {
    let calls = 0;
    const flaky: CommuteProvider = {
      id: "flaky",
      lookup: async (a, o) => {
        calls += 1;
        if (calls === 1) throw new Error("network down");
        return fixtureCommuteProvider().lookup(a, o);
      },
    };
    const c = new MatchController(fakeServices({}, flaky));
    await c.init();
    await c.analyze();
    await c.confirmReview();
    expect(c.state.commute).toEqual({ status: "done", value: expect.objectContaining({ kind: "transient-failure" }) });
    expect(c.state.scorecard!.watchOuts.map((w) => w.text)).toContain("Commute lookup failed; retry");
    await c.lookupCommute();
    expect(c.state.commute).toEqual({ status: "done", value: expect.objectContaining({ kind: "ok" }) });
  });

  it("parses selected text into a Text Listing review and the manual form into a Manual Listing", async () => {
    const c = new MatchController(fakeServices({
      tabs: { listingTab: async () => ({ id: 3, url: "https://www.facebook.com/groups/calpolyhousing/posts/1/", title: "Post" }), onChange: () => () => {} },
      selectedText: async () => "Room in a 4 bed 2 bath house, $1,320 per person, school year lease, utilities included. 124 Hathway Ave",
    }));
    await c.init();
    expect(c.state.page).toMatchObject({ status: "unsupported", textListingHint: true });
    await c.analyzeSelectedText();
    expect(c.state.screen).toBe("review");
    expect(c.state.review?.source).toBe("text");
    expect(c.state.review?.facts.rent.value).toBe(1320);
    expect(c.state.review?.facts.rentBasis).toBe("per-person");
    c.startManual();
    expect(c.state.review?.mode).toBe("manual");
    expect(c.state.review?.facts.rent.value).toBeNull();
  });

  it("asks for text when nothing is selected or pasted", async () => {
    const c = new MatchController(fakeServices({ tabs: { listingTab: async () => ({ id: 3, url: "https://example.com/", title: "x" }), onChange: () => () => {} } }));
    await c.init();
    await c.analyzeSelectedText();
    expect(c.state.textError).toMatch(/Select the post text/);
    expect(c.state.screen).not.toBe("review");
  });

  it("saves to a default list on first save and reports a duplicate on the second", async () => {
    const c = new MatchController(fakeServices());
    await c.init();
    await c.analyze();
    await c.confirmReview();
    await c.saveListing();
    expect(c.state.save).toEqual({ status: "saved", listName: "My housing list", createdDefault: true });
    await c.saveListing();
    expect(c.state.save).toEqual({ status: "duplicate" });
    const lists = await c["services"].sharing.myLists();
    const saved = await c["services"].sharing.listSavedListings(lists[0]!.id);
    expect(saved).toHaveLength(1);
    expect(Object.values(saved[0]!.fitScores)[0]!.score).toBe(c.state.scorecard!.score);
    expect(saved[0]!.landlordQuestions.length).toBeGreaterThan(0);
  });

  it("picks a floor plan on multi-plan pages", async () => {
    const raw = foothillCapture();
    raw.floorPlans = [
      { id: "a", name: "1 bd / 1 ba · $2,100", facts: { rent: listed(2100), bedrooms: listed(1), bathrooms: listed(1) } },
      { id: "b", name: "2 bd / 2 ba · $2,900", facts: { rent: listed(2900), bedrooms: listed(2), bathrooms: listed(2) } },
    ];
    const c = new MatchController(fakeServices({ capture: async () => raw }));
    await c.init();
    await c.analyze();
    expect(c.state.review?.floorPlanId).toBe("a");
    expect(c.state.review?.facts.rent.value).toBe(2100);
    c.pickFloorPlan("b");
    expect(c.state.review?.facts.bedrooms.value).toBe(2);
    await c.confirmReview();
    expect(c.state.listing!.id).toMatch(/#plan=b$/);
  });

  it("ignores a stale lookup when the student has moved on", async () => {
    const resolvers: ((c: Commute) => void)[] = [];
    const slow: CommuteProvider = { id: "slow", lookup: () => new Promise<Commute>((r) => { resolvers.push(r); }) };
    const c = new MatchController(fakeServices({}, slow));
    await c.init();
    await c.analyze();
    const p1 = c.confirmReview();
    await flush();
    c.editDetails();
    c.editFact("address", { value: "1150 Chorro St", provenance: "Corrected" });
    const prefs: Preferences = { ...DEFAULT_PREFERENCES };
    c.previewPreferences(prefs);
    const p2 = c.confirmReview();
    resolvers[0]!({ kind: "address-not-found", referencePointVersion: 1 });
    await p1;
    expect(c.state.commute.status).toBe("loading");
    resolvers[1]!({ kind: "ok", origin: { lat: 0, lon: 0 }, modes: { walk: { kind: "not-available" }, bike: { kind: "not-available" }, bus: { kind: "not-available" }, car: { kind: "not-available" } }, transitDeparture: "", attribution: [], providerId: "slow", referencePointVersion: 1 });
    await p2;
    expect(c.state.commute).toMatchObject({ status: "done", value: { kind: "ok" } });
  });
});
