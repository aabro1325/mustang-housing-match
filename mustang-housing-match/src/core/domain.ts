// Domain types shared by every module. Vocabulary follows CONTEXT.md. Pure data: no Chrome, no classes.

export type Provenance = "Listed" | "NotListed" | "Estimated" | "Corrected";

/** A Listing Fact: a value plus where it came from. NotListed facts carry value null and are never guessed. */
export interface Fact<T> {
  value: T | null;
  provenance: Provenance;
}
export const notListed = <T>(): Fact<T> => ({ value: null, provenance: "NotListed" });
export const listed = <T>(value: T): Fact<T> => ({ value, provenance: "Listed" });
export const corrected = <T>(value: T): Fact<T> => ({ value, provenance: "Corrected" });

export type SourceId = "zillow" | "craigslist" | "apartments" | "redfin" | "text" | "manual";
export type LeaseType = "school-year" | "month-to-month" | "12-month";
export type AmenityId = "parking" | "laundry" | "utilitiesIncluded" | "pets" | "furnished";
export const AMENITIES: AmenityId[] = ["parking", "laundry", "utilitiesIncluded", "pets", "furnished"];
export type RentBasis = "per-unit" | "per-person";

export interface ListingFacts {
  address: Fact<string>;
  /** Monthly rent in dollars, in the Rent Basis. */
  rent: Fact<number>;
  rentBasis: RentBasis;
  bedrooms: Fact<number>;
  bathrooms: Fact<number>;
  leaseType: Fact<LeaseType>;
  amenities: Record<AmenityId, Fact<boolean>>;
  /** One-time amounts in dollars. */
  deposit: Fact<number>;
  applicationFee: Fact<number>;
  /** Monthly amounts in dollars. */
  parkingFee: Fact<number>;
  otherMonthlyFees: Fact<number>;
}

export function emptyFacts(): ListingFacts {
  return {
    address: notListed(),
    rent: notListed(),
    rentBasis: "per-unit",
    bedrooms: notListed(),
    bathrooms: notListed(),
    leaseType: notListed(),
    amenities: { parking: notListed(), laundry: notListed(), utilitiesIncluded: notListed(), pets: notListed(), furnished: notListed() },
    deposit: notListed(),
    applicationFee: notListed(),
    parkingFee: notListed(),
    otherMonthlyFees: notListed(),
  };
}

export interface FloorPlan {
  id: string;
  name: string;
  facts: Partial<Pick<ListingFacts, "rent" | "bedrooms" | "bathrooms" | "deposit" | "leaseType">>;
}

export interface Listing {
  /** Identity: canonical source URL plus Floor Plan id, or the normalised address for Text and Manual Listings. */
  id: string;
  source: SourceId;
  sourceUrl: string | null;
  floorPlanId: string | null;
  title: string;
  facts: ListingFacts;
  /** ISO 8601 */
  capturedAt: string;
}

export type TransportMode = "walk" | "bike" | "bus" | "car";
export const TRANSPORT_MODES: TransportMode[] = ["walk", "bike", "bus", "car"];
export type Priority = "low" | "med" | "high";
export type RoomType = "private" | "shared";
export type Category = "cost" | "commute" | "lease" | "amenities";
export const CATEGORIES: Category[] = ["cost", "commute", "lease", "amenities"];

export interface Preferences {
  /** Per person, per month, dollars. */
  budget: number | null;
  transportMode: TransportMode;
  maxCommuteMinutes: number;
  leaseType: LeaseType;
  roomType: RoomType;
  wantedAmenities: AmenityId[];
  priorities: Record<Category, Priority>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  budget: null,
  transportMode: "bike",
  maxCommuteMinutes: 15,
  leaseType: "school-year",
  roomType: "private",
  wantedAmenities: ["parking", "laundry", "utilitiesIncluded"],
  priorities: { cost: "high", commute: "high", lease: "med", amenities: "low" },
};

const PRIORITY_VALUES: Priority[] = ["low", "med", "high"];
const TRANSPORT_VALUES: TransportMode[] = ["walk", "bike", "bus", "car"];
const LEASE_VALUES: LeaseType[] = ["school-year", "month-to-month", "12-month"];
const ROOM_VALUES: RoomType[] = ["private", "shared"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Stored preferences from older builds can omit nested fields. A shallow spread would leave
 * `priorities.commute` undefined and the scorecard would throw while rendering.
 */
export function mergePreferences(saved: Partial<Preferences> | null | undefined): Preferences {
  const base = DEFAULT_PREFERENCES;
  if (!saved || typeof saved !== "object") return { ...base, priorities: { ...base.priorities }, wantedAmenities: [...base.wantedAmenities] };
  const incoming = (saved.priorities ?? {}) as Partial<Preferences["priorities"]>;
  const budget =
    saved.budget === null ? null
    : typeof saved.budget === "number" && Number.isFinite(saved.budget) && saved.budget > 0 ? saved.budget
    : base.budget;
  const maxCommuteMinutes =
    typeof saved.maxCommuteMinutes === "number" && Number.isFinite(saved.maxCommuteMinutes) && saved.maxCommuteMinutes > 0
      ? saved.maxCommuteMinutes
      : base.maxCommuteMinutes;
  const wantedAmenities = Array.isArray(saved.wantedAmenities)
    ? saved.wantedAmenities.filter((a): a is AmenityId => (AMENITIES as readonly string[]).includes(a))
    : [...base.wantedAmenities];
  return {
    budget,
    transportMode: oneOf(saved.transportMode, TRANSPORT_VALUES, base.transportMode),
    maxCommuteMinutes,
    leaseType: oneOf(saved.leaseType, LEASE_VALUES, base.leaseType),
    roomType: oneOf(saved.roomType, ROOM_VALUES, base.roomType),
    wantedAmenities,
    priorities: {
      cost: oneOf(incoming.cost, PRIORITY_VALUES, base.priorities.cost),
      commute: oneOf(incoming.commute, PRIORITY_VALUES, base.priorities.commute),
      lease: oneOf(incoming.lease, PRIORITY_VALUES, base.priorities.lease),
      amenities: oneOf(incoming.amenities, PRIORITY_VALUES, base.priorities.amenities),
    },
  };
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export type ModeResult = { kind: "ok"; minutes: number; miles: number } | { kind: "not-available" };

/** The Commute, or why there is none. referencePointVersion flushes caches when the Campus Reference Point moves. */
export type Commute =
  | {
      kind: "ok";
      origin: GeoPoint;
      modes: Record<TransportMode, ModeResult>;
      /** ISO 8601 departure used for the bus itinerary (next weekday 08:00 Pacific). */
      transitDeparture: string;
      attribution: string[];
      providerId: string;
      referencePointVersion: number;
    }
  | { kind: "address-not-found"; referencePointVersion: number }
  | { kind: "transient-failure"; message: string; referencePointVersion: number };

export type Status = "saved" | "considering" | "tour-scheduled" | "applied" | "rejected" | "selected";
export const STATUSES: Status[] = ["saved", "considering", "tour-scheduled", "applied", "rejected", "selected"];

export interface Note {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface FitScoreEntry {
  score: number;
  computedAt: string;
}

export interface SavedListing {
  id: string;
  listing: Listing;
  commute: Commute | null;
  status: Status;
  finalist: boolean;
  /** ISO 8601 or null */
  tourAt: string | null;
  landlordQuestions: string[];
  notes: Note[];
  /** Keyed by Member identity id. */
  fitScores: Record<string, FitScoreEntry>;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
