import type { Commute, GeoPoint, ModeResult, TransportMode } from "../../core/domain";
import { CAMPUS_REFERENCE_POINT, REFERENCE_POINT_VERSION } from "../../core/commute/referencePoint";
import { haversineMiles, nextWeekdayDeparture, type CommuteProvider } from "../../core/commute/provider";

const ROAD_FACTOR = 1.3;
const SPEEDS_MPH: Record<Exclude<TransportMode, "bus">, number> = { walk: 3, bike: 10, car: 25 };
const CAR_PARKING_MINUTES = 3;

/** Real San Luis Obispo street addresses with approximate coordinates; "1 nowhere lane" deliberately fails. */
const GEOCODES: Record<string, GeoPoint> = {
  "870 foothill blvd": { lat: 35.2962, lon: -120.6698 },
  "124 hathway ave": { lat: 35.2977, lon: -120.6618 },
  "1150 chorro st": { lat: 35.2804, lon: -120.6631 },
  "1453 lizzie st": { lat: 35.2721, lon: -120.6489 },
  "1 grand ave": { lat: 35.3004, lon: -120.6580 },
  "555 ramona dr": { lat: 35.2983, lon: -120.6735 },
  "1050 foothill blvd": { lat: 35.2965, lon: -120.6730 },
  "790 santa rosa st": { lat: 35.2796, lon: -120.6617 },
  "1234 monterey st": { lat: 35.2843, lon: -120.6572 },
  "2 tank farm rd": { lat: 35.2475, lon: -120.6577 },
  "3100 broad st": { lat: 35.2607, lon: -120.6530 },
  "1 mustang way": { lat: 35.3086, lon: -120.6610 },
  "610 california blvd": { lat: 35.2865, lon: -120.6610 },
};

/** Lowercase, strip punctuation, keep only the house number and street (drop city, state, zip after the first comma). */
export function normalizeFixtureAddress(address: string): string {
  const street = address.split(",")[0] ?? address;
  return street.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function mode(miles: number, mph: number, extraMinutes = 0): ModeResult {
  return { kind: "ok", minutes: Math.round((miles / mph) * 60) + extraMinutes, miles: Math.round(miles * 100) / 100 };
}

export function fixtureCommuteProvider(referencePoint: GeoPoint = CAMPUS_REFERENCE_POINT): CommuteProvider {
  return {
    id: "fixture",
    async lookup(address, { now }): Promise<Commute> {
      const origin = GEOCODES[normalizeFixtureAddress(address)];
      if (!origin) return { kind: "address-not-found", referencePointVersion: REFERENCE_POINT_VERSION };
      const miles = haversineMiles(origin, referencePoint) * ROAD_FACTOR;
      const car = mode(miles, SPEEDS_MPH.car, CAR_PARKING_MINUTES);
      const bus: ModeResult = car.kind === "ok" ? { kind: "ok", minutes: car.minutes * 2 + 10, miles: car.miles } : { kind: "not-available" };
      return {
        kind: "ok",
        origin,
        modes: { walk: mode(miles, SPEEDS_MPH.walk), bike: mode(miles, SPEEDS_MPH.bike), car, bus },
        transitDeparture: nextWeekdayDeparture(now),
        attribution: ["Fixture data (no live lookup)"],
        providerId: "fixture",
        referencePointVersion: REFERENCE_POINT_VERSION,
      };
    },
  };
}
