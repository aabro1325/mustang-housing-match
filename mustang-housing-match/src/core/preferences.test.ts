import { describe, it, expect } from "vitest";
import { mergePreferences, type Preferences } from "./domain";

describe("mergePreferences", () => {
  it("fills omitted priorities so scoring cannot throw", () => {
    const prefs = mergePreferences({ budget: 1400, priorities: { cost: "high" } } as Partial<Preferences>);
    expect(prefs.budget).toBe(1400);
    expect(prefs.priorities).toEqual({ cost: "high", commute: "high", lease: "med", amenities: "low" });
    expect(prefs.maxCommuteMinutes).toBe(15);
    expect(prefs.transportMode).toBe("bike");
  });

  it("drops junk amenity ids and non-positive commute limits", () => {
    const prefs = mergePreferences({
      maxCommuteMinutes: 0,
      wantedAmenities: ["laundry", "not-real"] as Preferences["wantedAmenities"],
    });
    expect(prefs.maxCommuteMinutes).toBe(15);
    expect(prefs.wantedAmenities).toEqual(["laundry"]);
  });
});
