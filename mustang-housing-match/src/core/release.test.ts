import { describe, it, expect } from "vitest";
import { parseReleaseScope, scoredCategories } from "./release";

describe("release scope", () => {
  it("defaults to the full product unless the value is exactly alpha", () => {
    expect(parseReleaseScope(undefined)).toBe("full");
    expect(parseReleaseScope("")).toBe("full");
    expect(parseReleaseScope("full")).toBe("full");
    expect(parseReleaseScope("ALPHA")).toBe("full");
    expect(parseReleaseScope("alpha")).toBe("alpha");
  });

  it("scores Cost, Lease, and Amenities in alpha", () => {
    expect(scoredCategories("full")).toEqual(["cost", "commute", "lease", "amenities"]);
    expect(scoredCategories("alpha")).toEqual(["cost", "lease", "amenities"]);
  });
});
