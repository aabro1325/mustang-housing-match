---
status: accepted
date: 2026-10-11
---

# Commute lookups use openrouteservice and Transitland, not Google Routes

Feature F3 needs an address geocoded and walk, bike, drive and bus times to the Campus Reference Point, shown to every Member of a Shared List and in the Comparison. Google Routes is the only single provider with all four modes, but Google's Maps Service Specific Terms permit caching geocoded coordinates for at most 30 days, isolated to one End User, and permit no caching of route durations or distances at all. The Shared List stores one Member's Commute for every Member to read, so Google would force a refetch per Member per render and put the pilot at odds with the terms; it also requires a billing account with a payment method and a server-side proxy, since no provider can restrict a key to a `chrome-extension://` origin.

We therefore call openrouteservice (geocoding plus `foot-walking`, `cycling-regular`, `driving-car`; CC-BY-SA 4.0 results, 2,000 directions per day free) and the Transitland Routing API (bus, beta, 1,000 queries per month free) directly from the side panel, with both keys shipped in the bundle. The keys are public by design: the financial exposure is zero and the worst case is quota exhaustion, handled as a transient Commute Failure. Attribution for both providers is shown wherever a Commute appears.

Consequences: a Commute is fetched once per Listing and stored on it indefinitely; bus coverage depends on Transitland's beta, so bus must degrade to Not Available; swapping providers later means a new `CommuteProvider` implementation and a bump of the Campus Reference Point version to flush cached Commutes. Decision record: https://github.com/aabro1325/mustang-housing-match/issues/9
