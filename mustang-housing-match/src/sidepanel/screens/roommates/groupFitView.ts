// Pure derivation for Group Fit: each Member's Fit Score per Saved Listing and the rounded mean.
import type { Preferences, SavedListing } from "@/core/domain";
import { fitScore, mainConcern, primaryBenefit } from "@/core/scoring";
import type { Member } from "@/core/sharing/provider";

export interface MemberScore {
  member: Member;
  score: number | null;
  isMe: boolean;
}

export interface GroupFitRow {
  saved: SavedListing;
  scores: MemberScore[];
  scored: number;
  mean: number | null;
  total: number | null;
  why: string | null;
}

/** Rows ranked by group mean (unscored last); the top row is the group's recommended starting point. */
export function groupFitView(saved: SavedListing[], members: Member[], me: string | null, prefs: Preferences | null): GroupFitRow[] {
  const rows = saved.map((s) => {
    const own = prefs ? fitScore(s.listing.facts, s.commute, prefs) : null;
    const scores: MemberScore[] = members.map((m) => ({
      member: m,
      isMe: m.id === me,
      score: m.id === me && own ? own.score : s.fitScores[m.id]?.score ?? null,
    }));
    const known = scores.filter((x) => x.score !== null).map((x) => x.score as number);
    const mean = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
    return {
      saved: s,
      scores,
      scored: known.length,
      mean,
      total: own?.estimatedMonthlyTotal ?? null,
      why: own ? primaryBenefit(own) ?? mainConcern(own) : null,
    };
  });
  return rows.sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1) || b.scored - a.scored);
}
