import { describe, it, expect } from "vitest";
import { costBreakdown, estimatedMonthlyTotal, landlordQuestions, perPersonRent, unitRent, QUESTIONS } from "./cost";
import { DEFAULT_PREFERENCES, emptyFacts, listed, corrected, type ListingFacts, type Preferences } from "./domain";

const prefs: Preferences = { ...DEFAULT_PREFERENCES, roomType: "private" };

function facts(over: Partial<ListingFacts> = {}): ListingFacts {
  return { ...emptyFacts(), ...over };
}
const line = (b: ReturnType<typeof costBreakdown>, id: string) => b.items.find((i) => i.id === id)!;

describe("perPersonRent", () => {
  it("divides unit rent by bedrooms on the per-unit basis", () => {
    const f = facts({ rent: listed(3600), bedrooms: listed(3) });
    expect(perPersonRent(f, prefs)).toEqual({ amount: 1200, provenance: "Listed" });
  });
  it("uses the listed figure on the per-person basis", () => {
    const f = facts({ rent: listed(1250), rentBasis: "per-person", bedrooms: listed(3) });
    expect(perPersonRent(f, prefs)).toEqual({ amount: 1250, provenance: "Listed" });
  });
  it("halves the share for a shared room", () => {
    const f = facts({ rent: listed(1250), rentBasis: "per-person" });
    expect(perPersonRent(f, { ...prefs, roomType: "shared" }).amount).toBe(625);
  });
  it("marks the share Estimated when bedrooms are Not Listed on the per-unit basis", () => {
    const f = facts({ rent: listed(2000) });
    expect(perPersonRent(f, prefs)).toEqual({ amount: 2000, provenance: "Estimated" });
  });
  it("keeps Corrected provenance", () => {
    const f = facts({ rent: corrected(3000), bedrooms: listed(3) });
    expect(perPersonRent(f, prefs).provenance).toBe("Corrected");
  });
  it("is Not Listed when rent is", () => {
    expect(perPersonRent(facts(), prefs)).toEqual({ amount: null, provenance: "NotListed" });
  });
});

describe("unitRent", () => {
  it("multiplies per-person rent by bedrooms", () => {
    expect(unitRent(facts({ rent: listed(1250), rentBasis: "per-person", bedrooms: listed(3) }))).toBe(3750);
    expect(unitRent(facts({ rent: listed(3750), bedrooms: listed(3) }))).toBe(3750);
    expect(unitRent(facts())).toBeNull();
  });
});

