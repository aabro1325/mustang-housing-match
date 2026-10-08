# Listing page extraction: what each candidate Source exposes

Research for issue #3 (part of #1, blocks #8). Question: for each candidate Source, which Listing Facts
(address, monthly rent, bedrooms, bathrooms, lease length/type, amenities, fees, deposit) can a content
script capture from a single-listing detail page, from where, and under what terms.

All fetches were made on 2026-10-07 (US Pacific). "curl" means a plain HTTP GET with a desktop Chrome
User-Agent from this machine, saved and inspected offline; "Chrome" means the page was opened in the user's
own Chrome (via the Claude in Chrome extension) and the live DOM was inspected, which is the extension's
actual runtime. Where a claim could not be verified against a primary source it is marked **Not verified**.
Nothing here is legal advice; terms quotes are verbatim excerpts so the team can read them in context.

Vocabulary follows `CONTEXT.md`: Source, Supported Page, Capture, Listing Fact, Not Listed, Lease Type.

## Summary table

| Source | Detail-page URL pattern (Supported Page test) | Rendering | Best structured data | Facts reliably present | Bot wall seen | Terms clause bearing on a user-triggered extension |
|---|---|---|---|---|---|---|
| Zillow (HDP) | `zillow.com/homedetails/<slug>/<zpid>_zpid/` | SSR (Next.js) | `__NEXT_DATA__` → `gdpClientCache` → `property` | address, rent, beds, baths, lease term, deposit, fees, amenities | PerimeterX (`_pxAppId`) present; curl got 200 | Prohibits "automated queries (including screen and database scraping...)"; copying allowed only "without the aid of any automated processes" for personal use |
| Zillow (building) | `zillow.com/apartments/<city>/<name>/<id>/` | SSR (Next.js) | `__NEXT_DATA__` → `initialReduxState.gdp.building` | address, rent range per floor plan, beds, baths, deposit, amenities; lease term often "Contact For Details" | same | same |
| Apartments.com | `apartments.com/<slug>/<7-char key>/` | SSR (facts in HTML); JSON-LD injected client-side | DOM sections (`#propertyAddressRow`, `.priceBedRangeInfoInnerContainer`, `#feesSection`, `#amenitiesSection`) + JSON-LD in live DOM | address, rent, beds, baths, lease options, deposit, application fee, amenities | Akamai Bot Manager (403 to curl; `bm_sv`/`bm_mi` cookies) | Prohibits "any robot, spider, scraper, tool, agent, **browser extension**, or other automatic device ... to access, monitor, copy, extract, collect ... for any unauthorized purpose" |
| Craigslist | `www.craigslist.org/view/d/<slug>/<opaque id>` (classic `<region>.craigslist.org/apa/d/<slug>/<pid>.html` 301s to it) | Detail SSR; search page client-rendered | JSON-LD `Apartment` + stable DOM (`.price`, `.attrgroup`, `#map[data-latitude]`) | rent, beds, baths, address (when poster gives one), rent period, housing type, laundry/parking | None (curl 200) | Prohibits copying via "robots, spiders, scripts, scrapers, crawlers, or any automated or manual equivalent" and software/services "that interact or interoperate with CL" other than general-purpose browsers; liquidated damages |
| Trulia | `trulia.com/building/<slug>-<id>` (communities) and `trulia.com/p/...` (single homes, **Not verified**) | SSR (Next.js) | JSON-LD `RealEstateListing` + `__NEXT_DATA__` → `props.homeDetails` | address, rent range, beds, baths, security deposit, amenities, pet policy; lease length not found | None seen in HTML | Footer links to Zillow Terms of Use (same as Zillow) |
| HotPads | `hotpads.com/<slug>-<id>/pad` and `.../<id>/<unit>/pad`, `.../building` | SSR (Next.js app router, `self.__next_f`) | JSON-LD `@graph` with `AggregateOffer.priceSpecification` ("Monthly base rent", "Security deposit") | address, rent, deposit, beds, amenities; baths and lease terms only in flight data | None seen | robots.txt header: "governed by our Terms of Use. See https://www.zillow.com/corp/Terms.htm" |
| Rent.com | `rent.com/apartment/<slug>-lc<digits>` | SSR (Next.js) | `__NEXT_DATA__` → `props.pageProps.pageData.listing` | address, rent, beds, baths, deposit per floor plan, fees object, amenities, pet policy; `leasingTerms` present but empty on sample | None seen (curl 200) | Prohibits "any robot, spider, scraper or other automated means"; content "solely for personal, noncommercial purposes" |
| Cal Poly off-campus portal (College Pads) | `findoffcampushousing.calpoly.edu/city/san-luis-obispo-ca/listing/<slug>-<id>`; list view opens the same listing in a popup at `/listing?property=<id>` | Vue 2 SPA; detail page HTML embeds listing JSON inline | Inline JSON in page HTML (floor plans: `bed`, `bath`, `min_rent`, `max_rent`, `security_deposit`, `available_date`); Vue instance data on list page | address, per-person rent range, beds, baths, utilities included, amenities, availability; deposit field exists but empty on sample; no lease-term field found | None | StarRez/College Pads terms prohibit "any robot, spider, or other automatic device" and "any manual process to monitor or copy" |
| Facebook Marketplace / groups | `facebook.com/marketplace/item/<id>/` and `facebook.com/groups/<group>/posts/<id>/` (**Not verified** from a primary source) | Client-rendered React; login-walled | None usable (**Not verified**) | None reliably; free text only | robots.txt `User-agent: * Disallow: /`; login wall | "You may not access or collect data from our Products using automated means (without our prior permission)... regardless of whether such automated access or collection is undertaken while logged-in" |

Legend for the per-Source tables below: **Yes** = present in structured data on the sampled page; **DOM** = present only as rendered text; **Partial** = present for some listings or in a weak form; **No** = not found on the sampled page (Capture should return Not Listed).

---

## Zillow

Pages sampled (curl, 200):
- Search: https://www.zillow.com/san-luis-obispo-ca/rentals/ (276 rentals; the page's JSON-LD `ItemList` lists `RealEstateListing` items whose `url`s are `homedetails/..._zpid/` and `apartments/.../` pages).
- Single unit ("HDP"): https://www.zillow.com/homedetails/1453-1-2-Lizzie-St-San-Luis-Obispo-CA-93401/464770776_zpid/
- Community ("BDP"): https://www.zillow.com/apartments/san-luis-obispo-ca/the-junction/CmPcXD/

