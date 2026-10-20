import { describe, it, expect } from "vitest";
import {
  amenitiesFraction, categoryMaxima, commuteFraction, costFraction, fitScore, leaseFraction, mainConcern, primaryBenefit,
} from "./scoring";
import { emptyFacts, listed, type Commute, type ListingFacts, type Preferences } from "./domain";
import { CHORRO, CHORRO_COMMUTE, FOOTHILL, FOOTHILL_COMMUTE, HATHWAY, HATHWAY_COMMUTE, MAYA } from "./fixtures";

describe("categoryMaxima", () => {
  it("normalises 3/2/1 weights to 100 with largest-remainder rounding", () => {
    // 33.33 / 33.33 / 22.22 / 11.11 → floors 33/33/22/11 = 99; the one leftover point goes to the largest
    // remainder, and the cost/commute tie breaks in category order.
    expect(categoryMaxima({ cost: "high", commute: "high", lease: "med", amenities: "low" })).toEqual({ cost: 34, commute: 33, lease: 22, amenities: 11 });
  });
  it("always sums to 100", () => {
    const levels = ["low", "med", "high"] as const;
    for (const c of levels) for (const m of levels) for (const l of levels) for (const a of levels) {
      const r = categoryMaxima({ cost: c, commute: m, lease: l, amenities: a });
      expect(r.cost + r.commute + r.lease + r.amenities).toBe(100);
    }
  });
  it("splits equal priorities evenly", () => {
    expect(categoryMaxima({ cost: "med", commute: "med", lease: "med", amenities: "med" })).toEqual({ cost: 25, commute: 25, lease: 25, amenities: 25 });
  });
});

describe("costFraction", () => {
  it("is 1 at or under budget, linear to 0 at 1.3×, 0.5 without a budget", () => {
    expect(costFraction(1400, 1450)).toBe(1);
    expect(costFraction(1450, 1450)).toBe(1);
    expect(costFraction(1450 * 1.15, 1450)).toBeCloseTo(0.5, 6);
    expect(costFraction(1450 * 1.3, 1450)).toBe(0);
    expect(costFraction(9999, 1450)).toBe(0);
    expect(costFraction(1400, null)).toBe(0.5);
    expect(costFraction(null, 1450)).toBe(0.5);
  });
});

function okCommute(minutes: Partial<Record<"walk" | "bike" | "bus" | "car", number | null>>): Commute {
  const mode = (m: number | null | undefined) => (m === null ? { kind: "not-available" as const } : { kind: "ok" as const, minutes: m ?? 10, miles: 1 });
  return {
    kind: "ok", origin: { lat: 0, lon: 0 },
    modes: { walk: mode(minutes.walk), bike: mode(minutes.bike), bus: mode(minutes.bus), car: mode(minutes.car) },
    transitDeparture: "2026-10-13T15:00:00.000Z", attribution: [], providerId: "test", referencePointVersion: 1,
  };
}

describe("commuteFraction", () => {
  const prefs: Preferences = { ...MAYA, transportMode: "bus", maxCommuteMinutes: 30 };
  it("uses the preferred mode: 1 within the limit, linear to 0 at double", () => {
    expect(commuteFraction(okCommute({ bus: 30 }), prefs)).toBe(1);
    expect(commuteFraction(okCommute({ bus: 45 }), prefs)).toBeCloseTo(0.5, 6);
    expect(commuteFraction(okCommute({ bus: 60 }), prefs)).toBe(0);
  });
  it("is 0 when the preferred mode is Not Available, the Commute failed, or there is none", () => {
    expect(commuteFraction(okCommute({ bus: null, bike: 5 }), prefs)).toBe(0);
    expect(commuteFraction({ kind: "address-not-found", referencePointVersion: 1 }, prefs)).toBe(0);
    expect(commuteFraction({ kind: "transient-failure", message: "x", referencePointVersion: 1 }, prefs)).toBe(0);
    expect(commuteFraction(null, prefs)).toBe(0);
  });
});

