# F1: Capture Rental Listing

**Run record**: date ______ · Chrome version ______ · tester ______ · extension commit ______

One checkbox per acceptance criterion from `docs/product-brief.md`. Run against live pages in the user's own Chrome with the `live` providers configured in `.env`.

## Setup
- [ ] Extension loaded unpacked from `dist/`; side panel opens on toolbar click.
- [ ] Preferences saved (any values).

## Supported Page detection (US1)
- [ ] A Zillow home-detail page (`/homedetails/.../_zpid/`) shows the Supported Page card naming Zillow.
- [ ] A Zillow building page (`/apartments/<city>/<name>/<id>/`) shows the Supported Page card and, after Analyze, a Floor Plan picker.
- [ ] A Craigslist apartment post shows the Supported Page card naming Craigslist.
- [ ] An Apartments.com property page shows the Supported Page card naming Apartments.com.
- [ ] A Zillow search page, a news site, and `chrome://extensions` show the Unsupported Page card with the fixed text and no error.
- [ ] Switching tabs updates the card without reopening the panel.

## Extraction (US2)
For one listing from each Source, record what was captured:
- [ ] Zillow home: address, rent, bedrooms, bathrooms, lease type, deposit, application fee, amenities (parking, laundry, utilities, pets, furnished).
- [ ] Craigslist: address (if posted), rent, bedrooms, bathrooms; lease, deposit, fees are Not Listed.
- [ ] Apartments.com: address, rent range or chosen Floor Plan rent, beds, baths, lease options, deposit, application fee, parking fee, amenities.
- [ ] Facebook post: select the post text, click "Analyze Selected Text"; rent, bedrooms, lease hint fill where the text has them.
- [ ] Every missing value is shown as "Not Listed", never a guess.

## Corrections (US3)
- [ ] In Review, change rent and lease type; the Scorecard uses the corrected values and shows the "Corrected" tag.
- [ ] Corrections survive Save Listing and reopening the panel.
- [ ] Manual Listing with address + rent only produces a Scorecard with everything else Not Listed.
