// Fit Score rubric as fixed by issue #11. Pure functions of (Listing Facts, Commute, Preferences): no clock, no randomness.
import { costBreakdown, estimatedMonthlyTotal, unitRent, type CostBreakdown } from "./cost";
import { CATEGORIES, type AmenityId, type Category, type Commute, type ListingFacts, type Preferences, type Priority, type TransportMode } from "./domain";

export const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, med: 2, low: 1 };

/** 100 × weight / sum, with largest-remainder rounding so the four maxima sum to exactly 100 (ties go in category order). */
export function categoryMaxima(priorities: Record<Category, Priority>): Record<Category, number> {
  const weights = CATEGORIES.map((c) => PRIORITY_WEIGHT[priorities[c]]);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (100 * w) / sum);
  const floors = raw.map(Math.floor);
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return { cost: floors[0]!, commute: floors[1]!, lease: floors[2]!, amenities: floors[3]! };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function costFraction(total: number | null, budget: number | null): number {
  if (budget === null || budget <= 0) return 0.5;
  if (total === null) return 0.5;
  const r = total / budget;
  if (r <= 1) return 1;
  if (r >= 1.3) return 0;
  return clamp01(1 - (r - 1) / 0.3);
}

export function preferredMinutes(commute: Commute | null, mode: TransportMode): number | null {
  if (!commute || commute.kind !== "ok") return null;
  const m = commute.modes[mode];
  return m.kind === "ok" ? m.minutes : null;
}

export function commuteFraction(commute: Commute | null, prefs: Preferences): number {
  const minutes = preferredMinutes(commute, prefs.transportMode);
  if (minutes === null) return 0;
  const max = prefs.maxCommuteMinutes;
  if (max <= 0) return minutes <= 0 ? 1 : 0;
  if (minutes <= max) return 1;
  if (minutes >= 2 * max) return 0;
  return clamp01(1 - (minutes - max) / max);
}

export function leaseFraction(facts: ListingFacts, prefs: Preferences): number {
  const lease = facts.leaseType.value;
  if (lease === null) return 0.5;
  if (lease === prefs.leaseType) return 1;
  if (lease === "month-to-month" && (prefs.leaseType === "12-month" || prefs.leaseType === "school-year")) return 0.75;
  return 0.2;
}

export function amenitiesFraction(facts: ListingFacts, prefs: Preferences): number {
  if (prefs.wantedAmenities.length === 0) return 1;
  let sum = 0;
  for (const a of prefs.wantedAmenities) {
    const v = facts.amenities[a].value;
    sum += v === true ? 1 : v === null ? 0.5 : 0;
  }
  return sum / prefs.wantedAmenities.length;
}

export function categoryFractions(facts: ListingFacts, commute: Commute | null, prefs: Preferences, total: number | null): Record<Category, number> {
  return {
    cost: costFraction(total, prefs.budget),
    commute: commuteFraction(commute, prefs),
    lease: leaseFraction(facts, prefs),
    amenities: amenitiesFraction(facts, prefs),
  };
}

export type InsightKind = Category | "commute-failure" | "deposit" | "lease-unknown";
export interface Insight {
  category: InsightKind;
  text: string;
  /** Points gained (Benefit) or lost (Watch-out); used for ranking. */
  points: number;
}

export interface CategoryResult {
  points: number;
  max: number;
  fraction: number;
}

export interface FitScoreResult {
  score: number;
  categories: Record<Category, CategoryResult>;
  benefits: Insight[];
  watchOuts: Insight[];
  breakdown: CostBreakdown;
  estimatedMonthlyTotal: number | null;
}

