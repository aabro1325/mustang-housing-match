// The Figma's three demo listings, "Maya" preferences, and fixture Commutes. Used by tests and the fixture demo.
import { emptyFacts, listed, type Commute, type Listing, type ListingFacts, type Preferences } from "./domain";

export const CAPTURED_AT = "2026-10-12T15:00:00.000Z";
export const TRANSIT_DEPARTURE = "2026-10-13T15:00:00.000Z"; // Tuesday 08:00 Pacific
export const FIXTURE_ATTRIBUTION = ["Fixture commute data (straight-line estimates)"];

export const MAYA: Preferences = {
  budget: 1450,
  transportMode: "bike",
  maxCommuteMinutes: 15,
  leaseType: "school-year",
  roomType: "private",
  wantedAmenities: ["parking", "laundry", "utilitiesIncluded"],
  priorities: { cost: "high", commute: "high", lease: "med", amenities: "low" },
};

function foothillFacts(): ListingFacts {
  const f = emptyFacts();
  f.address = listed("870 Foothill Blvd, San Luis Obispo, CA 93405");
  f.rent = listed(1250);
  f.rentBasis = "per-person";
  f.bedrooms = listed(3);
  f.bathrooms = listed(2);
  f.leaseType = listed("12-month");
  f.amenities.parking = listed(true);
  f.amenities.laundry = listed(true);
  f.amenities.pets = listed(false);
  return f;
}

function hathwayFacts(): ListingFacts {
  const f = emptyFacts();
  f.address = listed("124 Hathway Ave, San Luis Obispo, CA 93405");
  f.rent = listed(1320);
  f.rentBasis = "per-person";
  f.bedrooms = listed(4);
  f.bathrooms = listed(2);
  f.leaseType = listed("school-year");
  f.amenities.parking = listed(true);
  f.amenities.laundry = listed(true);
  f.amenities.utilitiesIncluded = listed(true);
  f.amenities.pets = listed(false);
  f.amenities.furnished = listed(false);
  return f;
}

function chorroFacts(): ListingFacts {
  const f = emptyFacts();
  f.address = listed("1150 Chorro St, San Luis Obispo, CA 93401");
  f.rent = listed(1120);
  f.rentBasis = "per-person";
  f.bedrooms = listed(2);
  f.bathrooms = listed(2);
  f.leaseType = listed("12-month");
  f.parkingFee = listed(60);
  f.amenities.parking = listed(true);
  f.amenities.laundry = listed(true);
  f.amenities.pets = listed(true);
  f.amenities.furnished = listed(true);
  return f;
}

export const FOOTHILL: Listing = {
  id: "https://www.zillow.com/homedetails/870-foothill-blvd-san-luis-obispo-ca-93405/000000001_zpid",
  source: "zillow",
  sourceUrl: "https://www.zillow.com/homedetails/870-foothill-blvd-san-luis-obispo-ca-93405/000000001_zpid/",
  floorPlanId: null,
  title: "870 Foothill Blvd",
  facts: foothillFacts(),
  capturedAt: CAPTURED_AT,
};

export const HATHWAY: Listing = {
  id: "address:124 hathway ave",
  source: "text",
  sourceUrl: null,
  floorPlanId: null,
  title: "124 Hathway Ave",
  facts: hathwayFacts(),
  capturedAt: CAPTURED_AT,
};

export const CHORRO: Listing = {
  id: "https://www.apartments.com/1150-chorro-st-san-luis-obispo-ca/abc1234",
  source: "apartments",
  sourceUrl: "https://www.apartments.com/1150-chorro-st-san-luis-obispo-ca/abc1234/",
  floorPlanId: null,
  title: "1150 Chorro St",
  facts: chorroFacts(),
  capturedAt: CAPTURED_AT,
};

function commute(lat: number, lon: number, walk: number, bike: number, bus: number, car: number, miles: number): Commute {
  return {
    kind: "ok",
    origin: { lat, lon },
    modes: {
      walk: { kind: "ok", minutes: walk, miles },
      bike: { kind: "ok", minutes: bike, miles },
      bus: { kind: "ok", minutes: bus, miles },
      car: { kind: "ok", minutes: car, miles },
    },
    transitDeparture: TRANSIT_DEPARTURE,
    attribution: FIXTURE_ATTRIBUTION,
    providerId: "fixture",
    referencePointVersion: 1,
  };
}

export const FOOTHILL_COMMUTE: Commute = commute(35.3015, -120.6718, 24, 9, 18, 6, 1.2);
export const HATHWAY_COMMUTE: Commute = commute(35.2985, -120.6626, 16, 6, 14, 4, 0.8);
export const CHORRO_COMMUTE: Commute = commute(35.2838, -120.6598, 38, 16, 22, 9, 1.9);

export const DEMO_LISTINGS = [
  { listing: FOOTHILL, commute: FOOTHILL_COMMUTE },
  { listing: HATHWAY, commute: HATHWAY_COMMUTE },
  { listing: CHORRO, commute: CHORRO_COMMUTE },
] as const;
