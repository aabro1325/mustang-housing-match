// Pure derivation for the Compare tab: one column per Finalist, scored against this Member's Preferences.
import { AMENITIES, type AmenityId, type Preferences, type SavedListing } from "@/core/domain";
import { AMENITY_LABEL, LEASE_LABEL, MODE_LABEL, fitScore, preferredMinutes, type FitScoreResult } from "@/core/scoring";
import type { CostLineId } from "@/core/cost";
import { scoreBand } from "../match/ScorecardScreen";
import { SOURCE_LABEL } from "../../state/match";

export interface CompareColumn {
  saved: SavedListing;
  shortName: string;
  source: string;
  result: FitScoreResult;
  band: string;
  total: number | null;
  /** Positive = under budget. */
  vsBudget: number | null;
  rent: string;
  utilities: string;
  internet: string;
  parking: string;
  minutes: number | null;
  minutesOk: boolean | null;
  lease: string;
  leaseOk: boolean | null;
  room: string;
  bedsBaths: string;
  amenities: Record<AmenityId, "yes" | "no" | "unknown">;
  deposit: string;
  applicationFee: string;
  unknowns: number;
  watchOuts: number;
}

export interface CompareView {
  columns: CompareColumn[];
  leaderId: string | null;
  verdict: { title: string; body: string } | null;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function line(result: FitScoreResult, id: CostLineId): string {
  const l = result.breakdown.items.find((i) => i.id === id);
  if (!l || l.amount === null) return "Not listed";
  if (l.provenance === "Estimated") return `${money(l.amount)} est.`;
  if (l.amount === 0 && (id === "parking" || id === "waterSewerTrash")) return "Included";
  return money(l.amount);
}

function utilities(result: FitScoreResult, saved: SavedListing): string {
  if (saved.listing.facts.amenities.utilitiesIncluded.value === true) return "Included";
  const e = result.breakdown.items.find((i) => i.id === "electricityGas");
  const w = result.breakdown.items.find((i) => i.id === "waterSewerTrash");
  const sum = (e?.amount ?? 0) + (w?.amount ?? 0);
  return sum > 0 ? `${money(sum)} est.` : "Not listed";
}

/** "870 Foothill Blvd, San Luis Obispo" → "Foothill" (street name without number and suffix) for column headers. */
export function shortName(title: string): string {
  const street = title.split(",")[0] ?? title;
  const words = street.replace(/^\d+[a-z]?\s+/i, "").split(/\s+/).filter(Boolean);
  const suffix = /^(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|cir|circle)\.?$/i;
  const core = words.filter((w) => !suffix.test(w));
  return (core.length ? core : words).slice(0, 2).join(" ") || title;
}

export function compareView(finalists: SavedListing[], prefs: Preferences): CompareView {
  const columns: CompareColumn[] = finalists.map((saved) => {
    const f = saved.listing.facts;
    const result = fitScore(f, saved.commute, prefs);
    const total = result.estimatedMonthlyTotal;
    const minutes = preferredMinutes(saved.commute, prefs.transportMode);
    const amenities = Object.fromEntries(
      AMENITIES.map((a) => [a, f.amenities[a].value === true ? "yes" : f.amenities[a].value === false ? "no" : "unknown"]),
    ) as Record<AmenityId, "yes" | "no" | "unknown">;
    const unknowns = AMENITIES.filter((a) => amenities[a] === "unknown").length
      + (f.deposit.value === null ? 1 : 0) + (f.applicationFee.value === null ? 1 : 0) + (f.leaseType.value === null ? 1 : 0);
    return {
      saved,
      shortName: shortName(saved.listing.title),
      source: SOURCE_LABEL[saved.listing.source],
      result,
      band: scoreBand(result.score).label,
      total,
      vsBudget: total !== null && prefs.budget ? prefs.budget - total : null,
      rent: f.rent.value === null ? "Not listed" : `${money(f.rent.value)}${f.rentBasis === "per-person" ? "" : " / unit"}`,
      utilities: utilities(result, saved),
      internet: line(result, "internet"),
      parking: f.amenities.parking.value === true && f.parkingFee.value === null ? "Included" : line(result, "parking"),
      minutes,
      minutesOk: minutes === null ? null : minutes <= prefs.maxCommuteMinutes,
      lease: f.leaseType.value === null ? "Not listed" : LEASE_LABEL[f.leaseType.value]!,
      leaseOk: f.leaseType.value === null ? null : f.leaseType.value === prefs.leaseType,
      room: prefs.roomType === "shared" ? "Shared" : "Private",
      bedsBaths: f.bedrooms.value === null && f.bathrooms.value === null ? "Not listed" : `${f.bedrooms.value ?? "?"} bd / ${f.bathrooms.value ?? "?"} ba`,
      amenities,
      deposit: f.deposit.value === null ? "Not listed" : money(f.deposit.value),
      applicationFee: f.applicationFee.value === null ? "Not listed" : money(f.applicationFee.value),
      unknowns,
      watchOuts: result.watchOuts.length,
    };
  });

  let leader: CompareColumn | null = null;
  for (const c of columns) if (!leader || c.result.score > leader.result.score) leader = c;
  const verdict = leader && columns.length >= 2 ? buildVerdict(leader, columns, prefs) : null;
  return { columns, leaderId: leader?.saved.id ?? null, verdict };
}

function buildVerdict(leader: CompareColumn, columns: CompareColumn[], prefs: Preferences): { title: string; body: string } {
  const runnerUp = [...columns].filter((c) => c !== leader).sort((a, b) => b.result.score - a.result.score)[0];
  const margin = runnerUp ? leader.result.score - runnerUp.result.score : 0;
  const tie = runnerUp && margin === 0;
  const title = tie ? `${leader.shortName} and ${runnerUp!.shortName} are tied` : `${leader.shortName} leads${leader.unknowns > 0 ? ", pending confirmation" : ""}`;
  const why: string[] = [];
  if (leader.vsBudget !== null) why.push(leader.vsBudget >= 0 ? `${money(leader.vsBudget)} under your budget` : `${money(-leader.vsBudget)} over your budget`);
  if (leader.minutes !== null) why.push(`${Math.round(leader.minutes)} min by ${MODE_LABEL[prefs.transportMode].toLowerCase()}`);
  const confirm: string[] = [];
  if (leader.lease === "Not listed") confirm.push("the lease term");
  for (const a of AMENITIES) if (leader.amenities[a] === "unknown" && prefs.wantedAmenities.includes(a)) confirm.push(AMENITY_LABEL[a].toLowerCase());
  if (leader.deposit === "Not listed") confirm.push("the deposit");
  const body = [
    why.length ? `${why.join(", ")}.` : "",
    confirm.length ? `Confirm ${confirm.slice(0, 3).join(", ")} with the landlord before deciding.` : "Nothing left to confirm on the listing itself.",
  ].filter(Boolean).join(" ");
  return { title, body };
}
