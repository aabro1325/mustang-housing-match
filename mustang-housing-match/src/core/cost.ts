// Cost Breakdown, Estimated Monthly Total, and Landlord Questions. Pure. Estimate formulas come from
// docs/research/slo-cost-defaults.md (research/slo-cost-defaults branch) as fixed by issue #11.
import type { AmenityId, ListingFacts, Preferences, Provenance } from "./domain";

export type CostLineId =
  | "rent" | "electricityGas" | "waterSewerTrash" | "internet" | "parking" | "otherFees" | "deposit" | "applicationFee";

export interface CostLine {
  id: CostLineId;
  label: string;
  /** Per person, dollars. null means Not Listed. */
  amount: number | null;
  provenance: Provenance;
  recurring: boolean;
}

export interface CostBreakdown {
  items: CostLine[];
  /** Bedrooms used for the formulas (1 when Not Listed). */
  bedrooms: number;
  bedroomsEstimated: boolean;
}

export const APPLICATION_FEE_ESTIMATE = 66;
export const INTERNET_PER_HOUSEHOLD = 40;
export const INTERNET_FLOOR = 10;

const round2 = (n: number) => Math.round(n * 100) / 100;

function bedroomsFor(facts: ListingFacts): { bedrooms: number; estimated: boolean } {
  const v = facts.bedrooms.value;
  if (v === null || !Number.isFinite(v) || v < 1) return { bedrooms: 1, estimated: true };
  return { bedrooms: v, estimated: false };
}

/** Per-person base rent: unit rent / bedrooms on the Per Unit basis, the listed figure on Per Person; shared room halves it. */
export function perPersonRent(facts: ListingFacts, prefs: Preferences): { amount: number | null; provenance: Provenance } {
  const rent = facts.rent.value;
  if (rent === null) return { amount: null, provenance: "NotListed" };
  const { bedrooms, estimated } = bedroomsFor(facts);
  let amount = facts.rentBasis === "per-unit" ? rent / bedrooms : rent;
  if (prefs.roomType === "shared") amount = amount / 2;
  const provenance: Provenance =
    facts.rent.provenance === "Corrected" ? "Corrected" : estimated && facts.rentBasis === "per-unit" ? "Estimated" : facts.rent.provenance;
  return { amount: round2(amount), provenance };
}

/** Monthly rent for the whole unit, used for deposit comparisons. */
export function unitRent(facts: ListingFacts): number | null {
  const rent = facts.rent.value;
  if (rent === null) return null;
  if (facts.rentBasis === "per-unit") return rent;
  return rent * bedroomsFor(facts).bedrooms;
}

export function costBreakdown(facts: ListingFacts, prefs: Preferences): CostBreakdown {
  const { bedrooms, estimated } = bedroomsFor(facts);
  const utilitiesIncluded = facts.amenities.utilitiesIncluded.value === true;
  const base = perPersonRent(facts, prefs);
  const est: Provenance = "Estimated";
  const items: CostLine[] = [];

  items.push({ id: "rent", label: "Base rent", amount: base.amount, provenance: base.provenance, recurring: true });

  if (utilitiesIncluded) {
    items.push({ id: "electricityGas", label: "Electricity and gas", amount: 0, provenance: "Listed", recurring: true });
    items.push({ id: "waterSewerTrash", label: "Water, sewer and trash", amount: 0, provenance: "Listed", recurring: true });
  } else {
    items.push({ id: "electricityGas", label: "Electricity and gas", amount: round2((85 + 35 * bedrooms) / bedrooms), provenance: est, recurring: true });
    items.push({ id: "waterSewerTrash", label: "Water, sewer and trash", amount: round2((110 + 30 * bedrooms) / bedrooms), provenance: est, recurring: true });
  }
  items.push({ id: "internet", label: "Internet", amount: round2(Math.max(INTERNET_PER_HOUSEHOLD / bedrooms, INTERNET_FLOOR)), provenance: est, recurring: true });

  if (facts.parkingFee.value !== null) {
    items.push({ id: "parking", label: "Parking", amount: facts.parkingFee.value, provenance: facts.parkingFee.provenance, recurring: true });
  } else if (facts.amenities.parking.value === true) {
    items.push({ id: "parking", label: "Parking", amount: 0, provenance: facts.amenities.parking.provenance === "Corrected" ? "Corrected" : "Listed", recurring: true });
  } else {
    items.push({ id: "parking", label: "Parking", amount: null, provenance: "NotListed", recurring: true });
  }

  items.push({
    id: "otherFees", label: "Other monthly fees",
    amount: facts.otherMonthlyFees.value, provenance: facts.otherMonthlyFees.value === null ? "NotListed" : facts.otherMonthlyFees.provenance, recurring: true,
  });

  if (facts.deposit.value !== null) {
    const perPerson = facts.rentBasis === "per-unit" ? facts.deposit.value / bedrooms : facts.deposit.value;
    items.push({ id: "deposit", label: "Security deposit", amount: round2(perPerson), provenance: facts.deposit.provenance, recurring: false });
  } else {
    items.push({ id: "deposit", label: "Security deposit", amount: base.amount, provenance: base.amount === null ? "NotListed" : est, recurring: false });
  }

  if (facts.applicationFee.value !== null) {
    items.push({ id: "applicationFee", label: "Application fee", amount: facts.applicationFee.value, provenance: facts.applicationFee.provenance, recurring: false });
  } else {
    items.push({ id: "applicationFee", label: "Application fee", amount: APPLICATION_FEE_ESTIMATE, provenance: est, recurring: false });
  }

  return { items, bedrooms, bedroomsEstimated: estimated };
}

