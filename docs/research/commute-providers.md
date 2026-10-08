# Commute data providers for walk, bike, drive and transit from an extension

Research for issue #4 (part of #1). Feature F3 needs a Listing's street address geocoded and a Commute computed to the Campus Reference Point: distance in miles plus walking, biking, driving and public-transit times, called from a Chrome MV3 side-panel extension.

Date of research: 2026-10-07. Every claim links to the official page it comes from. Where a figure could only be read from a JavaScript-rendered page that our fetcher could not render, the row says so and the figure is marked **(unverified)**. "Probe" means a live HTTP request made on the research date from this repo (see "Live probes" below); probes are observations, not documentation, and can change.

## Recommendation

**(a) Most modes with no billing: openrouteservice (walk + bike + drive + geocoding) and the Transitland Routing API (bus).**
No provider covers all four modes without a billing account. openrouteservice gives distinct walking, cycling and driving profiles plus Pelias geocoding on a free key with no payment details collected, at 2,000 directions and 1,000 geocodes per day ([plans](https://account.heigit.org/info/plans), figures unverified, see row). The Transitland Routing API is the only no-billing transit planner found that already ingests both SLO Transit and SLO RTA GTFS feeds; its beta plan includes 1,000 free transit routes per month ([Transitland Routing API](https://www.transit.land/documentation/routing-api/)). The OSRM demo at `routing.openstreetmap.de` (car, bike, foot, no key) is a usable fallback for walk/bike/drive but carries a 1 request/second cap and no guarantees, and `router.project-osrm.org` ignores the profile (probe below). Nominatim can geocode without a key under its 1 req/s policy.

**(b) Best option with a small budget: Google Routes API (Compute Routes) plus Google Geocoding API, behind a thin proxy.**
It is the only single provider with WALK, BICYCLE, DRIVE and TRANSIT ([RouteTravelMode](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode)), and both SLO Transit and SLO RTA point riders at Google's trip planner, so TRANSIT results exist for SLO. Each SKU gets 10,000 free events per month, then $5.00 per 1,000 ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)); one Listing costs 1 geocode + 4 route requests, so roughly 2,500 Listings per month are free and 10,000 Listings per month would cost about $150. It needs a billing-enabled Cloud project ([get started](https://developers.google.com/maps/get-started)) and the key must not ship in the bundle: Google lists Routes and Geocoding under IP-address restrictions and says non-http(s) referrer schemes are not supported ([API security best practices](https://developers.google.com/maps/api-security-best-practices)), so the extension should call a small proxy (any free serverless tier) that holds the key and enforces a daily cap.

Second choice with a budget: HERE (Routing v8 has pedestrian, bicycle, car; a separate Public Transit API v8 does transit; Geocoding included), but the Base plan requires a payment method at onboarding and the per-service free bands could not be captured from the JS-rendered pricing page.

## Comparison table

Modes: W = walk, B = bike, D = drive, T = public transit. "Direct from extension" combines the documented position and the CORS probe; with `host_permissions` an MV3 extension page or service worker can fetch cross-origin regardless of CORS ([Chrome: network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)).

| Provider | Modes | Geocoding | Free tier | Card / billing account | Direct from extension (CORS probe) | Key restriction options | Key baked into bundle exposes |
|---|---|---|---|---|---|---|---|
| Google Routes API + Geocoding API | W, B, D, T (also TWO_WHEELER, TRUCK). WALK/BICYCLE are beta; app must show a warning [^g-modes] | Yes, separate Geocoding API [^g-geo] | 10,000 free events/month per Essentials SKU (Compute Routes, Geocoding), 5,000 Pro, 1,000 Enterprise; then $5.00/1,000 Essentials [^g-price] | Billing-enabled Cloud project required; billing account needs a Google payments profile (card validity hold mentioned); $300 new-customer trial credit [^g-bill] | Probe: `routes.googleapis.com` answers preflight and echoes `chrome-extension://…` in `Access-Control-Allow-Origin`; `maps.googleapis.com` geocode returns `*`. Docs recommend a proxy where no client SDK exists [^g-sec] | Websites (HTTP referrer), IP, Android, iOS; Routes and Geocoding are listed under IP restrictions; "Exotic URI schemes are not supported" for non-JS APIs; `chrome-extension://` not mentioned anywhere [^g-sec] [^gcp-keys] | A web-service key Google says must "remain a shared secret"; anyone can bill your account up to your quota [^g-sec] |
| Google Distance Matrix API (Legacy) | W, B, D, T | No | 10,000 free elements/month then $5.00/1,000 [^g-price] | Same as above | n/a | Same as above | Same as above. **Excluded:** "As of October 2026, Distance Matrix API (Legacy) can no longer be enabled for new Google Cloud projects" [^g-dm] |
| Mapbox Directions + Geocoding v6 | W, B, D (`walking`, `cycling`, `driving`, `driving-traffic`). **No transit** [^mb-dir] | Yes; Temporary (cannot be cached) or Permanent (needs card on file) [^mb-geo] | With card: Directions 100,000 req/month then $2.00/1,000; Temporary Geocoding 100,000/month then $0.75/1,000. Without card (trial): Directions 10,000/month, Temporary Geocoding 10,000/month [^mb-price] [^mb-signup] | Card optional: "quick sign-up without a credit card" with trial limits; card "removes the usage limits" [^mb-signup] | Probe: `api.mapbox.com` returns `Access-Control-Allow-Origin: *`. Public tokens "can be safely exposed in web browsers, mobile apps, and other client environments" [^mb-tok2] | URL restrictions on `pk` tokens (domain, protocol, port, path; no wildcards); "best-effort"; fail for requests without a Referer and for "browsers or extensions with privacy blocking"; non-http schemes not addressed [^mb-tok] | A `pk` token is designed to be public, but an unrestricted one lets anyone spend your 100k/month and your card beyond it [^mb-tok] |
| openrouteservice (HeiGIT) | W, B, D (+ hgv, several cycling, hiking, wheelchair). `public-transport` exists only as an experimental self-hosted profile; the public API advertises cars, trucks, bikes, walking, hiking, wheelchair [^ors-prof] [^ors-home] | Yes, Pelias geocoding [^ors-home] | **(unverified, JS page)** Directions 2,000/day and 40/min; Geocoding 1,000/day and 100/min; Isochrones 500/day confirmed on homepage; Collaborative plan (academic etc.) 10,000/day [^ors-plans] [^ors-home] | No payment details collected; signup is "register for a token" [^ors-js] | Probe: preflight 204 with `Access-Control-Allow-Origin: *`; official JS client ships browser examples [^ors-js] | None documented | Shared daily quota for every user of the extension; anyone can exhaust it |
| OSRM public demo (`router.project-osrm.org`, `routing.openstreetmap.de`) | D, B, W via separate `routed-car`, `routed-bike`, `routed-foot` services on `routing.openstreetmap.de`. Probe: `router.project-osrm.org` returned identical car results for `/foot` and `/bike` [^osrm-wiki] | No (`nearest` snaps coordinates only) [^osrm-api] | No key; "Do not exceed 1 request per second"; "reasonable, non-commercial use-cases"; no uptime/latency guarantees [^osrm-wiki] [^fossgis] | None | Probe: `Access-Control-Allow-Origin: *` on both hosts | None (no key) | Nothing to expose; but the whole user base shares the 1 req/s expectation |
| GraphHopper Directions API | D, B, W (profiles table includes car, small_truck, truck, scooter, foot, hike, bike, mtb, racingbike); free plan has "a limited set of vehicle profiles" (docs text indexed by search says car, bike, foot; **unverified**, docs site is JS). No transit [^gh-price] [^gh-prof] | Yes, 0.3 credits/request (default provider) [^gh-credit] | 500 credits/day; a route with 2–10 locations = 1 credit; "non-commercial use only"; "does not include any guarantees" [^gh-price] [^gh-credit] | "No credit card required" [^gh-price] | Probe: `Access-Control-Allow-Origin: *` | Key is a `key` query parameter; IP restriction exists only for GraphHopper Maps and API examples, not the Directions API [^gh-forum] | Shared 500 credits/day; abuse drains it |
| HERE Routing v8 + Public Transit v8 + Geocoding | Routing v8 `transportMode`: car, truck, pedestrian, bicycle, scooter, taxi, bus, privateBus, networkRestrictedTruck. Transit is a separate Public Transit API v8 (`transit.router.hereapi.com/v8/routes`) [^here-modes] [^here-pt] | Yes (Geocoding & Search) | **(unverified, JS page)** per-service free bands on the pricing page; Base plan is pay-as-you-grow and "users will not be charged unless they exceed the free tier of any Platform Resource" [^here-blog] [^here-price] | Yes: "The Base plan requires entering a payment method during the onboarding process"; the no-card Limited Plan was decommissioned 2025-03-27 [^here-rn] | Probe: echoes `chrome-extension://…` in `Access-Control-Allow-Origin` on router and geocode hosts | "Trusted domains" (domain names or IPv4, optional protocol/port, up to 20) per key; two keys per app; `chrome-extension://` not documented [^here-keys] | Pay-as-you-go key: abuse becomes charges on the payment method |
| Transitland (Interline) | T + walking only (Routing API, beta) [^tl-route] | No | Free plan: REST 10,000 req/month, Routing 1,000 queries/month, no GraphQL; Professional $200–250/month [^tl-plans] | Not stated; sign up with an Interline account and "get started using your new API key at the Free plan rates" [^tl-docs] | Probe: `Access-Control-Allow-Origin: *` and `apikey` in allowed headers on REST and routing endpoints | None documented | Shared 1,000 routes/month |
| SLO Transit / SLO RTA GTFS feeds (direct) | T (schedule data only; you would implement the trip planner) | No | Free downloads from the Connexionz producer URLs [^tl-slo] [^tl-rta] | None | Feeds are plain zip files; a GTFS planner in an extension is significant work | n/a | n/a |
| Nominatim (OSM) | Geocoding only | Yes | No key; "absolute maximum of 1 request per second"; must send identifying User-Agent or Referer; no autocomplete; "very limited capacity" [^nominatim] | None | Probe: `Access-Control-Allow-Origin: *` | None | Nothing to expose |

## Provider notes

### Google Maps Platform (Routes, Geocoding, Distance Matrix)

- Modes: `RouteTravelMode` is `DRIVE`, `BICYCLE`, `WALK`, `TWO_WHEELER`, `TRUCK`, `TRANSIT`; `WALK`, `BICYCLE` and `TWO_WHEELER` routes are beta and apps "must display a warning to users" [^g-modes]. Transit requests set `travelMode: "TRANSIT"`, support no intermediate waypoints, default `departureTime` to now, and accept `allowedTravelModes` (BUS, SUBWAY, TRAIN, LIGHT_RAIL, RAIL) and `routingPreference` (LESS_WALKING, FEWER_TRANSFERS) [^g-transit].
- Request shape: key in the `X-Goog-Api-Key` header; `X-Goog-FieldMask` is required or the call errors; requesting fewer fields "helps to avoid unnecessary processing time and billed charges" [^g-req] [^g-mask].
- Pricing: Compute Routes Essentials and Geocoding each have 10,000 free events per month, then $5.00 per 1,000 up to 100,000. Pro ($10.00/1,000, 5,000 free) is triggered by features like `TRAFFIC_AWARE`; transit is not listed as a SKU trigger [^g-price] [^g-usage]. Budget sketch: 1 geocode + 4 routes per Listing means ~2,500 Listings/month at $0; 10,000 Listings/month is 40,000 routes (30,000 billable, $150) and 10,000 geocodes ($0).
- Billing: "To start using Google Maps Platform, you must create a billing-enabled Cloud project"; eligible new customers get a $300 trial credit [^g-bill]. Creating a Cloud Billing account requires a Google payments profile and may place "a temporary pre-authorization hold" to validate the card [^gcp-bill].
- Distance Matrix (Legacy) is excluded: "As of October 2026, Distance Matrix API (Legacy) can no longer be enabled for new Google Cloud projects" [^g-dm]. Routes API also has Compute Route Matrix at the same price, billed per element [^g-usage].
- Key restrictions: application restrictions are Websites, IP addresses, Android apps, iOS apps. Routes API and Geocoding API are listed under IP-address restriction. "The universally supported referrer URI schemes are https and http"; for Maps Platform APIs other than the JavaScript API "Exotic URI schemes are not supported." Web-service keys "should remain a shared secret"; where no client SDK exists, "use a proxy server that requires authentication" [^g-sec]. The Google Cloud API-key docs likewise describe only http(s) referrers and do not mention browser extensions [^gcp-keys]. Conclusion: a Routes key cannot be meaningfully restricted to `chrome-extension://<id>`, so it must live in a proxy.
- Policies: attribution (the Google logo "whenever possible") is required when results are not displayed on a Google Map; "Routes API results displayed on a map must be shown on a Google Map"; caching of most Routes content is restricted (place IDs may be stored) [^g-pol]. Showing travel times as text in the Scorecard with attribution is compatible; caching Commute results per Listing needs a look at the Maps service terms.
- Transit coverage in SLO: the City's SLO Transit page lists a "Google Trip Planner" option (page refused automated fetching; title and summary from the search index) [^slo-transit], and the RTA FAQ says the RTA home page has a "Google Transit Trip Planner" that covers "all of the SLO County systems" [^rta-faq].

### Mapbox (Directions, Geocoding v6)

- Profiles: `mapbox/driving-traffic`, `mapbox/driving`, `mapbox/walking`, `mapbox/cycling`; no transit profile; 300 requests/minute; 25 waypoints [^mb-dir].
- Geocoding v6 forward endpoint `GET /search/geocode/v6/forward?q=…`; temporary results "are not allowed to be cached"; `permanent=true` requires a card on file or an enterprise contract; 1,000 req/min default [^mb-geo].
- Pricing: Directions 100,000 requests/month free then $2.00/1,000; Temporary Geocoding 100,000/month free then $0.75/1,000; Permanent Geocoding $5.00/1,000 with no free tier; Matrix 100,000 elements/month free [^mb-price].
- Signup: "You can complete a quick sign-up without a credit card and get access to Mapbox services with trial limits"; trial limits include Directions 10,000 requests/month and Temporary Geocoding 10,000 requests/month; "Adding a payment method removes the usage limits" [^mb-signup].
- Tokens: public `pk` tokens "can be safely exposed in web browsers, mobile apps, and other client environments" [^mb-tok2]. URL restrictions accept domain, domain:port, protocol+domain, subdomain, path and query forms; wildcards and IPs are unsupported; the default token cannot be restricted; restrictions are "a best-effort mitigation technique" and do not work for requests without a Referer or from "browsers or extensions with privacy blocking" [^mb-tok]. Non-http schemes are not addressed, so treat `chrome-extension://` as unsupported until tested.

### openrouteservice (HeiGIT)

- Profiles in the engine configuration docs: `driving-car`, `driving-hgv`, `cycling-regular`, `cycling-mountain`, `cycling-road`, `cycling-electric`, `foot-walking`, `foot-hiking`, `wheelchair`, `public-transport` (experimental) [^ors-prof]. The public site advertises routing for "cars, trucks, several bike profiles, walking, hiking, and wheelchair" and Pelias geocoding, with no transit mention [^ors-home]. Treat transit as unavailable on the hosted API.
- Quotas: the plans page redirects to `account.heigit.org/info/plans`, which renders client-side; the figures indexed from it are Directions 2,000/day and 40/min, Geocoding 1,000/day and 100/min, with a Collaborative plan (humanitarian, academic, governmental, non-profit; no commercial use) at 10,000/day [^ors-plans]. The homepage confirms "Request up to 500 Isochrones per day for free" [^ors-home]. Verify the numbers in a browser before relying on them. The daily quota is per key, so one bundled key is shared by every user: 2,000 directions/day is about 666 Listings/day at three modes each.
- Browser use: the official `openrouteservice-js` README has "Use the distribution file directly in html" and a browser example; "you have to register for a token at openrouteservice" [^ors-js]. Probe: `OPTIONS /v2/directions/foot-walking` returned 204 with `Access-Control-Allow-Origin: *`.

### OSRM public demo server

- The osrm-backend wiki names `router.project-osrm.org` and `routing.openstreetmap.de`, sponsored by FOSSGIS, serving worldwide car, foot and bike profiles; "Do not exceed 1 request per second"; "reasonable, non-commercial use-cases"; no guarantees for uptime, latency or data updates [^osrm-wiki]. The FOSSGIS about page adds: show attribution, send a valid User-Agent, "One request per second max", no scraping or heavy usage, data updated roughly every two days [^fossgis].
- The HTTP API is `GET /route/v1/{profile}/{lon,lat;lon,lat}`; the mode is fixed by the Lua profile the server was built with, so the `{profile}` segment does not switch modes on a single-profile server; the `table` service returns `durations` (s) and `distances` (m) [^osrm-api].
- Probe (downtown SLO 35.2828,-120.6600 to Kennedy Library 35.3019,-120.6630): `router.project-osrm.org` returned 3,295 m / 347 s for `driving`, `foot` and `bike` alike (profile ignored). `routing.openstreetmap.de/routed-car` 3,295 m / 347 s; `routed-bike` 2,988 m / 760 s; `routed-foot` 2,800 m / 2,241 s. All responses carried `Access-Control-Allow-Origin: *`. Use the `routed-*` hosts if OSRM is used at all.
- No geocoding; pair with Nominatim (1 req/s, identifying User-Agent/Referer, no autocomplete, "you might have your access withdrawn") [^nominatim].

### GraphHopper Directions API

- Pricing page: Free plan 500 credits/day; "The Free Plan is for non-commercial use only"; "It has a limited credit count per minute, a limited set of vehicle profiles"; "The Free Plan does not include any guarantees"; "No credit card required"; paid plans from 69 EUR/month (5,000 credits/day) [^gh-price].
- Credits: "A standard Routing API request with 2 to 10 locations costs 1 credit"; geocoding 0.3 credits with the default provider [^gh-credit]. So 500 credits is about 160 Listings/day at three modes plus a geocode.
- Profiles: the docs' profile table includes car (and avoid variants), small_truck, truck, scooter, foot, hike, bike, mtb, racingbike; the docs text that "The free package supports only car, bike and foot" appears in search-indexed copies of the docs, which render client-side and could not be captured directly [^gh-prof]. No public-transit profile in the Directions API.
- Keys: passed as the `key` query parameter; a 2019 GraphHopper forum announcement describes IP restrictions that "do not apply to the general Directions API! It applies to the API examples and GraphHopper Maps", and notes GraphHopper has not adopted request signing to avoid exposing the key [^gh-forum].

### HERE

- Routing API v8 `GET https://router.hereapi.com/v8/routes` with required `transportMode` enum car, truck, pedestrian, bicycle, scooter, taxi, bus, privateBus, networkRestrictedTruck; auth via `apiKey` query parameter [^here-modes]. Public transit is a separate Public Transit API v8 (Routing, Next Departures, Station Search) at `transit.router.hereapi.com/v8/routes` with `origin`/`destination` in `lat,lng` [^here-pt] [^here-pt2].
- Billing: "Effective March 27, the HERE Limited Plan has been officially decommissioned for new customers… The Base plan requires entering a payment method during the onboarding process" [^here-rn]; "The Base Plan requires a credit card during registration, but users will not be charged unless they exceed the free tier of any Platform Resource" [^here-blog]. The per-service free bands and per-1,000 prices live on `here.com/get-started/pricing`, which is rendered by a pricing-calculator script our fetcher could not execute; read it in a browser before budgeting [^here-price].
- Keys: up to two API keys per app; "trusted domains" restriction (domain names or IPv4 addresses, optional protocol and port, up to 20 via the UI); changes take up to 30 minutes [^here-keys]. Nothing about extension schemes.

### Transit data for San Luis Obispo

- Transitland lists four operators for San Luis Obispo, including City of San Luis Obispo Transit (`o-9q60w-cityofsanluisobispotransit`) and SLORTA (`o-9q6-sanluisobisporegionaltransitauthority`) [^tl-place].
- SLO Transit static GTFS: feed `f-9q60w-cityofsanluisobispotransit`, producer URL `https://slocity.connexionz.net/rtt/public/resource/gtfs.zip`, active version fetched 2026-10-02; a GTFS-Realtime feed `f-9q60w-cityofsanluisobispotransit~rt` is registered [^tl-slo] [^tl-slo-op].
- SLO RTA static GTFS: feed `f-9q6-sanluisobisporegionaltransitauthority~pasoroblesexpress~so`, producer URL `http://slo.connexionz.net/rtt/public/resource/gtfs.zip` (publisher Connexionz Ltd), last version 2026-09-17; realtime feed `…~rt` registered [^tl-rta] [^tl-rta-op].
- Transitland Routing API: `GET/POST https://transit.land/api/v2/routing/otp/plan` with required `fromPlace`, `toPlace` (lat,lon), `date`, `time`; transit and walking only; `plan.itineraries[].duration` in seconds; beta, "may intentionally be slowed or rate limited"; 1,000 free routing queries per month; walking speed fixed at 1.0 m/s; no GTFS-Realtime [^tl-route]. Free plan also gives 10,000 REST requests/month; Professional is $200/month prepaid annually or $250 monthly [^tl-plans]. Neither feed is licensed on Transitland's pages; the structured data points to Transitland's terms, and the free plan requires linking to them [^tl-plans].
- Computing bus times directly from GTFS inside the extension would mean downloading two zips, parsing stop_times and implementing a time-dependent planner; feasible but much more work than one API call. Keep as a fallback only if Transitland's beta changes terms.

## Calling providers from a Chrome MV3 extension

- Cross-origin access: an extension can `fetch()` any origin matched by `host_permissions` "from the extension service worker and extension pages" [^chrome-perm]; such requests are treated as cross-origin unless host permissions are declared, and content scripts are limited to what the host page could fetch [^chrome-net] [^chromium-cors]. The side panel is an extension page, so with `host_permissions` it needs no CORS headers at all. Every provider probed also sends permissive CORS headers (`*` or an echo of the `chrome-extension://` origin), so calls would even work without host permissions.
- Referrer/origin restriction: no provider documents `chrome-extension://` as an allowed referrer. Google says exotic schemes are unsupported and lists Routes/Geocoding under IP restrictions [^g-sec]; Mapbox URL restrictions require a Referer and documented http(s) forms [^mb-tok]; HERE trusted domains are domain names or IPv4 [^here-keys]; GraphHopper, openrouteservice and Transitland offer no origin restriction at all. An extension page's origin is `chrome-extension://<id>`, not an http(s) site, so referrer-based locks built for websites are not an option here.
- What a bundled key exposes: a CRX is a header followed by "The ZIP archive" [^crx3], so any user can unzip the extension and read the key. For Google and HERE that is a key tied to a payment method; for the free-tier providers it is a per-key daily quota shared by every installed copy. Chrome's own guidance is to keep secrets out of content scripts and do sensitive work in the service worker [^chrome-sec], which does not stop extraction from the package. Mapbox `pk` tokens are the one credential designed for client exposure [^mb-tok2], but Mapbox lacks transit.
- Practical consequence for F3: (1) with the no-billing stack, accept that the key is public and set the lowest-privilege scopes available, monitor the dashboard, and rotate; (2) with Google or HERE, put the key behind a proxy that enforces a daily cap and only accepts the two request shapes the extension needs; (3) cache each Listing's Commute locally so a Listing is geocoded and routed once per Campus Reference Point (check Google's caching terms first [^g-pol]).

## Campus Reference Point candidates

Coordinates are WGS-84 (latitude, longitude). OSM centroids were read through Nominatim on 2026-10-07; element tags were confirmed on the OSM API.

| Candidate | Lat, Lon | Source |
|---|---|---|
| Robert E. Kennedy Library (Building 35, 1 Grand Ave) | 35.30186, -120.66407 (OSM relation 2806804 centroid); 35.30194, -120.66382 (Wikidata Q7343808) | [OSM relation 2806804](https://www.openstreetmap.org/relation/2806804) (`amenity=library`, `name=Robert E. Kennedy Library`, `addr:housenumber=35`, `wikidata=Q7343808`); [Wikidata Q7343808](https://www.wikidata.org/wiki/Q7343808) P625; Cal Poly address 1 Grand Avenue, Building 35 [^lib-addr] |
| Dexter Lawn | 35.30060, -120.66329 (OSM way 31274589 centroid) | [OSM way 31274589](https://www.openstreetmap.org/way/31274589) (`leisure=park`, `name=Dexter Lawn`); named on Cal Poly Facilities campus map [^polymap] |
| Grand Avenue main entrance (stop sign on Grand Ave at the campus edge) | 35.30043, -120.65799 (OSM node 6634235252, `highway=stop`) | [OSM node 6634235252](https://www.openstreetmap.org/node/6634235252); Cal Poly: "We recommend entering campus via the Grand Avenue entrance" [^cp-visit]; "Continue up Grand Avenue to the stop sign at the Main Entrance" [^cp-pac] |

Spread (great-circle): Library to Dexter Lawn 157 m; Library to Grand Ave entrance 574 m; Dexter Lawn to entrance 481 m. All three are within 0.36 mi of each other, so the choice barely moves a distance-in-miles figure but does move walking time by up to ~7 minutes. Suggested default: Kennedy Library, because it is a named, addressable building at the academic core with stable OSM and Wikidata identifiers; the Grand Avenue stop sign is better for a drive-and-park Commute. The decision belongs to the map issue (#1), not this ticket.

## Live probes (2026-10-07)

All probes sent `Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop` from this machine with no credentials unless noted.

| Endpoint | Status | `Access-Control-Allow-Origin` |
|---|---|---|
| `routes.googleapis.com/directions/v2:computeRoutes` (POST, no key) | 403 | echoes the extension origin; preflight 200 |
| `maps.googleapis.com/maps/api/geocode/json` (no key) | 200 (REQUEST_DENIED body) | `*` |
| `api.mapbox.com/directions/v5/mapbox/walking/…?access_token=pk.bogus` | 401 | `*` |
| `api.mapbox.com/search/geocode/v6/forward?…&access_token=pk.bogus` | 401 | `*` |
| `api.openrouteservice.org/v2/directions/foot-walking` (OPTIONS) | 204 | `*` |
| `graphhopper.com/api/1/route` (no key) | 401 | `*` |
| `router.hereapi.com/v8/routes` (no key) | 401 | echoes the extension origin |
| `geocode.search.hereapi.com/v1/geocode?apiKey=bogus` | 401 | echoes the extension origin |
| `transit.land/api/v2/rest/feeds` and `/api/v2/routing/otp/plan` (no key) | 401 | `*` (`apikey` allowed header) |
| `router.project-osrm.org/route/v1/{driving,foot,bike}/…` | 200, identical results | `*` |
| `routing.openstreetmap.de/routed-{car,bike,foot}/route/v1/driving/…` | 200, distinct results | `*` |
| `nominatim.openstreetmap.org/search` | 200 | `*` |

## Open items to verify in a browser

1. openrouteservice per-endpoint quotas on `account.heigit.org/info/plans` (JS-rendered).
2. HERE per-service free bands and per-1,000 prices on `here.com/get-started/pricing` (JS-rendered).
3. GraphHopper's statement that the free plan covers only car, bike and foot (docs site is JS-rendered).
4. Whether Transitland's routing beta still offers 1,000 free queries/month at build time, and its post-beta pricing.
5. Google Maps service terms on caching Commute results per Listing.

## Sources

[^g-modes]: Google, Routes API, `RouteTravelMode` reference. https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode
[^g-transit]: Google, Routes API, "Get a transit route". https://developers.google.com/maps/documentation/routes/transit-route
[^g-req]: Google, Routes API, "Get a route". https://developers.google.com/maps/documentation/routes/compute_route_directions
[^g-mask]: Google, Routes API, "Choose what information to return". https://developers.google.com/maps/documentation/routes/choose_fields
[^g-price]: Google Maps Platform pricing list (Routes: Compute Routes Essentials 10,000 free then $5.00/1,000; Geocoding 10,000 free then $5.00/1,000; Distance Matrix Legacy 10,000 free). https://developers.google.com/maps/billing-and-pricing/pricing
[^g-usage]: Google, Routes API usage and billing (SKUs, Pro triggers, per-element matrix billing, 3,000 QPM). https://developers.google.com/maps/documentation/routes/usage-and-billing
[^g-geo]: Google, Geocoding API usage and billing. https://developers.google.com/maps/documentation/geocoding/usage-and-billing
[^g-dm]: Google, Distance Matrix API (Legacy) usage and billing, legacy notice. https://developers.google.com/maps/documentation/distance-matrix/usage-and-billing
[^g-bill]: Google Maps Platform, "Get started" (billing-enabled project required; $300 trial). https://developers.google.com/maps/get-started
[^gcp-bill]: Google Cloud, "Create a new Cloud Billing account". https://docs.cloud.google.com/billing/docs/how-to/create-billing-account
[^g-sec]: Google Maps Platform, "API security best practices" (restriction types per API, referrer schemes, proxy guidance). https://developers.google.com/maps/api-security-best-practices
[^gcp-keys]: Google Cloud, "Authenticate using API keys" (application restriction types). https://docs.cloud.google.com/docs/authentication/api-keys
[^g-pol]: Google, Routes API policies (attribution, Google Map requirement, caching). https://developers.google.com/maps/documentation/routes/policies
[^mb-dir]: Mapbox Directions API reference (profiles, 300 req/min, restrictions). https://docs.mapbox.com/api/navigation/directions/
[^mb-geo]: Mapbox Geocoding API v6 reference (forward endpoint, permanent vs temporary, 1,000 req/min). https://docs.mapbox.com/api/search/geocoding/
[^mb-price]: Mapbox pricing (Directions, Geocoding, Matrix, Isochrone free tiers and rates). https://www.mapbox.com/pricing
[^mb-signup]: Mapbox, "Sign up with Mapbox" (no-card trial limits; card removes limits). https://docs.mapbox.com/accounts/guides/signup/
[^mb-tok]: Mapbox, "Access tokens" account guide (URL restrictions, pk/sk/tk, unsupported sources). https://docs.mapbox.com/accounts/guides/tokens/
[^mb-tok2]: Mapbox Help, "Access tokens" (public tokens safe to expose client-side). https://docs.mapbox.com/help/dive-deeper/access-tokens/
[^ors-prof]: openrouteservice backend docs, engine profiles configuration (profile list incl. experimental public-transport). https://giscience.github.io/openrouteservice/run-instance/configuration/engine/profiles/
[^ors-home]: openrouteservice homepage (modes, Pelias geocoding, 500 isochrones/day). https://openrouteservice.org/
[^ors-plans]: openrouteservice plans (redirects to HeiGIT account; JS-rendered; figures read from the search index of this page). https://account.heigit.org/info/plans
[^ors-js]: openrouteservice-js README (browser usage, token registration). https://github.com/GIScience/openrouteservice-js
[^osrm-wiki]: Project-OSRM, osrm-backend wiki, "Demo server". https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
[^fossgis]: FOSSGIS routing server about/usage page. https://routing.openstreetmap.de/about.html
[^osrm-api]: OSRM HTTP API v5 documentation (route and table services, profile note). https://project-osrm.org/docs/v5.24.0/api/
[^gh-price]: GraphHopper pricing (Free plan 500 credits/day, footnotes). https://www.graphhopper.com/pricing/
[^gh-credit]: GraphHopper support, "What is one credit?". https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit-
[^gh-prof]: GraphHopper Directions API docs (profile table; free package statement; JS-rendered, read via search index). https://docs.graphhopper.com/
[^gh-forum]: GraphHopper forum, "IP Restrictions for GraphHopper Maps available for all customers". https://discuss.graphhopper.com/t/ip-restrictions-for-graphhopper-maps/4260
[^here-modes]: HERE Routing API v8 reference, "Calculate routes" (transportMode enum, apiKey). https://docs.here.com/routing/reference/routing-api-v8-calculateroutes.md
[^here-pt]: HERE Public Transit API v8 developer guide README. https://docs.here.com/transit/docs/readme-public-transit-api-v8
[^here-pt2]: HERE Public Transit API v8 reference, "Routes". https://docs.here.com/transit/reference/public-transit-api-v8-getroutes.md
[^here-rn]: HERE, April 2025 platform release notes (Limited Plan decommissioned; Base plan requires a payment method). https://www.here.com/learn/blog/april-2025-platform-release-notes
[^here-blog]: HERE blog, "How to get started with the HERE platform" (credit card at registration; charged only above free tier). https://www.here.com/learn/blog/how-to-get-started-with-here-platform
[^here-price]: HERE Base Plan pricing page (JS-rendered; not captured). https://www.here.com/get-started/pricing
[^here-keys]: HERE Identity & Access Management, "Using API keys" (two keys per app, trusted domains). https://docs.here.com/identity-and-access-management/docs/plat-using-apikeys
[^tl-route]: Transitland Routing API documentation (beta). https://www.transit.land/documentation/routing-api/
[^tl-plans]: Transitland plans and pricing. https://www.transit.land/plans-pricing/
[^tl-docs]: Transitland documentation (signing up for an API key). https://www.transit.land/documentation/
[^tl-place]: Transitland place page for San Luis Obispo. https://www.transit.land/places/United%20States%20of%20America/California/San%20Luis%20Obispo
[^tl-slo]: Transitland feed page, City of San Luis Obispo Transit GTFS. https://www.transit.land/feeds/f-9q60w-cityofsanluisobispotransit
[^tl-slo-op]: Transitland operator page, City of San Luis Obispo Transit. https://www.transit.land/operators/o-9q60w-cityofsanluisobispotransit
[^tl-rta]: Transitland feed page, SLORTA GTFS. https://www.transit.land/feeds/f-9q6-sanluisobisporegionaltransitauthority~pasoroblesexpress~so
[^tl-rta-op]: Transitland operator page, SLORTA. https://www.transit.land/operators/o-9q6-sanluisobisporegionaltransitauthority
[^slo-transit]: City of San Luis Obispo, SLO Transit "Transit App" page (lists Google Trip Planner; page returned HTTP 403 to automated fetches on the research date). https://www.slocity.org/services/transportation/slo-transit/transit-app
[^rta-faq]: SLO RTA FAQ ("Google Transit Trip Planner… all of the SLO County systems"). https://www.slorta.org/?p=457
[^nominatim]: OSMF Operations, Nominatim usage policy. https://operations.osmfoundation.org/policies/nominatim/
[^chrome-perm]: Chrome for Developers, "Declare permissions" (host_permissions enable fetch from service worker and extension pages). https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
[^chrome-net]: Chrome for Developers, "Network requests" (cross-origin with host permissions; content-script limits). https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
[^chromium-cors]: Chromium Security, "Changes to Cross-Origin Requests in Chrome Extension Content Scripts". https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/
[^chrome-sec]: Chrome for Developers, "Stay secure" (keep secrets out of content scripts; sensitive work in the service worker). https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure
[^crx3]: Chromium source, `components/crx_file/crx3.proto` (CRX = header + ZIP archive). https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto
[^lib-addr]: Online Archive of California, Cal Poly institution record (Kennedy Library, 1 Grand Ave, Bldg. 35). https://oac.cdlib.org/institutions/California+Polytechnic+State+University+-+San+Luis+Obispo
[^polymap]: Cal Poly Facilities, campus map PDF (names Dexter Lawn; no coordinates). https://afd.calpoly.edu/facilities/campus-maps/docs/PolyMapW.pdf
[^cp-visit]: Cal Poly, "Visit" (Grand Avenue entrance recommended; Welcome Center at 1 Grand Avenue). https://www.calpoly.edu/visit
[^cp-pac]: Cal Poly Spanos Theatre, "Location" (directions: "stop sign at the Main Entrance" on Grand Avenue). https://spanostheatre.calpoly.edu/location
