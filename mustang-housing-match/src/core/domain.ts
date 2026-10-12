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

export type SourceId = "zillow" | "craigslist" | "apartments" | "text" | "manual";
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