describe("costBreakdown", () => {
  it("applies the SLO Estimate formulas for a 4-bedroom house with nothing included", () => {
    const f = facts({ rent: listed(4800), bedrooms: listed(4) });
    const b = costBreakdown(f, prefs);
    expect(line(b, "rent")).toMatchObject({ amount: 1200, provenance: "Listed", recurring: true });
    expect(line(b, "electricityGas")).toMatchObject({ amount: 56.25, provenance: "Estimated" });
    expect(line(b, "waterSewerTrash")).toMatchObject({ amount: 57.5, provenance: "Estimated" });
    expect(line(b, "internet")).toMatchObject({ amount: 10, provenance: "Estimated" });
    expect(line(b, "parking")).toMatchObject({ amount: null, provenance: "NotListed" });
    expect(line(b, "otherFees")).toMatchObject({ amount: null, provenance: "NotListed" });
    expect(line(b, "deposit")).toMatchObject({ amount: 1200, provenance: "Estimated", recurring: false });
    expect(line(b, "applicationFee")).toMatchObject({ amount: 66, provenance: "Estimated", recurring: false });
  });
  it("zeroes utilities when they are included, and keeps the internet Estimate", () => {
    const f = facts({ rent: listed(1320), rentBasis: "per-person", bedrooms: listed(4) });
    f.amenities.utilitiesIncluded = listed(true);
    const b = costBreakdown(f, prefs);
    expect(line(b, "electricityGas")).toMatchObject({ amount: 0, provenance: "Listed" });
    expect(line(b, "waterSewerTrash")).toMatchObject({ amount: 0, provenance: "Listed" });
    expect(line(b, "internet").amount).toBe(10);
  });
  it("uses a listed parking fee, else $0 with parking listed, else Not Listed", () => {
    const withFee = facts({ rent: listed(1000), rentBasis: "per-person", bedrooms: listed(2), parkingFee: listed(60) });
    expect(line(costBreakdown(withFee, prefs), "parking")).toMatchObject({ amount: 60, provenance: "Listed" });
    const withParking = facts({ rent: listed(1000), rentBasis: "per-person", bedrooms: listed(2) });
    withParking.amenities.parking = listed(true);
    expect(line(costBreakdown(withParking, prefs), "parking")).toMatchObject({ amount: 0, provenance: "Listed" });
  });
  it("shares a listed per-unit deposit across bedrooms and passes per-person deposits through", () => {
    const perUnit = facts({ rent: listed(3000), bedrooms: listed(3), deposit: listed(3000) });
    expect(line(costBreakdown(perUnit, prefs), "deposit")).toMatchObject({ amount: 1000, provenance: "Listed" });
    const perPerson = facts({ rent: listed(1000), rentBasis: "per-person", bedrooms: listed(3), deposit: listed(1500) });
    expect(line(costBreakdown(perPerson, prefs), "deposit")).toMatchObject({ amount: 1500, provenance: "Listed" });
  });
  it("treats Not Listed bedrooms as 1 and says so", () => {
    const b = costBreakdown(facts({ rent: listed(1500) }), prefs);
    expect(b.bedrooms).toBe(1);
    expect(b.bedroomsEstimated).toBe(true);
    expect(line(b, "electricityGas").amount).toBe(120);
  });
});

describe("estimatedMonthlyTotal", () => {
  it("sums base rent and the recurring Listed or Estimated lines", () => {
    const f = facts({ rent: listed(1250), rentBasis: "per-person", bedrooms: listed(3) });
    f.amenities.parking = listed(true);
    const b = costBreakdown(f, prefs);
    // 1250 + 63.33 + 66.67 + 13.33 + 0
    expect(estimatedMonthlyTotal(b)).toBe(1393.33);
  });
  it("is null when rent is Not Listed", () => {
    expect(estimatedMonthlyTotal(costBreakdown(facts(), prefs))).toBeNull();
  });
  it("excludes one-time items", () => {
    const f = facts({ rent: listed(1000), rentBasis: "per-person", bedrooms: listed(1), deposit: listed(5000), applicationFee: listed(500) });
    f.amenities.utilitiesIncluded = listed(true);
    f.amenities.parking = listed(true);
    expect(estimatedMonthlyTotal(costBreakdown(f, prefs))).toBe(1040);
  });
});

describe("landlordQuestions", () => {
  it("asks one fixed question per Not Listed fact", () => {
    const f = facts();
    const qs = landlordQuestions(f, costBreakdown(f, prefs));
    expect(qs).toEqual([
      QUESTIONS.rent, QUESTIONS.bedrooms, QUESTIONS.lease, QUESTIONS.parking,
      QUESTIONS.laundry, QUESTIONS.utilitiesIncluded, QUESTIONS.pets, QUESTIONS.furnished,
      QUESTIONS.otherFees, QUESTIONS.deposit, QUESTIONS.applicationFee,
    ]);
  });
  it("asks nothing when everything is listed", () => {
    const f = facts({
      rent: listed(1000), bedrooms: listed(2), bathrooms: listed(1), leaseType: listed("12-month"),
      deposit: listed(1000), applicationFee: listed(50), parkingFee: listed(0), otherMonthlyFees: listed(0),
    });
    for (const k of Object.keys(f.amenities) as (keyof typeof f.amenities)[]) f.amenities[k] = listed(true);
    expect(landlordQuestions(f, costBreakdown(f, prefs))).toEqual([]);
  });
});
