import type { Preferences, SavedListing, Status } from "@/core/domain";
import { fitScore, mainConcern, primaryBenefit, LEASE_LABEL, type FitScoreResult } from "@/core/scoring";
import { scoreBand } from "../match/ScorecardScreen";

export const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved", considering: "Considering", "tour-scheduled": "Tour scheduled", applied: "Applied", rejected: "Rejected", selected: "Selected",
};

export interface SavedView {
  saved: SavedListing;
  result: FitScoreResult | null;
  score: number | null;
  band: string | null;
  total: number | null;
  benefit: string | null;
  concern: string | null;
  details: string;
}

/** What a Saved card shows: this Member's live score when Preferences are known, else the stored one. */
export function savedView(s: SavedListing, prefs: Preferences | null, identityId: string | null): SavedView {
  const result = prefs ? fitScore(s.listing.facts, s.commute, prefs) : null;
  const stored = identityId ? s.fitScores[identityId]?.score ?? null : null;
  const score = result ? result.score : stored;
  const f = s.listing.facts;
  const parts: string[] = [];
  if (f.leaseType.value) parts.push(LEASE_LABEL[f.leaseType.value]!);
  if (prefs) parts.push(prefs.roomType === "shared" ? "Shared room" : "Private room");
  if (f.bedrooms.value !== null || f.bathrooms.value !== null) {
    parts.push(`${f.bedrooms.value ?? "?"} bd / ${f.bathrooms.value ?? "?"} ba`);
  }
  return {
    saved: s,
    result,
    score,
    band: score === null ? null : scoreBand(score).label,
    total: result?.estimatedMonthlyTotal ?? null,
    benefit: result ? primaryBenefit(result) : null,
    concern: result ? mainConcern(result) : null,
    details: parts.join(" · "),
  };
}

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
