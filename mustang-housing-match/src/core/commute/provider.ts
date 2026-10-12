import type { Commute, GeoPoint } from "../domain";

/** Looks up a Commute for a street address. Implementations receive `fetch` and never touch Chrome APIs. */
export interface CommuteProvider {
  id: string;
  lookup(address: string, opts: { now: Date }): Promise<Commute>;
}

export type HttpFailureClass = "ok" | "not-found" | "transient";

/** 2xx ok; 429 and 5xx (and auth errors, which nothing about the address caused) transient; other 4xx not-found. */
export function classifyHttpFailure(status: number): HttpFailureClass {
  if (status >= 200 && status < 300) return "ok";
  if (status === 429 || status >= 500 || status === 401 || status === 403 || status === 408) return "transient";
  return "not-found";
}

const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(s));
}

const PACIFIC = "America/Los_Angeles";
const DEPARTURE_HOUR = 8;

interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC,
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pacificParts(d: Date): LocalParts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormatter.formatToParts(d)) p[type] = value;
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
  };
}

/** Offset of the Pacific zone, in minutes east of UTC, at the given instant. */
function pacificOffsetMinutes(at: Date): number {
  const p = pacificParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The next Monday–Friday 08:00 America/Los_Angeles strictly after `now` (today if it is still before 08:00), as ISO 8601 with offset. */
export function nextWeekdayDeparture(now: Date): string {
  const local = pacificParts(now);
  let y = local.year, m = local.month, d = local.day;
  let weekday = local.weekday;
  const departedToday = local.hour >= DEPARTURE_HOUR;
  const isWeekday = (w: number) => w >= 1 && w <= 5;
  if (departedToday || !isWeekday(weekday)) {
    do {
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      y = next.getUTCFullYear(); m = next.getUTCMonth() + 1; d = next.getUTCDate();
      weekday = (weekday + 1) % 7;
    } while (!isWeekday(weekday));
  }
  // Resolve the UTC instant of 08:00 local on that date, iterating once for DST transitions.
  let guess = Date.UTC(y, m - 1, d, DEPARTURE_HOUR, 0);
  for (let i = 0; i < 2; i++) {
    const offset = pacificOffsetMinutes(new Date(guess));
    guess = Date.UTC(y, m - 1, d, DEPARTURE_HOUR, 0) - offset * 60000;
  }
  const offset = pacificOffsetMinutes(new Date(guess));
  const sign = offset <= 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${y}-${pad(m)}-${pad(d)}T${pad(DEPARTURE_HOUR)}:00:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
