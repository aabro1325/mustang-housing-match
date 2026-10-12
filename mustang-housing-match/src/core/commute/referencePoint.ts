import type { GeoPoint } from "../domain";

/** Robert E. Kennedy Library, 1 Grand Avenue, Building 35 (OSM relation 2806804 centroid). One point for every Transport Mode. */
export const CAMPUS_REFERENCE_POINT: GeoPoint = { lat: 35.30186, lon: -120.66407 };

/** Bump when the Campus Reference Point moves; cached Commutes carrying another version are ignored. */
export const REFERENCE_POINT_VERSION = 1;