export const MODE_LABEL: Record<TransportMode, string> = { walk: "Walking", bike: "Bike", bus: "Bus", car: "Driving" };
export const MODE_NOUN: Record<TransportMode, string> = { walk: "walking", bike: "bike", bus: "bus", car: "driving" };
export const LEASE_LABEL: Record<string, string> = { "school-year": "School-year", "month-to-month": "Month-to-month", "12-month": "12-month" };
export const AMENITY_LABEL: Record<AmenityId, string> = {
  parking: "parking", laundry: "laundry", utilitiesIncluded: "utilities included", pets: "pets allowed", furnished: "furnished",
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function joinWords(words: string[], conj: string): string {
  if (words.length <= 1) return words[0] ?? "";
  if (words.length === 2) return `${words[0]} ${conj} ${words[1]}`;
  return `${words.slice(0, -1).join(", ")} ${conj} ${words[words.length - 1]}`;
}

export const INSIGHT_LIMIT = 3;

export function fitScore(facts: ListingFacts, commute: Commute | null, prefs: Preferences): FitScoreResult {
  const breakdown = costBreakdown(facts, prefs);
  const total = estimatedMonthlyTotal(breakdown);
  const maxima = categoryMaxima(prefs.priorities);
  const fractions = categoryFractions(facts, commute, prefs, total);

  const categories = {} as Record<Category, CategoryResult>;
  let sum = 0;
  for (const c of CATEGORIES) {
    const points = maxima[c] * fractions[c];
    categories[c] = { points, max: maxima[c], fraction: fractions[c] };
    sum += points;
  }
  const score = Math.max(0, Math.min(100, Math.round(sum)));

  const benefits: Insight[] = [];
  const watchOuts: Insight[] = [];
  const lost = (c: Category) => categories[c].max - categories[c].points;

  // Cost
  if (total !== null && prefs.budget !== null && prefs.budget > 0) {
    const diff = prefs.budget - total;
    if (fractions.cost >= 0.8 && diff >= 0) {
      benefits.push({ category: "cost", text: `Estimated monthly total is ${money(diff)} under your ${money(prefs.budget)} budget`, points: categories.cost.points });
    } else if (fractions.cost <= 0.5) {
      watchOuts.push({ category: "cost", text: `Estimated monthly total is ${money(-diff)} over your ${money(prefs.budget)} budget`, points: lost("cost") });
    }
  }

  // Commute, including the failure rules from issue #9
  const mode = prefs.transportMode;
  const minutes = preferredMinutes(commute, mode);
  if (!commute) {
    // No lookup yet: no insight.
  } else if (commute.kind === "address-not-found") {
    watchOuts.push({ category: "commute-failure", text: "Address could not be located; Commute not scored", points: lost("commute") });
  } else if (commute.kind === "transient-failure") {
    watchOuts.push({ category: "commute-failure", text: "Commute lookup failed; retry", points: lost("commute") });
  } else if (minutes === null) {
    watchOuts.push({ category: "commute-failure", text: `No ${MODE_NOUN[mode]} route found for a weekday 8 AM departure`, points: lost("commute") });
  } else if (fractions.commute >= 0.8) {
    benefits.push({ category: "commute", text: `${MODE_LABEL[mode]} commute is ${Math.round(minutes)} min, within your ${prefs.maxCommuteMinutes} min limit`, points: categories.commute.points });
  } else if (fractions.commute <= 0.5) {
    watchOuts.push({ category: "commute", text: `${MODE_LABEL[mode]} commute is ${Math.round(minutes)} min against your ${prefs.maxCommuteMinutes} min limit`, points: lost("commute") });
  }

  // Lease
  const lease = facts.leaseType.value;
  if (lease === null) {
    watchOuts.push({ category: "lease-unknown", text: "Lease length not listed; confirm the term before applying", points: lost("lease") });
  } else if (fractions.lease >= 0.8) {
    benefits.push({ category: "lease", text: `${LEASE_LABEL[lease]} lease matches your preference`, points: categories.lease.points });
  } else if (fractions.lease <= 0.5) {
    const hint = lease === "12-month" && prefs.leaseType === "school-year" ? "; summer months usually mean subleasing" : "";
    watchOuts.push({ category: "lease", text: `${LEASE_LABEL[lease]} lease; you prefer ${LEASE_LABEL[prefs.leaseType]!.toLowerCase()}${hint}`, points: lost("lease") });
  }

  // Amenities
  if (prefs.wantedAmenities.length > 0) {
    const present = prefs.wantedAmenities.filter((a) => facts.amenities[a].value === true).map((a) => AMENITY_LABEL[a]);
    const missing = prefs.wantedAmenities.filter((a) => facts.amenities[a].value !== true).map((a) => AMENITY_LABEL[a]);
    if (fractions.amenities >= 0.8 && present.length > 0) {
      benefits.push({ category: "amenities", text: `${cap(joinWords(present, "and"))} ${present.length === 1 ? "matches" : "match"} what you want`, points: categories.amenities.points });
    } else if (fractions.amenities <= 0.5 && missing.length > 0) {
      watchOuts.push({ category: "amenities", text: `No ${joinWords(missing, "or")} listed`, points: lost("amenities") });
    }
  }

  // Deposit over 1.5× the monthly unit rent
  const unit = unitRent(facts);
  if (facts.deposit.value !== null && unit !== null && facts.deposit.value > 1.5 * unit) {
    watchOuts.push({ category: "deposit", text: `Deposit of ${money(facts.deposit.value)} is over 1.5× the monthly rent; California caps deposits at one month`, points: 5 });
  }

  const byPoints = (a: Insight, b: Insight) => b.points - a.points;
  return {
    score,
    categories,
    benefits: benefits.sort(byPoints).slice(0, INSIGHT_LIMIT),
    watchOuts: watchOuts.sort(byPoints).slice(0, INSIGHT_LIMIT),
    breakdown,
    estimatedMonthlyTotal: total,
  };
}

export const primaryBenefit = (r: FitScoreResult): string | null => r.benefits[0]?.text ?? null;
export const mainConcern = (r: FitScoreResult): string | null => r.watchOuts[0]?.text ?? null;