**URL pattern.** Two detail-page shapes: `/homedetails/<address-slug>/<zpid>_zpid/` and `/apartments/<city-state>/<name-slug>/<6-char id>/`. The search page's own JSON-LD uses exactly these URLs. Search pages are `/<city>-<st>/rentals/` and `/<city>-<st>/apartments/`. (Source: the two fetched pages' `<link rel="canonical">`, and the search page's `BreadcrumbList`/`ItemList` JSON-LD.)

**Rendering.** Server-rendered Next.js: the HTML contains `<div id="__next">` with the full page and a `<script id="__NEXT_DATA__" type="application/json">`. No wait needed; content is present on first paint. Also present: `__FRONTIER_CLIENT_DATA__`, `__PFS_TOPNAV_DATA__` JSON scripts (nav only).

**Structured data.**
- JSON-LD on the HDP: `["RealEstateListing","Product"]` with `offers: Offer{price: 2900, priceCurrency, businessFunction: LeaseOut, priceSpecification: UnitPriceSpecification{unitCode: "MON"}, itemOffered: SingleFamilyResidence{numberOfBedrooms: 2, floorSize, address: PostalAddress, geo}}`. No bathrooms, lease, fees or deposit in JSON-LD.
- JSON-LD on the BDP: `["RealEstateListing","Product"]` with `about: ApartmentComplex{address, geo, petsAllowed, amenityFeature[]}` and `offers: AggregateOffer{lowPrice, highPrice, offerCount}`; plus `FAQPage` and `BreadcrumbList`. No beds/baths/deposit in JSON-LD.
- `__NEXT_DATA__` on the HDP: `props.pageProps.componentProps.gdpClientCache` is a JSON **string**; once parsed, its single key (`ForRentShopperPlatformFullRenderQuery{...}`) holds `property` with: `streetAddress`, `address{...}`, `price: 2900`, `bedrooms: 2`, `bathrooms: 1`, `livingArea`, `resoFacts.leaseTerm: "1 Year"`, `rentalCostsAndFees.leaseDuration: 12`, `rentalCostsAndFees.fees.monthly.feeGroup[].fees[]`, `resoFacts.feesAndDues: [{type: "Deposit", fee: "$2,900"}]`, `resoFacts.utilities`, `resoFacts.parkingFeatures`, `listPriceIncludesRequiredMonthlyFees`, `totalRequiredMonthlyMinFee/MaxFee`, `rentalApplicationPriceDetail.actualPriceInCents`.
- `__NEXT_DATA__` on the BDP: `props.pageProps.componentProps.initialReduxState.gdp.building` with `address`, `floorPlans[].units[]{beds, baths, price, depositsAndFees, leaseTermDetail{leaseTerm, deposit}, availableFrom}`, `buildingAttributes{depositFeeMin/Max, applicationFee, administrativeFee, leaseTerms[], leaseLengths, utilitiesIncluded[], petPolicies, parkingTypes}`, `structuredAmenities`, `amenityDetails.customAmenities.rawAmenities[]`, `rentalCostsAndFees`. On the sampled BDP `leaseTerm` was `"Contact For Details"` and `leaseTerms` was `[]`.

| Listing Fact | HDP (`homedetails`) | BDP (`apartments`) | Where |
|---|---|---|---|
| Address | Yes | Yes | JSON-LD `address`; `property.address` / `building.address` |
| Monthly rent | Yes | Yes (range or per unit) | JSON-LD `offers.price` / `AggregateOffer`; `property.price`; `floorPlans[].units[].price` |
| Bedrooms | Yes | Yes (per unit) | JSON-LD `numberOfBedrooms` (HDP only); `property.bedrooms`; `units[].beds` |
| Bathrooms | Yes (`__NEXT_DATA__` only) | Yes (per unit) | `property.bathrooms`; `units[].baths` |
| Lease length/type | Yes (`resoFacts.leaseTerm`, `rentalCostsAndFees.leaseDuration`) | Partial (`leaseTermDetail.leaseTerm`, often "Contact For Details") | `__NEXT_DATA__` only |
| Amenities | Partial (`resoFacts.*`, `parkingFeatures`) | Yes (`structuredAmenities`, `rawAmenities`, JSON-LD `amenityFeature`) | both |
| Fees | Yes (`rentalCostsAndFees.fees`, `rentalApplicationPriceDetail`) | Partial (`applicationFee`, `administrativeFee` null on sample) | `__NEXT_DATA__` only |
| Deposit | Yes (`feesAndDues[type=Deposit]`) | Yes (`depositFeeMin/Max`, `units[].depositsAndFees`) | `__NEXT_DATA__` only |

**Anti-automation.** The HDP HTML sets `window._pxAppId = 'PXHYx10rg3'` (PerimeterX / HUMAN bot defense). Plain curl with a browser UA nevertheless received 200 and full content for search, HDP and BDP on this run; Zillow is known to serve a "Press & Hold" challenge under load, but this was not triggered. A content script runs inside the user's already-admitted session, so this is a non-issue for the use case; it matters only if the extension ever fetches Zillow pages itself.