describe("leaseFraction", () => {
  const f = (lease: "school-year" | "12-month" | "month-to-month" | null): ListingFacts => {
    const x = emptyFacts();
    if (lease) x.leaseType = listed(lease);
    return x;
  };
  it("scores match 1, Not Listed 0.5, month-to-month 0.75, other mismatch 0.2", () => {
    expect(leaseFraction(f("school-year"), MAYA)).toBe(1);
    expect(leaseFraction(f(null), MAYA)).toBe(0.5);
    expect(leaseFraction(f("month-to-month"), MAYA)).toBe(0.75);
    expect(leaseFraction(f("month-to-month"), { ...MAYA, leaseType: "12-month" })).toBe(0.75);
    expect(leaseFraction(f("12-month"), MAYA)).toBe(0.2);
    expect(leaseFraction(f("school-year"), { ...MAYA, leaseType: "month-to-month" })).toBe(0.2);
  });
});

describe("amenitiesFraction", () => {
  it("averages present 1 / Not Listed 0.5 / absent 0 over wanted amenities; 1 when none wanted", () => {
    const f = emptyFacts();
    f.amenities.parking = listed(true);
    f.amenities.laundry = listed(false);
    // utilitiesIncluded Not Listed
    expect(amenitiesFraction(f, MAYA)).toBeCloseTo(0.5, 6);
    expect(amenitiesFraction(f, { ...MAYA, wantedAmenities: [] })).toBe(1);
  });
});

