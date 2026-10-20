// Build-time release scope. Unset or any value other than "alpha" is the full product,
// so dev builds and the default test run keep every feature.
import type { Category } from "./domain";

export type ReleaseScope = "full" | "alpha";

export function parseReleaseScope(value: string | undefined | null): ReleaseScope {
  return value === "alpha" ? "alpha" : "full";
}

export function releaseScope(): ReleaseScope {
  return parseReleaseScope(import.meta.env.VITE_RELEASE_SCOPE);
}

export function isAlphaScope(scope: ReleaseScope = releaseScope()): boolean {
  return scope === "alpha";
}

/** Categories that contribute to the Fit Score. Alpha drops Commute so the rest are re-normalized to 100. */
export function scoredCategories(scope: ReleaseScope = "full"): Category[] {
  return scope === "alpha" ? ["cost", "lease", "amenities"] : ["cost", "commute", "lease", "amenities"];
}
