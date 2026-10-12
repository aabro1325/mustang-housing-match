import { describe, it, expect } from "vitest";
import { nextWeekdayDeparture, haversineMiles, classifyHttpFailure } from "./provider";

describe("nextWeekdayDeparture", () => {
  it("moves a Saturday to the following Monday 08:00 Pacific", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-10T19:00:00Z"))).toBe("2026-10-12T08:00:00-07:00");
  });
  it("keeps today when it is a weekday before 08:00 Pacific", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-12T14:00:00Z"))).toBe("2026-10-12T08:00:00-07:00"); // 07:00 PDT
  });
  it("moves to tomorrow when it is a weekday after 08:00 Pacific", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-12T16:00:00Z"))).toBe("2026-10-13T08:00:00-07:00"); // 09:00 PDT
  });
  it("moves a Friday afternoon to Monday", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-19T08:00:00-07:00");
  });
  it("uses the standard-time offset after DST ends", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-02T08:00:00-08:00");
  });
  it("treats exactly 08:00 as already departed", () => {
    expect(nextWeekdayDeparture(new Date("2026-10-12T15:00:00Z"))).toBe("2026-10-13T08:00:00-07:00");
  });
});

describe("haversineMiles", () => {
  it("is zero for the same point", () => {
    expect(haversineMiles({ lat: 35.3, lon: -120.66 }, { lat: 35.3, lon: -120.66 })).toBe(0);
  });
  it("matches the research spread between the library and the Grand Ave entrance (574 m)", () => {
    const m = haversineMiles({ lat: 35.30186, lon: -120.66407 }, { lat: 35.30043, lon: -120.65799 });
    expect(m * 1609.344).toBeGreaterThan(560);
    expect(m * 1609.344).toBeLessThan(590);
  });
});

describe("classifyHttpFailure", () => {
  it("maps statuses", () => {
    expect(classifyHttpFailure(200)).toBe("ok");
    expect(classifyHttpFailure(404)).toBe("not-found");
    expect(classifyHttpFailure(429)).toBe("transient");
    expect(classifyHttpFailure(500)).toBe("transient");
    expect(classifyHttpFailure(503)).toBe("transient");
    expect(classifyHttpFailure(401)).toBe("transient");
    expect(classifyHttpFailure(400)).toBe("not-found");
  });
});
