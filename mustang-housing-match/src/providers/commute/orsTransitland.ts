import type { Commute, GeoPoint, ModeResult, TransportMode } from "../../core/domain";
import { CAMPUS_REFERENCE_POINT, REFERENCE_POINT_VERSION } from "../../core/commute/referencePoint";
import { classifyHttpFailure, nextWeekdayDeparture, type CommuteProvider } from "../../core/commute/provider";

export const ORS_BASE = "https://api.openrouteservice.org";
export const TRANSITLAND_PLAN_URL = "https://transit.land/api/v2/routing/otp/plan";
export const ORS_ATTRIBUTION = "openrouteservice © HeiGIT | Data from OpenStreetMap";
export const TRANSITLAND_ATTRIBUTION = "Transit data: Transitland (https://www.transit.land/terms)";

const ORS_PROFILES: Record<Exclude<TransportMode, "bus">, string> = {
  walk: "foot-walking",
  bike: "cycling-regular",
  car: "driving-car",
};
const GEOCODE_RADIUS_KM = 25;
const MIN_GEOCODE_CONFIDENCE = 0.5;
const METERS_PER_MILE = 1609.344;

export interface OrsTransitlandOptions {
  orsKey: string;
  transitlandKey: string;
  fetch: typeof fetch;
  referencePoint?: GeoPoint;
  /** openrouteservice Standard plan allows 40 directions per minute per key. */
  maxPerMinute?: number;
  /** Injected clock for the limiter (defaults to Date.now). */
  now?: () => number;
  /** Injected sleep for the limiter. */
  sleep?: (ms: number) => Promise<void>;
}

class TransientError extends Error {}
class NotFoundError extends Error {}

/** Simple token bucket: `capacity` tokens refilled evenly over a minute. */
export function tokenBucket(capacity: number, now: () => number, sleep: (ms: number) => Promise<void>) {
  let tokens = capacity;
  let last = now();
  const refillPerMs = capacity / 60_000;
  return async function take(): Promise<void> {
    for (;;) {
      const t = now();
      tokens = Math.min(capacity, tokens + (t - last) * refillPerMs);
      last = t;
      if (tokens >= 1) { tokens -= 1; return; }
      await sleep(Math.ceil((1 - tokens) / refillPerMs));
    }
  };
}

interface GeocodeFeature { geometry?: { coordinates?: [number, number] }; properties?: { confidence?: number } }

