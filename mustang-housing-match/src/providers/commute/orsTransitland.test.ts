import { describe, it, expect, vi } from "vitest";
import { orsTransitlandProvider, tokenBucket } from "./orsTransitland";

const now = new Date("2026-10-12T16:00:00Z"); // Monday 09:00 PDT -> departure Tue 08:00

const geocodeBody = { features: [{ geometry: { coordinates: [-120.6698, 35.2962] }, properties: { confidence: 0.9 } }] };
const orsBody = (distance: number, duration: number) => ({ routes: [{ summary: { distance, duration } }] });
const transitBody = { plan: { itineraries: [{ duration: 1500, legs: [{ distance: 400 }, { distance: 2600 }] }, { duration: 2400, legs: [] }] } };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Routes requests by URL/profile to canned responses; records calls. */
function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    for (const [key, handler] of Object.entries(routes)) if (url.includes(key)) return handler();
    throw new Error("unrouted " + url);
  });
  return Object.assign(f as unknown as typeof fetch, { calls });
}

const base = (f: typeof globalThis.fetch) => orsTransitlandProvider({ orsKey: "ORS", transitlandKey: "TL", fetch: f, sleep: async () => {} });

describe("orsTransitlandProvider", () => {
  it("geocodes, routes three ORS profiles and one Transitland plan", async () => {
    const f = fakeFetch({
      "geocode/search": () => json(geocodeBody),
      "foot-walking": () => json(orsBody(1200, 900)),
      "cycling-regular": () => json(orsBody(1300, 300)),
      "driving-car": () => json(orsBody(1500, 240)),
      "routing/otp/plan": () => json(transitBody),
    });
    const r = await base(f).lookup("870 Foothill Blvd, San Luis Obispo", { now });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.providerId).toBe("ors-transitland");
    expect(r.origin).toEqual({ lat: 35.2962, lon: -120.6698 });
    expect(r.modes.walk).toEqual({ kind: "ok", minutes: 15, miles: 0.75 });
    expect(r.modes.bike).toEqual({ kind: "ok", minutes: 5, miles: 0.81 });
    expect(r.modes.car).toEqual({ kind: "ok", minutes: 4, miles: 0.93 });
    expect(r.modes.bus).toEqual({ kind: "ok", minutes: 25, miles: 1.86 });
    expect(r.transitDeparture).toBe("2026-10-13T08:00:00-07:00");
    expect(r.attribution).toHaveLength(2);

    const geo = f.calls.find((c) => c.url.includes("geocode/search"))!;
    const u = new URL(geo.url);
    expect(u.searchParams.get("api_key")).toBe("ORS");
    expect(u.searchParams.get("boundary.circle.radius")).toBe("25");
    expect(u.searchParams.get("text")).toBe("870 Foothill Blvd, San Luis Obispo");

    const walk = f.calls.find((c) => c.url.includes("foot-walking"))!;
    expect(walk.init?.method).toBe("POST");
    expect((walk.init?.headers as Record<string, string>).Authorization).toBe("ORS");
    expect(JSON.parse(walk.init?.body as string)).toEqual({ coordinates: [[-120.6698, 35.2962], [-120.66407, 35.30186]] });

    const tl = f.calls.find((c) => c.url.includes("otp/plan"))!;
    const tu = new URL(tl.url);
    expect(tu.searchParams.get("fromPlace")).toBe("35.2962,-120.6698");
    expect(tu.searchParams.get("toPlace")).toBe("35.30186,-120.66407");
    expect(tu.searchParams.get("date")).toBe("2026-10-13");
    expect(tu.searchParams.get("time")).toBe("08:00");
    expect((tl.init?.headers as Record<string, string>).apikey).toBe("TL");
  });

  it("returns address-not-found when geocoding has no feature or low confidence", async () => {
    const none = fakeFetch({ "geocode/search": () => json({ features: [] }) });
    expect((await base(none).lookup("1 Nowhere Lane", { now })).kind).toBe("address-not-found");
    const low = fakeFetch({ "geocode/search": () => json({ features: [{ geometry: { coordinates: [1, 2] }, properties: { confidence: 0.2 } }] }) });
    expect((await base(low).lookup("vague", { now })).kind).toBe("address-not-found");
  });

  it("returns transient-failure on a 429 geocode or a network error", async () => {
    const limited = fakeFetch({ "geocode/search": () => json({}, 429) });
    const r = await base(limited).lookup("x", { now });
    expect(r.kind).toBe("transient-failure");
    if (r.kind === "transient-failure") expect(r.message).toContain("429");
    const offline = fakeFetch({ "geocode/search": () => { throw new TypeError("Failed to fetch"); } });
    expect((await base(offline).lookup("x", { now })).kind).toBe("transient-failure");
  });

  it("marks a mode not-available on 404 / no route, and bus not-available when Transitland fails", async () => {
    const f = fakeFetch({
      "geocode/search": () => json(geocodeBody),
      "foot-walking": () => json(orsBody(1200, 900)),
      "cycling-regular": () => json({ error: { code: 2010, message: "Could not find routable point" } }, 404),
      "driving-car": () => json({ routes: [] }),
      "routing/otp/plan": () => json({}, 500),
    });
    const r = await base(f).lookup("870 Foothill Blvd", { now });
    if (r.kind !== "ok") throw new Error(r.kind);
    expect(r.modes.walk.kind).toBe("ok");
    expect(r.modes.bike).toEqual({ kind: "not-available" });
    expect(r.modes.car).toEqual({ kind: "not-available" });
    expect(r.modes.bus).toEqual({ kind: "not-available" });
  });

  it("marks bus not-available when the plan has no itineraries", async () => {
    const f = fakeFetch({
      "geocode/search": () => json(geocodeBody),
      "directions": () => json(orsBody(1000, 600)),
      "routing/otp/plan": () => json({ plan: { itineraries: [] } }),
    });
    const r = await base(f).lookup("870 Foothill Blvd", { now });
    if (r.kind !== "ok") throw new Error(r.kind);
    expect(r.modes.bus).toEqual({ kind: "not-available" });
  });

  it("returns transient-failure when every ORS route call fails transiently, even if transit works", async () => {
    const f = fakeFetch({
      "geocode/search": () => json(geocodeBody),
      "directions": () => json({}, 503),
      "routing/otp/plan": () => json(transitBody),
    });
    const r = await base(f).lookup("870 Foothill Blvd", { now });
    expect(r.kind).toBe("transient-failure");
  });

  it("rate-limits with a token bucket", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const take = tokenBucket(2, () => t, async (ms) => { sleeps.push(ms); t += ms; });
    await take(); await take();
    await take(); // bucket empty: must wait for one token (30s at 2/min)
    expect(sleeps).toEqual([30000]);
  });
});