**robots.txt** (https://www.zillow.com/robots.txt, 328 lines). `User-agent: *` allows the main `/homes/...` search families and does not disallow `/homedetails/` or `/apartments/` detail pages except `/homedetails/*view=owner` and `/homedetails/*/rental-manager/resources/`; it disallows `/api/`, `/homes/` (the old search path) and many filter permutations.

**Terms** (https://www.zillow.com/corporate/terms-of-use/, "Updated October 28, 2025"; fetched via curl because the `/z/corp/terms/` redirect returns 403 to the WebFetch tool). Relevant verbatim text:
- §4(A): "we grant you a non-exclusive, limited, revocable, personal, non-transferable license to use the Services ... for your personal use."
- §4(C): "you may copy information from the Services without the aid of any automated processes and only as necessary for your personal use or Pro Use to view, save, print, fax and/or e-mail such information."
- Prohibited: "conduct automated queries (including screen and database scraping, spiders, robots, crawlers, bypassing "captcha" or similar precautions, or any other automated activity with the purpose of obtaining information from the Services) on the Services;" and "reproduce, modify, distribute, display or otherwise provide access to, create derivative works from, decompile, disassemble, or reverse engineer any portion of the Services".
- MLS section: "All information obtained from Zillow, Inc. will be used solely for your personal, non-commercial purposes." and "You will not copy, redistribute, or retransmit any of the provided information, except as necessary for considering the purchase or sale of an individual property."
- Whether a one-click Capture of the page the student is viewing counts as "automated queries" or as copying "without the aid of any automated processes" is a judgement for the team/legal, not settled by the text. Note that Shared Lists redistribute captured facts to other Members, which touches the "redistribute" clauses.

HotPads and Trulia both point to these terms (HotPads robots.txt header; Trulia footer `href="https://www.zillow.com/z/corp/terms/"`), so one legal read covers three Sources.

---

## Apartments.com (CoStar)

Pages sampled (Chrome, because curl and WebFetch get Akamai "Access Denied" 403 for every path including `/robots.txt`):
- Search: https://www.apartments.com/san-luis-obispo-ca/ (116 rentals; 40 `article.placard[data-listingid]` cards with `data-listingid="fe5y8gt"`-style keys).
- Detail: https://www.apartments.com/twin-creeks-san-luis-obispo-ca/sqnz3v4/ (3 bd / 3 ba, $3,850).
- The search-engine-indexed unit URL https://www.apartments.com/3680-broad-st-san-luis-obispo-ca-unit-202/5s3txvm/ redirected to the city search page (listing gone), so expired listings redirect rather than 404; the Supported Page test must run after redirects settle.

**URL pattern.** `https://www.apartments.com/<property-or-address-slug>/<7-char alphanumeric key>/`. 43 such links on the search page all matched `/^https:\/\/www\.apartments\.com\/[a-z0-9-]+\/[a-z0-9]{7}\/?$/`; search pages are `/<city>-<st>/` and `/<city>-<st>/<filter>/`, which have no 7-char key segment. The detail page exposes `<main data-listingid>` and `[data-rentalkey]` on pricing rows.

**Rendering.** Server-rendered: a `fetch(location.href)` from inside the page returned 304 KB of HTML that already contained the rent (`$3,850`), `feesSection`, lease options text (`6 - 12 Month`), `Deposit`, and `propertyAddressRow`. However that HTML did **not** contain `ld+json`; the JSON-LD `<script>` exists only in the live DOM (injected by the page's JS, or served only on the navigation response). Treat JSON-LD as available after load, with the DOM sections as the fallback. The page is a Vue SSR app (`window.__VUE_SSR_SETTERS__`, `window.aptsState` is small and holds no listing facts, `window.__APTS_GLOBAL_CONFIG__`).

**Structured data (live DOM).**
- JSON-LD `@graph[0]`: `["Product","RealEstateListing"]` with `offers: AggregateOffer{lowPrice: 3850, highPrice: 3850, priceCurrency, availability}` and `mainEntity: ApartmentComplex{address: PostalAddress, geo, petsAllowed, openingHoursSpecification, amenityFeature: LocationFeatureSpecification[] ("Fitness Center", "Playground", ...), accommodationCategory: "apartment", numberOfBedrooms: 3, numberOfBathroomsTotal: 3, floorSize{value: 1312, unitText: "Sq Ft"}}`; `@graph[1]` is `BreadcrumbList`.
- DOM: `#propertyAddressRow` ("791 Orcutt Rd, San Luis Obispo, CA 93401"); `.priceBedRangeInfoInnerContainer` ("Monthly Rent $3,850"); pricing grid rows with "3 Beds / 3 Baths / 1,312 Sq Ft / $1,500 Deposit" and a per-unit table (Unit, Base Price, Sq Ft, Availability); `section#feesSection` ("Fees and Policies": Required Fees / Pets / Parking tabs, "Application Fee Per Applicant $40", "Lease Options: 6 - 12 Month Leases", a "Property Fee Disclaimer"); `section#amenitiesSection` ("Community Amenities ...").
- Footnote on the page: "Price shown is base rent. Excludes user-selected optional fees and variable or usage-based fees and required charges due at or prior to move-in or at move-out."

| Listing Fact | Available | Where |
|---|---|---|
| Address | Yes | JSON-LD `mainEntity.address`; `#propertyAddressRow` |
| Monthly rent | Yes | JSON-LD `offers.lowPrice/highPrice`; `.priceBedRangeInfoInnerContainer`; per-unit "Base Price" |
| Bedrooms | Yes | JSON-LD `numberOfBedrooms`; pricing grid text |
| Bathrooms | Yes | JSON-LD `numberOfBathroomsTotal`; pricing grid text |
| Lease length/type | DOM | `#feesSection` "Lease Options" → "6 - 12 Month Leases" |
| Amenities | Yes | JSON-LD `amenityFeature[]`; `#amenitiesSection` |
| Fees | DOM | `#feesSection` (application fee, pet, parking tabs) |
| Deposit | DOM | pricing grid "$1,500 Deposit" per floor plan |

**Anti-automation.** Akamai: curl/WebFetch receive `Access Denied` with an `errors.edgesuite.net` reference for every URL, and the browser session carries `bm_mi` / `bm_sv` cookies. Inside the user's Chrome everything loads normally.

**robots.txt** (read in Chrome): `User-agent: *` disallows only `/mymedia/` and a set of tracking query strings (`/*?gclid`, `/*?rs`, ...); detail pages are crawlable and listed in `sitemap_All*Profiles.xml.gz`.

**Terms** (https://www.apartments.com/grow/about/terms-of-service, "Last updated: October 6, 2026", read in Chrome; the older `/about/terms-of-service/` path is blocked to non-browser clients). Operator: "CoStar Realty Information, Inc. ("Apartments.com") in connection with the Apartments.com, Apartamentos.com and ApartmentHomeLiving.com websites". Verbatim:
- "Any individual who visits, views, accesses or uses any version of the Site, including through a bot or other automated means, ("You" or "User") is bound by these Terms of Service."
- "The Materials are intended for personal and noncommercial use only. You may not copy, reproduce, sell, license, publish, distribute, modify, display, perform, combine, create a derivative work from, re-post or otherwise use any portion of the Materials in any other way or for any other purpose without the prior written consent of Apartments.com."
- Prohibited uses include: "use any robot, spider, scraper, tool, agent, browser extension, or other automatic device, software, process, or technology to access, monitor, copy, extract, collect, or otherwise use any portion of the Site or Materials for any unauthorized purpose, including to train, fine-tune, or improve any artificial intelligence or machine learning system, including as input to generative artificial intelligence or retrieval-augmented generation;"
- "Apartments.com may deploy technological measures to protect the Site, its users, Materials, and Content, including to prevent or limit unauthorized access, use, scraping, extraction, or any other prohibited activities under these Terms of Service."
- This is the only Source whose terms name "browser extension" explicitly. The qualifier is "for any unauthorized purpose"; the terms define authorized use as personal, noncommercial use of the Site. The team should decide whether a student's own Capture into a roommate Shared List fits that before shipping this adapter.

---

## Craigslist

Pages sampled (curl, 200; and Chrome):
- Search: https://slo.craigslist.org/search/apa → 301 to https://www.craigslist.org/search/area/slo?cat=apa. The HTML (334 KB) contains **no** result links; 200 `div.cl-search-result[data-pid]` cards render client-side from the search API.
- Detail (Chrome click-through and curl): https://www.craigslist.org/view/d/atascadero-air-conditioning-business/5BdQGNL6Xjb6zsddTd1PB5. The classic form https://slo.craigslist.org/apa/d/atascadero-air-conditioning-business/7976313438.html 301s to that URL.

**URL pattern.** As of this fetch Craigslist serves posting pages at `https://www.craigslist.org/view/d/<slug>/<22-char opaque id>` with the classic `https://<region>.craigslist.org/<cat>/d/<slug>/<10-digit pid>.html` redirecting to it. A Supported Page test should accept both; the `data-pid` (`7976313438`) is still the posting id used in search cards. Category is recoverable from the JSON-LD `BreadcrumbList` (`.../search/area/slo?cat=apa`, "apartments / housing for rent") rather than from the new URL. Housing categories: `apa` (apartments/housing), `roo` (rooms/shared), `sub` (sublets), `hhh` (all housing).

**Rendering.** Detail page is fully server-rendered (28 KB; curl and DOM identical for all fields below). `<body class="no-js show-curtain ...">` with a JS curtain, but all facts are in the HTML. The search page is client-rendered, so do not try to capture from search.

**Structured data.**
- JSON-LD: `BreadcrumbList` and `Apartment{name, numberOfBathroomsTotal: 1, latitude, longitude, address: PostalAddress{streetAddress, addressLocality, addressRegion, postalCode, addressCountry}}` (only when the poster supplied a mappable address; `numberOfBedrooms` is absent for this studio).
- DOM: `h1.postingtitle > .postingtitletext` with `span.price` ("$1,030"), `span.housing` ("/ 542ft² - "), `#titletextonly`, and the trailing `(10167 El Camino Real, Atascadero, CA)` span; `h2.street-address`; `div.mapAndAttrs` → `#map.viewposting[data-latitude][data-longitude][data-accuracy]`, `div.mapaddress`; `div.attrgroup` blocks → `span.attr.important` ("0BR / 1Ba", "542ft²"), `div.attr.rent_period` ("rent period: monthly"), and plain `div.attr` values linking to filters (`housing_type=1` "apartment", "laundry on site", "carport"; cats/dogs ok, furnished, no smoking, wheelchair access, EV charging, air conditioning appear here when set); `#postingbody` free text; `<meta name="robots" content="unavailable_after: ...">` gives the expiry.
- Open Graph: `og:title`, `og:description` (first lines of the body), `og:image`, `og:url`.

| Listing Fact | Available | Where |
|---|---|---|
| Address | Partial | JSON-LD `Apartment.address` / `h2.street-address` / `.mapaddress` only when the poster entered one; else only `#map` coordinates (or nothing) |
| Monthly rent | Yes | `.price`; `rent period` attr says monthly/weekly/daily |
| Bedrooms | Yes | `.attrgroup .attr.important` "0BR / 1Ba" (0 = studio); not in JSON-LD |
| Bathrooms | Yes | same text; JSON-LD `numberOfBathroomsTotal` |
| Lease length/type | No | not a Craigslist field; sometimes in `#postingbody` free text |
| Amenities | Partial | `.attrgroup .attr` tags (laundry, parking, pets, furnished, AC, ...) |
| Fees | No | free text only |
| Deposit | No | free text only |

**Anti-automation.** None encountered: curl with a browser UA received full pages; no challenge or cookie wall.

**robots.txt** (https://slo.craigslist.org/robots.txt): `User-agent: *` disallows only `/reply`, `/fb/`, `/suggest`, `/flag`, `/mf`, `/mailflag`, `/eaf`, `/sitemap/`. Postings and search are not disallowed.

**Terms** (https://www.craigslist.org/about/terms.of.use, "last updated August 16, 2019"). Verbatim excerpts from the USE, LICENSE and LIQUIDATED DAMAGES sections:
- "not to copy/collect CL content via robots, spiders, scripts, scrapers, crawlers, or any automated or manual equivalent"
- "not to use or provide software (except our App and general purpose web browsers and email clients) ... services that interact or interoperate with CL"
- "not to display, "frame," make derivative works, distribute, license, or sell, content from CL, excluding postings you create"
- Liquidated damages: "aggregating, displaying, framing, copying, duplicating, reproducing, making derivative works from" CL content — "$3,000 for each day you engage in such violations"; "requesting, viewing, or accessing more than 1,000 pages of CL in any 24-hour period" — "$0.25 per page"; "distributing any software to facilitate violations of the USE Section - $1,000 per violation".
- The "software ... that interact or interoperate with CL" clause is the one that most directly describes a browser extension even though the words are not used. Craigslist has litigated this clause (3Taps, Instamotor); the team should weigh that history.

---

## Trulia (Zillow Group)

Pages sampled (curl, 200):
- Search: https://www.trulia.com/for_rent/San_Luis_Obispo,CA/ (21 `/building/...` links in HTML).
- Detail: https://www.trulia.com/building/the-junction-2120-santa-barbara-ave-2120-santa-barbara-ave-san-luis-obispo-ca-93401-2757883523

**URL pattern.** Communities: `trulia.com/building/<name-and-address-slug>-<10-digit id>`. Single homes for rent use `trulia.com/p/<st>/<city>/<address-slug>--<id>` (**Not verified** on this run: the SLO search page listed only `/building/` results; robots.txt lines such as `Disallow: /p/nd/*` confirm the `/p/` family exists). Search: `/for_rent/<City>,<ST>/`.

**Rendering.** Server-rendered Next.js (`__NEXT_DATA__`, `data-next-head` metas). The listing text is identical to Zillow's (same `RLNE7203281` description), i.e. Trulia renders the Zillow rental feed.

**Structured data.**
- JSON-LD `RealEstateListing{url, dateModified, mainEntity: ["ApartmentComplex","Service","Organization"]{name, address: PostalAddress, geo, numberOfAccommodationUnits, numberOfAvailableAccommodationUnits, amenityFeature[], telephone, containsPlace: Apartment[]{numberOfBathroomsTotal, floorSize}, hasOfferCatalog: OfferCatalog → RealEstateListing.offers: Offer{availability, priceSpecification{price, priceCurrency}, itemOffered: Apartment{floorSize, numberOfBathroomsTotal}}}}`; plus `Product{additionalProperty: PropertyValue[] ("Property Type", "Pets", "Laundry", "Available Units"), offers: AggregateOffer{lowPrice: 2150, highPrice: 2200, price}}`, `FAQPage`, `BreadcrumbList`.
- `__NEXT_DATA__` → `props.homeDetails`: `location.streetAddress`, `price{min, max, formattedPrice: "$2,150 - $2,200/mo"}`, `bedrooms{formattedValue: "Studio"}`, `bathrooms{formattedValue: "1 Bath"}`, `floorPlans.floorPlanGroups[].plans[].units[]{bedrooms, bathrooms, availabilityDate}`, `rentalCostsAndFees.costAndFeeCalculator.fees{monthlyRequiredFees[] ("Rent"), oneTimeRequiredFees[] ("Security deposit" 2150–2200), monthlyOptionalFees[], oneTimeOptionalFees[]}`, `activeForRentListing.petPolicy`, `isTotalMonthlyFeeIncluded`. No lease-length key was found in the blob (searched for `lease`).

| Listing Fact | Available | Where |
|---|---|---|
| Address | Yes | JSON-LD `mainEntity.address`; `homeDetails.location.streetAddress` |
| Monthly rent | Yes | JSON-LD `Offer.priceSpecification.price` / `AggregateOffer`; `homeDetails.price` |
| Bedrooms | Yes | `homeDetails.bedrooms`; JSON-LD `Apartment.name` ("Studio") only indirectly |
| Bathrooms | Yes | JSON-LD `numberOfBathroomsTotal`; `homeDetails.bathrooms` |
| Lease length/type | No | not found on sampled page |
| Amenities | Yes | JSON-LD `amenityFeature[]`, `Product.additionalProperty` |
| Fees | Partial | `rentalCostsAndFees.costAndFeeCalculator.fees` (optional fee arrays empty on sample) |
| Deposit | Yes | `oneTimeRequiredFees[] displayValue: "Security deposit"` |

**Anti-automation.** None seen (no PerimeterX/Akamai markers in HTML; curl 200).

**robots.txt** (https://www.trulia.com/robots.txt): `User-agent: *` section disallows a long list of filter/utility paths and specific test `/building/` and `/p/` pages; detail pages generally allowed. **Terms**: footer links to https://www.zillow.com/z/corp/terms/ (Zillow Terms of Use above).

---

## HotPads (Zillow Group)

Pages sampled (curl, 200):
- Search: https://hotpads.com/san-luis-obispo-ca/apartments-for-rent (80 `/pad` links).
- Detail: https://hotpads.com/twin-creeks-apartments-san-luis-obispo-ca-93401-1m6q6t7/110/pad

**URL pattern.** `hotpads.com/<name-city-st-zip-slug>-<7-char id>/pad` for a listing, `.../<id>/<unit>/pad` for a unit within a building, `.../building` for building pages. Search: `/<city>-<st>/apartments-for-rent`.

**Rendering.** Server-rendered Next.js App Router: content streamed in 77 `self.__next_f.push([1,"..."])` chunks (no `__NEXT_DATA__`). Facts are in the HTML, but the flight payload is harder to parse than JSON-LD.

**Structured data.**
- JSON-LD `@graph`: `WebPage`, `BreadcrumbList`, `ApartmentComplex{name, url, photo[], description, petsAllowed, datePosted, address: PostalAddress, geo, numberOfBedrooms, amenityFeature: LocationFeatureSpecification[] (18 on sample)}`, `Product{offers: AggregateOffer{lowPrice, highPrice, offerCount, provider: RealEstateAgent, itemOffered}}`; a second script `AggregateOffer{priceSpecification: [UnitPriceSpecification{name: "Monthly base rent", price: 3850, unitCode: "MON"}, PriceSpecification{name: "Security deposit", price: 1500}]}`; `FAQPage` whose answers restate units/rents, pet policy and laundry.
- Flight data keys found (`self.__next_f`): `beds: 3`, `baths: 3`, `streetAddress: "791 Orcutt Rd"`, `leaseTerms: ""`, `feesAndDeposits: [...]`, `deposit: null`, `oneTimeFee`, `monthlyFee`, `parking: false`, `modelAmenities`, `leaseTermsAndUtilitiesShareDescription`, `hasTotalMonthlyPrice`. UI strings show the page has a "Costs, fees, and lease terms" section with "Lease terms available" and "{count} months" pills when the feed provides them.
- Meta description literally includes "building deposit fee maximum: 1500".

| Listing Fact | Available | Where |
|---|---|---|
| Address | Yes | JSON-LD `ApartmentComplex.address` |
| Monthly rent | Yes | JSON-LD `AggregateOffer.priceSpecification[name="Monthly base rent"]` |
| Bedrooms | Yes | JSON-LD `numberOfBedrooms`; flight `beds` |
| Bathrooms | Partial | flight data `baths` only |
| Lease length/type | Partial | flight data `leaseTerms` (empty on sample) |
| Amenities | Yes | JSON-LD `amenityFeature[]` |
| Fees | Partial | flight data `feesAndDeposits`, `oneTimeFee`, `monthlyFee` |
| Deposit | Yes | JSON-LD `priceSpecification[name="Security deposit"]` |

**Anti-automation.** None seen. **robots.txt** (https://hotpads.com/robots.txt): first line "Access to and use of HotPads.com is governed by our Terms of Use. See https://www.zillow.com/corp/Terms.htm"; `User-agent: *` disallows `/user`, `/halo`, API and account paths only. **Terms**: Zillow Terms of Use (above); the detail page footer also links `https://www.zillow.com/corporate/terms-of-use/`.

---

## Rent.com (Rent Group, a Redfin company)

Pages sampled (curl, 200):
- Search: https://www.rent.com/california/san-luis-obispo-apartments — listing cards carry `data-tid="listing-card"`, `data-tag_listing_id="lc5898185"`, `data-tplsource="ZILLOW"`, and each card has its own JSON-LD with `url`.
- Detail: https://www.rent.com/apartment/the-junction-san-luis-obispo-ca-lc5898185

**URL pattern.** `rent.com/apartment/<name-city-st-slug>-lc<7 digits>`. Search: `/<state>/<city>-apartments[/<filter>]`. Note `data-tplsource="ZILLOW"` on the sampled cards: Rent.com's paid SLO inventory is the Zillow feed again (same description text as Zillow/Trulia).

**Rendering.** Server-rendered Next.js (`__NEXT_DATA__`, `data-next-head`).

**Structured data.**
- JSON-LD `ItemPage{about: Product{offers: AggregateOffer{lowPrice: 2150, highPrice: 2495}}, mainEntity: ApartmentComplex{address: PostalAddress, geo, telephone, amenityFeature[], containsPlace: Apartment[]{name, numberOfRooms, floorSize}}, breadcrumb, potentialAction, subjectOf: VideoObject}`.
- `__NEXT_DATA__` → `props.pageProps.pageData.listing`: `address`, `price: 2150`, `floorPlans[]{deposit: 2200, priceTerm: "/mo", amenities[], availableCount, units[]{rent: "$2,200", deposit: "2200", dateAvailable}}`, `bedCountData[].beds`, `fees{utilities{included, tenantPaid}, adminFee, applicationFee, brokerFee, insurance, amenity}`, `petPolicies[]{deposit, initialFee, additionalRent}`, `leasingTerms: []`, `specialTerms`, `parking: []`, `amenitiesWithSubcategories[]`, `hasTotalCostWithFees`.

| Listing Fact | Available | Where |
|---|---|---|
| Address | Yes | JSON-LD `mainEntity.address`; `listing.address` |
| Monthly rent | Yes | `listing.price`; `floorPlans[].units[].rent`; JSON-LD `AggregateOffer` |
| Bedrooms | Yes | `listing.bedCountData[].beds`; floor plan names |
| Bathrooms | Partial | floor plan `name`/JSON-LD `Apartment.numberOfRooms` only on sample; check `floorPlans[].baths` on a unit listing |
| Lease length/type | Partial | `listing.leasingTerms` (empty on sample) |
| Amenities | Yes | `amenitiesWithSubcategories`, JSON-LD `amenityFeature[]` |
| Fees | Yes (structure) | `listing.fees{adminFee, applicationFee, brokerFee, utilities}` (all null on sample) |
| Deposit | Yes | `floorPlans[].deposit`, `units[].deposit` |

**Anti-automation.** None seen for pages; `/terms` 404s and WebFetch was redirected to `ratelimited.rent.com`, so there is some rate limiting on non-browser clients.

**robots.txt** (https://www.rent.com/robots.txt): `User-agent: *` disallows `/apartments/`, `/property/`, `/rentals/`, `/search/results*`, `/webapi/`, `/graphql*` and others. The detail path `/apartment/` (singular) is not disallowed.

**Terms** (https://www.rent.com/legal/terms-of-service, "Last updated March 4, 2025"; operator "Rent Group"). Verbatim:
- "we hereby authorize you to view, copy, download and print a single copy of the information and data ("Content") available on the Sites, provided that: (1) the Content is used solely for personal, noncommercial purposes; (2) the Content is not modified, republished, or redistributed"
- "You agree that you will not use any robot, spider, scraper or other automated means to access the Sites for any purpose without our prior written consent."
- "(ii) copy, use, reproduce, modify, create derivative works from, distribute or display any content on the Sites without our prior written consent" and "(iv) bypass our robot exclusion headers"
- MLS data section: "This prohibition expressly includes "scraping" (including screen and database scraping), "data mining", or any other activity intended to collect, store, re-organize, summarize, or manipulate any information provided or any related data."

---

## Cal Poly off-campus housing portal (findoffcampushousing.calpoly.edu, powered by College Pads / StarRez)

Pages sampled:
- List: https://findoffcampushousing.calpoly.edu/listing (curl 200, 1.9 MB; Chrome). `<title>Cal Poly SLO | Off-Campus Housing Marketplace</title>`; meta description calls it "The official Cal Poly SLO off-campus housing site". Vue 2.6.12 SPA (`<div id="app">`, `httpVueLoader` components from `/assets/js/components/campus/*.vue`, axios), branded "POWERED BY" rentcollegepads.com.
- Detail (curl 200, 872 KB): https://findoffcampushousing.calpoly.edu/city/san-luis-obispo-ca/listing/valencia-apartments-234020
- Components read: `/assets/js/components/campus/ListView.vue`, `/assets/js/components/campus/DetailPopup.vue`.

**URL pattern.** `ListView.vue`'s `openDetailPage()` builds `domain_path + 'city/' + campusData.campus.slug + '/listing/' + listingData.slug` (campus slug `san-luis-obispo-ca`, listing slug `<name>-<id>`) and opens it in a new tab; clicking a card in the list instead opens `DetailPopup` and `history.pushState(... '?property=' + listingData.id)`, so `/listing?property=234020` is also a single-listing view (popup over the list). The detail page's JSON-LD breadcrumb points at the canonical College Pads copy: `https://www.rentcollegepads.com/city/san-luis-obispo-ca/listings/valencia-apartments-234020`.

**Rendering.** List view: client-rendered (no listing links or data in the HTML; 22 listings loaded into the Vue root as `listData`). Detail page: the HTML embeds the listing record as inline JSON (floor plans etc.) that the Vue components hydrate, so a content script can read it from the page source, but there is no single named blob (`__NEXT_DATA__`-style) and no listing JSON-LD (only `BreadcrumbList`; one JSON-LD script is empty/unparseable).

**Structured data.**
- Detail-page inline JSON (floor plans): `{"property_id":234020,"title":"Future Floor Plan (Max 3 tenants)","bed":"3","bath":"2","min_rent":"1385","max_rent":"1420","security_deposit":"","sq_footage":"1000","available_date":"2026-08-15","status":"Active"}` (four plans on the sample; `security_deposit` empty). Landlord record includes `admin_fees: "0.00"`, `holding_deposit: "0.00"`.
- List-view Vue data per listing (read from the Vue root in Chrome): `address` ("555 Ramona Dr, San Luis Obispo, CA 93405, USA"), `street_address_short`, `min_rent`/`max_rent` ("1000"/"1420"), `rent_style: "person"` (per-person pricing), `min_bed`/`max_bed`, `min_bath`/`max_bath`, `utilities` (map of included utilities, e.g. "Electric", "Electric with reasonable cap", "Gas", "Heat"), `amenities` (37 ids), `available: "Now"`, `distance`, `fee_disclaimer`, `lowest_price`, `hide_pricing`. No key matching lease/term/deposit on the list object.
- Open Graph on detail: `og:title` "Valencia Apartments | San Luis Obispo CA Apartments For Rent"; `og:url` is the site root (not the listing).

| Listing Fact | Available | Where |
|---|---|---|
| Address | Yes | Vue `listingData.address`; detail page text/JSON |
| Monthly rent | Yes (range, **per person** when `rent_style == "person"`) | `min_rent`/`max_rent`; floor plan `min_rent`/`max_rent` |
| Bedrooms | Yes | `min_bed`/`max_bed`; floor plan `bed` |
| Bathrooms | Yes | `min_bath`/`max_bath`; floor plan `bath` |
| Lease length/type | No | no field found; free text only |
| Amenities | Yes | `amenities` ids (need the site's amenity table to label) + utilities-included map |
| Fees | Partial | `fee_disclaimer`, landlord `admin_fees` |
| Deposit | Partial | floor plan `security_deposit` (empty on sample) |

**Anti-automation.** None; curl receives everything. Note the page embeds a Google Maps API key and a CSRF token in HTML; do not log page source.

**robots.txt**: https://findoffcampushousing.calpoly.edu/robots.txt could not be fetched (connection failed; **Not verified**).

**Terms.** https://findoffcampushousing.calpoly.edu/terms returns a client-rendered shell (the fetcher saw only the word "Terms"), so the operator's terms were read at https://www.rentcollegepads.com/terms ("Last Modified: February 9, 2026"; operator StarRez, Inc. and affiliates). It is **Not verified** that the Cal Poly-branded page shows identical text. Verbatim prohibited uses:
- "Use any robot, spider, or other automatic device, process, or means to access the Website for any purpose, including monitoring or copying any of the material on the Website."
- "Use any manual process to monitor or copy any of the material on the Website or for any other purpose not expressly authorized in these Terms of Use, without our prior written consent."
- "Cause the Website or portions of it to be displayed on, or appear to be displayed by, any other site, for example, framing, deep linking, or in-line linking."
- Downloadable apps "solely for your own personal, non-commercial use."
Because this is Cal Poly's official portal, the cheapest legal route may be to ask the Off-Campus Housing office (offcampushousing@calpoly.edu, per wep.calpoly.edu/housing-interns-new-grads) for permission or a feed, which no other Source offers.

---

## Facebook Marketplace and Facebook group posts

What could be verified from primary sources:
- robots.txt (https://www.facebook.com/robots.txt): header comment "Collection of data on Facebook through automated means is prohibited unless you have express written permission from Facebook"; the catch-all is `User-agent: *` / `Disallow: /`. Group post sitemaps exist (`/sitemap/groups_latest_posts_0.xml.gz`) but return 403 to non-allow-listed clients.
- Logged-out https://www.facebook.com/marketplace/category/propertyrentals returns 200 with generic `og:` tags and ~40 `<script type="application/json" data-sjs>` Relay payloads, but **no** `/marketplace/item/` links; listing content requires login. The user's logged-in session was deliberately not driven for this research, so the item page DOM is **Not verified**.
- Terms of Service (https://www.facebook.com/terms.php, effective January 1, 2025), §3.2 item 3: "You may not access or collect data from our Products using automated means (without our prior permission) or attempt to access data you do not have permission to access, regardless of whether such automated access or collection is undertaken while logged-in to a Facebook account." §3.2 item 7: "You may not do, or attempt to do, anything to circumvent, bypass, or override any technological measures that Meta uses to control or limit access to our Products or data." §3.4 requires written permission to "modify, translate, create derivative works of, decompile, or reverse engineer our products".
- Automated Data Collection Terms (https://www.facebook.com/legal/automated_data_collection_terms, effective October 7, 2024): Automated Data Collection "refers to the collection of data from Meta Company Products via the use of automated or programmatic tools" which "may include but are not limited to web scrapers, bots, robots, spiders, crawlers, user-agents"; "You will not engage in Automated Data Collection without first obtaining Meta's express written permission"; permitted uses are limited to search engines and link previews ("All other Uses are prohibited").

Not verified (widely used, but no Meta page documenting it was found): item URL `https://www.facebook.com/marketplace/item/<numeric id>/`; group post permalinks `https://www.facebook.com/groups/<group id or slug>/posts/<post id>/` and the older `/permalink/<post id>/`. Facebook pages carry no listing-level JSON-LD or Open Graph beyond generic tags, the DOM is React with hashed class names, and group posts are free text written by students (rent, beds, "lease through June", address usually omitted).

| Listing Fact | Available | Where |
|---|---|---|
| Address | No (rarely in post text; Marketplace shows an approximate map) | free text |
| Monthly rent | Partial | Marketplace price field / "$1,200/mo" in post text |
| Bedrooms / Bathrooms | Partial | Marketplace rental fields / "2b2b" patterns in text |
| Lease length/type | Partial | free text ("sublease Jan–Jun", "12 month") |
| Amenities, Fees, Deposit | Partial | free text only |

**How Facebook posts should be handled** (recommendation): do not build a DOM extractor for Facebook. Treat `facebook.com/marketplace/item/*` and `facebook.com/groups/*/posts/*` as a special Supported Page kind, "Text Listing": the side panel asks the student to select the post text on the page and press Analyze (reading `window.getSelection()` on a user action, or a paste box as the fallback), then runs the same free-text parser that Craigslist `#postingbody` needs anyway (rent `$1,2xx`, `2bd/2ba`, lease months, "utilities included", "deposit $"). Every Listing Fact not matched stays Not Listed, address is Not Listed unless the student types a Correction, and the Source URL is still recorded for Duplicate detection. This keeps the extension out of Meta's "automated means" language (the student copies text they can already see), avoids the login-walled, frequently changing DOM, and still gives the student a Scorecard. Revisit only if Meta publishes a Marketplace API for consumers.

---

## Cross-Source observations

1. **One feed, four Sources.** Trulia, HotPads and Rent.com (`data-tplsource="ZILLOW"`) all render Zillow's rental feed for SLO communities (identical descriptions, e.g. "The Junction ... (RLNE7203281)"). Duplicate detection by normalised address (CONTEXT.md "Duplicate") is required, not optional, because roommates will paste the same unit from different Sources.
2. **Lease Type is the weakest fact everywhere.** Only Zillow HDP had a filled structured lease term (`leaseTerm: "1 Year"`, `leaseDuration: 12`); Apartments.com had it as DOM text ("6 - 12 Month Leases"); Zillow BDP said "Contact For Details"; Trulia/HotPads/Rent.com/Cal Poly had empty or missing lease fields. Expect Lease Type = Not Listed most of the time and generate the Landlord Question.
3. **Deposit and fees** are structured on Zillow, Trulia, HotPads, Rent.com and (as DOM text) Apartments.com; absent on Craigslist and Facebook; present-but-empty on the Cal Poly portal.
4. **Per-person vs per-unit rent.** The Cal Poly portal's `rent_style: "person"` means its rent is already per person; every other Source lists per-unit rent. The Estimated Monthly Total must know which it received.
5. **JSON-LD alone is not enough** on any Source (it never carries lease or fees, and on Apartments.com it is injected after load). The cheapest robust pattern is: JSON-LD for address/rent/beds/baths/amenities, then a Source-specific state blob (`__NEXT_DATA__`) or a small set of DOM selectors for lease, fees, deposit.
6. **Every Source's terms restrict automated collection; two describe extensions or interoperating software by name** (Apartments.com "browser extension"; Craigslist "software ... that interact or interoperate with CL"). None distinguish a user-triggered read of the current tab from bulk scraping. The Chrome Web Store listing and a privacy policy should state that Capture only runs on the student's click, only on the page they are viewing, and stores facts for the student's own use; a legal review is still needed before public release.

## Recommendation: first three Sources

Ranked by engineering cost (stable URL test, server-rendered facts, one parse path) and expected use by Cal Poly students, with the legal flag noted:

1. **Zillow** (`/homedetails/` first, `/apartments/` second). Richest and most reliable structured facts (all eight Listing Facts on the HDP via `__NEXT_DATA__`), server-rendered, no wait. Building the `__NEXT_DATA__` reader also makes **Trulia** and **HotPads** near-free follow-ons (same company, same terms, same feed), so the legal review of the Zillow Terms of Use is amortised over three Sources.
2. **Craigslist.** Cheapest adapter of all: tiny SSR page, JSON-LD `Apartment` plus three stable selectors (`.price`, `.attrgroup`, `#map`), no bot wall, and the housing categories (`apa`, `roo`, `sub`) match how SLO students actually rent (rooms and sublets). Lease, fees and deposit will be Not Listed, which exercises the Landlord Question flow early. Terms risk: the "interoperate with CL" clause and liquidated-damages schedule.
3. **Apartments.com.** Most-used national site and the only one with lease options and deposit as readable text, server-rendered, with JSON-LD in the live DOM for address/beds/baths/amenities. Cost is moderate (DOM selectors for `#feesSection` and the pricing grid). It is also the only Source whose terms name "browser extension" explicitly; if the team is not comfortable with that, swap in the **Cal Poly portal** as the third Source: it is SLO-specific, server-embeds per-person rent, beds, baths, utilities and availability, has no bot wall, and its operator is reachable for permission, at the cost of a messier inline-JSON parse and a missing lease field.

Facebook (Marketplace and groups) should ship as the "Text Listing" flow described above rather than as a DOM extractor.

## Sources fetched

- https://www.zillow.com/robots.txt, https://www.zillow.com/corporate/terms-of-use/, https://www.zillow.com/san-luis-obispo-ca/rentals/, https://www.zillow.com/homedetails/1453-1-2-Lizzie-St-San-Luis-Obispo-CA-93401/464770776_zpid/, https://www.zillow.com/apartments/san-luis-obispo-ca/the-junction/CmPcXD/ (curl)
- https://www.apartments.com/robots.txt, https://www.apartments.com/grow/about/terms-of-service, https://www.apartments.com/san-luis-obispo-ca/, https://www.apartments.com/twin-creeks-san-luis-obispo-ca/sqnz3v4/ (Chrome; curl/WebFetch 403)
- https://slo.craigslist.org/robots.txt, https://www.craigslist.org/about/terms.of.use (WebFetch), https://slo.craigslist.org/search/apa, https://www.craigslist.org/view/d/atascadero-air-conditioning-business/5BdQGNL6Xjb6zsddTd1PB5 (curl and Chrome)
- https://www.trulia.com/robots.txt, https://www.trulia.com/for_rent/San_Luis_Obispo,CA/, https://www.trulia.com/building/the-junction-2120-santa-barbara-ave-2120-santa-barbara-ave-san-luis-obispo-ca-93401-2757883523 (curl)
- https://hotpads.com/robots.txt, https://hotpads.com/san-luis-obispo-ca/apartments-for-rent, https://hotpads.com/twin-creeks-apartments-san-luis-obispo-ca-93401-1m6q6t7/110/pad (curl)
- https://www.rent.com/robots.txt, https://www.rent.com/legal/terms-of-service, https://www.rent.com/california/san-luis-obispo-apartments, https://www.rent.com/apartment/the-junction-san-luis-obispo-ca-lc5898185 (curl)
- https://findoffcampushousing.calpoly.edu/listing, https://findoffcampushousing.calpoly.edu/city/san-luis-obispo-ca/listing/valencia-apartments-234020, https://findoffcampushousing.calpoly.edu/assets/js/components/campus/ListView.vue, https://findoffcampushousing.calpoly.edu/assets/js/components/campus/DetailPopup.vue (curl and Chrome); https://www.rentcollegepads.com/terms (WebFetch)
- https://www.facebook.com/robots.txt, https://www.facebook.com/marketplace/category/propertyrentals (curl, logged out), https://www.facebook.com/terms.php, https://www.facebook.com/legal/automated_data_collection_terms (WebFetch)
- Not reachable: https://findoffcampushousing.calpoly.edu/robots.txt (connection failed), https://www.facebook.com/sitemap/groups_latest_posts_0.xml.gz (403), https://www.corporatehousing.com/terms-of-service (403), web.archive.org (blocked for the fetch tool)