export function orsTransitlandProvider(opts: OrsTransitlandOptions): CommuteProvider {
  const referencePoint = opts.referencePoint ?? CAMPUS_REFERENCE_POINT;
  const take = tokenBucket(opts.maxPerMinute ?? 40, opts.now ?? (() => Date.now()), opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))));
  const doFetch = opts.fetch;

  async function request(url: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(url, init);
    } catch (e) {
      throw new TransientError(`network: ${(e as Error).message}`);
    }
    const cls = classifyHttpFailure(res.status);
    if (cls === "transient") throw new TransientError(`HTTP ${res.status}`);
    if (cls === "not-found") throw new NotFoundError(`HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new TransientError("invalid JSON");
    }
  }

  async function geocode(address: string): Promise<GeoPoint | null> {
    await take();
    const q = new URLSearchParams({
      api_key: opts.orsKey,
      text: address,
      size: "1",
      "boundary.circle.lat": String(referencePoint.lat),
      "boundary.circle.lon": String(referencePoint.lon),
      "boundary.circle.radius": String(GEOCODE_RADIUS_KM),
    });
    const body = (await request(`${ORS_BASE}/geocode/search?${q}`)) as { features?: GeocodeFeature[] };
    const f = body.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!coords || (f?.properties?.confidence ?? 1) < MIN_GEOCODE_CONFIDENCE) return null;
    return { lon: coords[0], lat: coords[1] };
  }

  async function orsRoute(profile: string, origin: GeoPoint): Promise<ModeResult> {
    await take();
    try {
      const body = (await request(`${ORS_BASE}/v2/directions/${profile}`, {
        method: "POST",
        headers: { Authorization: opts.orsKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ coordinates: [[origin.lon, origin.lat], [referencePoint.lon, referencePoint.lat]] }),
      })) as { routes?: { summary?: { distance?: number; duration?: number } }[] };
      const s = body.routes?.[0]?.summary;
      if (!s || typeof s.distance !== "number" || typeof s.duration !== "number") return { kind: "not-available" };
      return { kind: "ok", minutes: Math.round(s.duration / 60), miles: Math.round((s.distance / METERS_PER_MILE) * 100) / 100 };
    } catch (e) {
      if (e instanceof NotFoundError) return { kind: "not-available" };
      throw e;
    }
  }

  async function transitRoute(origin: GeoPoint, departure: string): Promise<ModeResult> {
    await take();
    const [date, time] = [departure.slice(0, 10), departure.slice(11, 16)];
    const q = new URLSearchParams({
      fromPlace: `${origin.lat},${origin.lon}`,
      toPlace: `${referencePoint.lat},${referencePoint.lon}`,
      date,
      time,
    });
    try {
      const body = (await request(`${TRANSITLAND_PLAN_URL}?${q}`, { headers: { apikey: opts.transitlandKey } })) as {
        plan?: { itineraries?: { duration?: number; legs?: { distance?: number }[] }[] };
      };
      const best = (body.plan?.itineraries ?? [])
        .filter((i) => typeof i.duration === "number")
        .sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0))[0];
      if (!best || typeof best.duration !== "number") return { kind: "not-available" };
      const meters = (best.legs ?? []).reduce((sum, l) => sum + (l.distance ?? 0), 0);
      return { kind: "ok", minutes: Math.round(best.duration / 60), miles: Math.round((meters / METERS_PER_MILE) * 100) / 100 };
    } catch {
      // Transitland is a beta service; any failure there leaves bus Not Available rather than failing the Commute.
      return { kind: "not-available" };
    }
  }

  return {
    id: "ors-transitland",
    async lookup(address, { now }): Promise<Commute> {
      let origin: GeoPoint | null;
      try {
        origin = await geocode(address);
      } catch (e) {
        if (e instanceof NotFoundError) return { kind: "address-not-found", referencePointVersion: REFERENCE_POINT_VERSION };
        return { kind: "transient-failure", message: (e as Error).message, referencePointVersion: REFERENCE_POINT_VERSION };
      }
      if (!origin) return { kind: "address-not-found", referencePointVersion: REFERENCE_POINT_VERSION };

      const transitDeparture = nextWeekdayDeparture(now);
      const settled = await Promise.allSettled([
        orsRoute(ORS_PROFILES.walk, origin),
        orsRoute(ORS_PROFILES.bike, origin),
        orsRoute(ORS_PROFILES.car, origin),
        transitRoute(origin, transitDeparture),
      ]);
      const [walk, bike, car, bus] = settled;
      const roadResults = [walk, bike, car];
      const allRoadsTransient = roadResults.every((r) => r.status === "rejected");
      if (allRoadsTransient) {
        const reason = (roadResults[0] as PromiseRejectedResult).reason as Error;
        return { kind: "transient-failure", message: reason.message, referencePointVersion: REFERENCE_POINT_VERSION };
      }
      const value = (r: PromiseSettledResult<ModeResult>): ModeResult => (r.status === "fulfilled" ? r.value : { kind: "not-available" });
      return {
        kind: "ok",
        origin,
        modes: { walk: value(walk!), bike: value(bike!), car: value(car!), bus: value(bus!) },
        transitDeparture,
        attribution: [ORS_ATTRIBUTION, TRANSITLAND_ATTRIBUTION],
        providerId: "ors-transitland",
        referencePointVersion: REFERENCE_POINT_VERSION,
      };
    },
  };
}
