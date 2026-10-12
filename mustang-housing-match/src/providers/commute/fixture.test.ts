import { describe, it, expect } from "vitest";
import { fixtureCommuteProvider, normalizeFixtureAddress } from "./fixture";

const now = new Date("2026-10-12T16:00:00Z");

describe("fixtureCommuteProvider", () => {
  const p = fixtureCommuteProvider();

  it("geocodes the Figma listings and routes every mode deterministically", async () => {
    const a = await p.lookup("870 Foothill Blvd, San Luis Obispo, CA 93405", { now });
    const b = await p.lookup("870 foothill blvd", { now });
    expect(a).toEqual(b);
    if (a.kind !== "ok") throw new Error(a.kind);
    expect(a.providerId).toBe("fixture");
    expect(a.transitDeparture).toBe("2026-10-13T08:00:00-07:00");
    expect(a.attribution).toEqual(["Fixture data (no live lookup)"]);
    for (const mode of ["walk", "bike", "bus", "car"] as const) {
      const m = a.modes[mode];
      expect(m.kind).toBe("ok");
      if (m.kind === "ok") { expect(m.minutes).toBeGreaterThan(0); expect(m.miles).toBeGreaterThan(0); }
    }
    // walk slower than bike slower than car; bus = 2 x car + 10
    const walk = a.modes.walk, bike = a.modes.bike, car = a.modes.car, bus = a.modes.bus;
    if (walk.kind !== "ok" || bike.kind !== "ok" || car.kind !== "ok" || bus.kind !== "ok") throw new Error("modes");
    expect(walk.minutes).toBeGreaterThan(bike.minutes);
    expect(bus.minutes).toBe(car.minutes * 2 + 10);
    expect(walk.miles).toBe(bike.miles);
  });

  it("knows all three Figma listings plus Lizzie St", async () => {
    for (const addr of ["124 Hathway Ave", "1150 Chorro St", "1453 Lizzie St"]) {
      const r = await p.lookup(addr, { now });
      expect(r.kind, addr).toBe("ok");
    }
  });

  it("returns address-not-found for the deliberate failure address and unknown ones", async () => {
    expect((await p.lookup("1 Nowhere Lane", { now })).kind).toBe("address-not-found");
    expect((await p.lookup("999999 Imaginary Rd", { now })).kind).toBe("address-not-found");
  });

  it("applies the road factor and mode speeds (Foothill is about 0.8 mi from campus)", async () => {
    const r = await p.lookup("870 Foothill Blvd", { now });
    if (r.kind !== "ok" || r.modes.walk.kind !== "ok") throw new Error();
    expect(r.modes.walk.miles).toBeGreaterThan(0.6);
    expect(r.modes.walk.miles).toBeLessThan(1.4);
    expect(r.modes.walk.minutes).toBe(Math.round((r.modes.walk.miles / 3) * 60));
  });

  it("normalises loosely", () => {
    expect(normalizeFixtureAddress("870 Foothill Blvd., San Luis Obispo")).toBe("870 foothill blvd");
  });
});