/** Base rent plus every recurring Listed or Estimated line; null when rent is Not Listed. */
export function estimatedMonthlyTotal(breakdown: CostBreakdown): number | null {
  const rent = breakdown.items.find((i) => i.id === "rent");
  if (!rent || rent.amount === null) return null;
  let total = 0;
  for (const i of breakdown.items) if (i.recurring && i.amount !== null) total += i.amount;
  return round2(total);
}

const AMENITY_QUESTIONS: Record<AmenityId, string> = {
  parking: "Is parking included, and is there a monthly fee for it?",
  laundry: "Is there laundry in the unit or on site?",
  utilitiesIncluded: "Which utilities are included in the rent?",
  pets: "Are pets allowed, and is there pet rent or a pet deposit?",
  furnished: "Is the unit furnished?",
};

export const QUESTIONS = {
  ...AMENITY_QUESTIONS,
  rent: "What is the monthly rent, and is it per unit or per person?",
  bedrooms: "How many bedrooms and bathrooms does the unit have?",
  lease: "What are the lease start and end dates, and what are the early-termination or sublet terms?",
  parking: "Is parking available, and is there a monthly fee for it?",
  otherFees: "Are there any other monthly fees, such as pet rent, trash, or HOA charges?",
  deposit: "What is the security deposit? California caps it at one month's rent, or two for a small landlord.",
  applicationFee: "Is there an application fee, and how much is it per applicant?",
} as const;

/** One fixed-wording question per Not Listed cost, lease, or amenity fact. Order is stable. */
export function landlordQuestions(facts: ListingFacts, breakdown: CostBreakdown): string[] {
  const out: string[] = [];
  if (facts.rent.value === null) out.push(QUESTIONS.rent);
  if (facts.bedrooms.value === null || facts.bathrooms.value === null) out.push(QUESTIONS.bedrooms);
  if (facts.leaseType.value === null) out.push(QUESTIONS.lease);
  const parking = breakdown.items.find((i) => i.id === "parking");
  if (parking && parking.amount === null) out.push(QUESTIONS.parking);
  else if (facts.amenities.parking.value === null && facts.parkingFee.value === null) out.push(AMENITY_QUESTIONS.parking);
  for (const id of ["laundry", "utilitiesIncluded", "pets", "furnished"] as AmenityId[]) {
    if (facts.amenities[id].value === null) out.push(AMENITY_QUESTIONS[id]);
  }
  if (facts.otherMonthlyFees.value === null) out.push(QUESTIONS.otherFees);
  if (facts.deposit.value === null) out.push(QUESTIONS.deposit);
  if (facts.applicationFee.value === null) out.push(QUESTIONS.applicationFee);
  return out;
}