describe("fitScore", () => {
  it("is deterministic and integer in 0..100", () => {
    const a = fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA);
    const b = fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA);
    expect(a).toEqual(b);
    expect(Number.isInteger(a.score)).toBe(true);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it("reproduces the golden scores for the Figma demo listings under Maya's preferences", () => {
    // The Figma shows 84 / 91 / 68; those numbers are illustrative. The rubric (issue #11) yields these:
    expect(fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA).score).toBe(81);
    expect(fitScore(HATHWAY.facts, HATHWAY_COMMUTE, MAYA).score).toBe(100);
    expect(fitScore(CHORRO.facts, CHORRO_COMMUTE, MAYA).score).toBe(78);
  });

  it("explains Foothill: under budget, short bike ride, 12-month lease watch-out", () => {
    const r = fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA);
    expect(r.estimatedMonthlyTotal).toBe(1393.33);
    expect(r.categories.cost).toMatchObject({ points: 34, max: 34, fraction: 1 });
    expect(r.categories.commute).toMatchObject({ points: 33, max: 33, fraction: 1 });
    expect(r.categories.lease.fraction).toBe(0.2);
    expect(r.benefits.map((b) => b.text)).toEqual([
      "Estimated monthly total is $57 under your $1,450 budget",
      "Bike commute is 9 min, within your 15 min limit",
      "Parking and laundry match what you want",
    ]);
    expect(r.watchOuts.map((w) => w.text)).toEqual(["12-month lease; you prefer school-year; summer months usually mean subleasing"]);
    expect(primaryBenefit(r)).toBe("Estimated monthly total is $57 under your $1,450 budget");
    expect(mainConcern(r)).toBe("12-month lease; you prefer school-year; summer months usually mean subleasing");
  });

  it("ranks insights by points and caps them at three", () => {
    const prefs: Preferences = { ...MAYA, budget: 900, transportMode: "walk", maxCommuteMinutes: 10, leaseType: "school-year", wantedAmenities: ["pets", "furnished", "utilitiesIncluded"] };
    const f = emptyFacts();
    f.rent = listed(1500); f.rentBasis = "per-person"; f.bedrooms = listed(2); f.bathrooms = listed(1);
    f.leaseType = listed("12-month");
    f.amenities.pets = listed(false); f.amenities.furnished = listed(false); f.amenities.utilitiesIncluded = listed(false);
    f.deposit = listed(10000);
    const r = fitScore(f, okCommute({ walk: 40 }), prefs);
    expect(r.score).toBe(4); // only the lease mismatch's 0.2 × 22 survives
    expect(r.watchOuts).toHaveLength(3);
    expect(r.watchOuts[0]!.points).toBeGreaterThanOrEqual(r.watchOuts[1]!.points);
    expect(r.watchOuts[1]!.points).toBeGreaterThanOrEqual(r.watchOuts[2]!.points);
    expect(r.watchOuts.map((w) => w.category)).toEqual(["cost", "commute", "lease"]);
    expect(r.benefits).toEqual([]);
  });

  it("emits the commute failure watch-outs from issue #9 instead of a generic one", () => {
    const notFound = fitScore(FOOTHILL.facts, { kind: "address-not-found", referencePointVersion: 1 }, MAYA);
    expect(notFound.categories.commute.points).toBe(0);
    expect(notFound.watchOuts.map((w) => w.text)).toContain("Address could not be located; Commute not scored");
    expect(notFound.watchOuts.filter((w) => w.category === "commute")).toEqual([]);

    const transient = fitScore(FOOTHILL.facts, { kind: "transient-failure", message: "429", referencePointVersion: 1 }, MAYA);
    expect(transient.watchOuts.map((w) => w.text)).toContain("Commute lookup failed; retry");

    const noBus = fitScore(FOOTHILL.facts, okCommute({ bus: null, bike: 9 }), { ...MAYA, transportMode: "bus" });
    expect(noBus.watchOuts.map((w) => w.text)).toContain("No bus route found for a weekday 8 AM departure");
    expect(noBus.categories.commute.points).toBe(0);
  });

  it("flags Not Listed lease and oversized deposits", () => {
    const f = emptyFacts();
    f.rent = listed(3000); f.bedrooms = listed(3); f.bathrooms = listed(2);
    f.deposit = listed(5000);
    const r = fitScore(f, FOOTHILL_COMMUTE, MAYA);
    expect(r.categories.lease.fraction).toBe(0.5);
    const texts = r.watchOuts.map((w) => w.text);
    expect(texts).toContain("Lease length not listed; confirm the term before applying");
    expect(texts).toContain("Deposit of $5,000 is over 1.5× the monthly rent; California caps deposits at one month");
  });

  it("re-normalizes without Commute in alpha so a missing commute does not lower the score", () => {
    expect(categoryMaxima(MAYA.priorities, "alpha")).toEqual({ cost: 50, commute: 0, lease: 33, amenities: 17 });
    const levels = ["low", "med", "high"] as const;
    for (const c of levels) for (const l of levels) for (const a of levels) {
      const r = categoryMaxima({ cost: c, commute: "high", lease: l, amenities: a }, "alpha");
      expect(r.commute).toBe(0);
      expect(r.cost + r.lease + r.amenities).toBe(100);
    }

    const withCommute = fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA, "alpha");
    const missing = fitScore(FOOTHILL.facts, { kind: "address-not-found", referencePointVersion: 1 }, MAYA, "alpha");
    expect(withCommute.score).toBe(missing.score);
    expect(withCommute.score).toBe(71);
    expect(missing.categories.commute).toMatchObject({ points: 0, max: 0 });
    expect(missing.benefits.map((b) => b.category)).not.toContain("commute");
    expect(missing.watchOuts.map((w) => w.category)).not.toContain("commute-failure");
    expect(missing.watchOuts.map((w) => w.text).join(" ")).not.toMatch(/commute/i);

    const fullMissing = fitScore(FOOTHILL.facts, { kind: "address-not-found", referencePointVersion: 1 }, MAYA);
    expect(fullMissing.score).toBeLessThan(fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA).score);
    expect(missing.score).toBeGreaterThan(fullMissing.score);

    const cheaper = fitScore(FOOTHILL.facts, null, { ...MAYA, budget: 2000 }, "alpha");
    const tighter = fitScore(FOOTHILL.facts, null, { ...MAYA, budget: 500 }, "alpha");
    expect(cheaper.score).toBeGreaterThan(tighter.score);

    const deposit = emptyFacts();
    deposit.rent = listed(3000);
    deposit.bedrooms = listed(3);
    deposit.bathrooms = listed(2);
    deposit.deposit = listed(5000);
    const alphaDeposit = fitScore(deposit, null, MAYA, "alpha");
    expect(alphaDeposit.watchOuts.map((w) => w.category)).not.toContain("deposit");
    expect(alphaDeposit.watchOuts.map((w) => w.text)).toContain("Lease length not listed; confirm the term before applying");
  });

  it("gives no insight when there is no Commute yet or no budget", () => {
    const r = fitScore(FOOTHILL.facts, null, { ...MAYA, budget: null });
    expect(r.categories.cost.fraction).toBe(0.5);
    expect(r.categories.commute.points).toBe(0);
    expect(r.benefits.map((b) => b.category)).not.toContain("cost");
    expect(r.watchOuts.map((w) => w.category)).not.toContain("commute");
    expect(r.watchOuts.map((w) => w.category)).not.toContain("commute-failure");
  });
});
