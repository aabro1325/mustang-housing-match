import { describe, it, expect, vi } from "vitest";
import { commuteCacheKey, cachedProvider, type CommuteCache } from "./cache";
import type { CommuteProvider } from "./provider";
import type { Commute } from "../domain";

function memCache(): CommuteCache & { map: Map<string, Commute> } {
  const map = new Map<string, Commute>();
  return { map, async get(k) { return map.get(k); }, async set(k, c) { map.set(k, c); } };
}

const ok = (version = 1): Commute => ({
  kind: "ok", origin: { lat: 1, lon: 2 }, transitDeparture: "2026-10-12T08:00:00-07:00", attribution: [], providerId: "x",
  referencePointVersion: version,
  modes: { walk: { kind: "ok", minutes: 1, miles: 1 }, bike: { kind: "ok", minutes: 1, miles: 1 }, bus: { kind: "not-available" }, car: { kind: "ok", minutes: 1, miles: 1 } },
});
const now = new Date("2026-10-12T16:00:00Z");

describe("commuteCacheKey", () => {
  it("includes the version", () => {
    expect(commuteCacheKey("870 foothill blvd", 1)).toBe("commute:v1:870 foothill blvd");
  });
});

describe("cachedProvider", () => {
  it("caches ok results and serves them without calling the inner provider again", async () => {
    const inner: CommuteProvider = { id: "inner", lookup: vi.fn(async () => ok()) };
    const cache = memCache();
    const p = cachedProvider(inner, cache, (s) => s.toLowerCase());
    expect(p.id).toBe("inner");
    await p.lookup("870 Foothill Blvd", { now });
    await p.lookup("870 FOOTHILL BLVD", { now });
    expect(inner.lookup).toHaveBeenCalledTimes(1);
    expect(cache.map.size).toBe(1);
  });
  it("caches address-not-found", async () => {
    const inner: CommuteProvider = { id: "inner", lookup: vi.fn(async (): Promise<Commute> => ({ kind: "address-not-found", referencePointVersion: 1 })) };
    const p = cachedProvider(inner, memCache(), (s) => s);
    await p.lookup("x", { now }); await p.lookup("x", { now });
    expect(inner.lookup).toHaveBeenCalledTimes(1);
  });
  it("never caches transient failures", async () => {
    const inner: CommuteProvider = { id: "inner", lookup: vi.fn(async (): Promise<Commute> => ({ kind: "transient-failure", message: "429", referencePointVersion: 1 })) };
    const cache = memCache();
    const p = cachedProvider(inner, cache, (s) => s);
    await p.lookup("x", { now }); await p.lookup("x", { now });
    expect(inner.lookup).toHaveBeenCalledTimes(2);
    expect(cache.map.size).toBe(0);
  });
  it("ignores cached entries from another reference point version", async () => {
    const inner: CommuteProvider = { id: "inner", lookup: vi.fn(async () => ok()) };
    const cache = memCache();
    cache.map.set(commuteCacheKey("x", 1), ok(0));
    const p = cachedProvider(inner, cache, (s) => s);
    const r = await p.lookup("x", { now });
    expect(inner.lookup).toHaveBeenCalledTimes(1);
    expect(r.referencePointVersion).toBe(1);
  });
});
