# Mustang Housing Match

A Chrome extension that helps Cal Poly students and their roommates evaluate off-campus rental listings against their own priorities and decide together. This glossary fixes the words the product, the tickets, and the code use.

## Language

### Listings and capture

**Listing**:
One advertised rental unit, identified by its canonical source URL (plus the chosen Floor Plan on a multi-plan page), or by its normalised address when it has no source URL.
_Avoid_: property, rental, post, home

**Source**:
Where a Listing's facts came from: a structured website (Zillow, Craigslist, Apartments.com), a Facebook post read as a Text Listing, or Manual.
_Avoid_: site, provider, platform

**Supported Page**:
A web page whose URL, after redirects, matches a Source's listing-page pattern, so the extension can capture from it. Every other page is an Unsupported Page, which still offers a Manual Listing.

**Text Listing**:
A Listing captured from text the student selects on a Facebook post (or pastes), read by a text parser into a pre-filled Review rather than from the page's structure.
_Avoid_: scraped post, parsed post

**Manual Listing**:
A Listing the student types in by hand from an Unsupported Page; its Source is Manual, every Listing Fact is a Correction, and its address is its identity.
_Avoid_: custom listing, blank listing

**Floor Plan**:
One of several unit configurations (beds, baths, rent) advertised on a single Source page; the student picks one during Review so a Listing carries exactly one rent.
_Avoid_: unit type, model, option

**Review**:
The step between Capture and the Scorecard where the student confirms or Corrects captured Listing Facts, picks a Floor Plan when the page has several, and sets the Rent Basis.
_Avoid_: confirmation, edit screen

**Rent Basis**:
Whether a Listing's rent is Per Unit (the whole home, split among roommates) or Per Person (one bed or room).
_Avoid_: rent type, pricing style

**Capture**:
The extraction of Listing Facts from the Supported Page in the student's active tab, only when the student chooses Analyze Listing, never in the background.
_Avoid_: scrape, parse, import

**Listing Fact**:
One attribute of a Listing (address, rent, bedrooms, bathrooms, lease type, amenity, fee), carrying a provenance of Listed, Not Listed, Estimated, or Corrected.
_Avoid_: field, detail, attribute

**Not Listed**:
The provenance of a Listing Fact the Source did not state. The tool never guesses a Not Listed value.
_Avoid_: unknown, missing, N/A

**Estimate**:
A value the tool supplies for a Not Listed cost (for example utilities) and labels as such.
_Avoid_: default, assumption

**Correction**:
A user-entered value that replaces a captured or Not Listed Listing Fact and is kept with the Listing.
_Avoid_: override, edit

### Preferences and scoring

**Preferences**:
One student's saved housing criteria: Budget, Transport Mode, maximum commute, Lease Type preference, room type, amenities wanted, and Priorities.
_Avoid_: settings, profile, filters

**Budget**:
The maximum Estimated Monthly Total a student will pay, per person.
_Avoid_: price cap, max rent

**Transport Mode**:
How the student gets to campus: walk, bike, bus, or car. "Bus" means public transit.
_Avoid_: transportation method, travel mode

**Priority**:
The weight (Low, Med, High) a student gives one of the four score categories: Cost, Commute, Lease, Amenities.
_Avoid_: importance, weight

**Fit Score**:
A 0–100 number computed deterministically from a Listing's Listing Facts, its Commute, and one student's Preferences.
_Avoid_: match score, rating, grade

**Scorecard**:
The per-Listing view of a Fit Score: the category breakdown, Benefits, Watch-outs, Cost Breakdown, Commute, and Landlord Questions.
_Avoid_: results, report, analysis

**Benefit**:
A reason a Listing scored well against the student's Preferences.
_Avoid_: pro, strength, highlight

**Watch-out**:
A reason a Listing scored poorly, or a risk the student should confirm before committing.
_Avoid_: con, concern, risk, red flag

**Landlord Question**:
A suggested question generated from a Not Listed Listing Fact or an Estimate.
_Avoid_: unknown, follow-up

### Cost and lease

**Cost Breakdown**:
Base rent, utilities, internet, parking, and other recurring fees, each marked Listed, Estimated, or Not Listed, with deposits and one-time fees shown separately.

**Estimated Monthly Total**:
Base rent plus the recurring items in the Cost Breakdown (Listed or Estimated), per person. Deposits and one-time fees are excluded.
_Avoid_: total cost, true cost, all-in price

**Lease Type**:
School-year, Month-to-month, 12-month, or Not Listed.
_Avoid_: lease length, term

### Commute

**Campus Reference Point**:
The single Cal Poly location every Commute is measured to, for every Transport Mode: the Robert E. Kennedy Library (1 Grand Avenue, Building 35).
_Avoid_: campus, school, Cal Poly (when a coordinate is meant)

**Commute**:
The route distance in miles for the student's Transport Mode and the travel times by every Transport Mode from a Listing's address to the Campus Reference Point, looked up once per Listing and kept with it. Bus times are for the next weekday morning departure.
_Avoid_: distance, directions, route

**Not Available**:
A Commute time the tool could not compute for a Transport Mode (for example, no bus route). Distinct from Not Listed, which is about a Listing Fact the Source omitted. A Not Available time for the student's Transport Mode is a Watch-out.
_Avoid_: unknown, N/A, missing

**Commute Failure**:
A Commute that could not be computed at all: the address could not be located, or the lookup failed and can be retried. The Scorecard shows the reason instead of a Commute, and the Commute category scores nothing.
_Avoid_: error, geocoding error

### Sharing and deciding

**Shared List**:
A named collection of Saved Listings that Members read and change together.
_Avoid_: master list, group, board, shortlist

**Member**:
A user with access to a Shared List. The Member who created it is the Owner.
_Avoid_: roommate (when the access role is meant), collaborator

**Invitation Link**:
The unique URL that makes whoever opens it a Member of one Shared List.
_Avoid_: share link, invite code

**Saved Listing**:
A Listing placed on a Shared List, carrying a Status, Notes, Landlord Questions, an optional Tour, and a Finalist flag.
_Avoid_: card, entry, item

**Duplicate**:
A Listing that matches a Saved Listing already on the same Shared List by canonical source URL or by normalised address (lowercased, punctuation stripped, street suffixes collapsed, unit number kept). Saving a Duplicate opens the existing Saved Listing instead of adding another.
_Avoid_: dupe, repeat, conflict

**Status**:
One of Saved, Considering, Tour Scheduled, Applied, Rejected, Selected.
_Avoid_: stage, state, decision

**Note**:
Dated text a Member adds to a Saved Listing, attributed to that Member.
_Avoid_: comment, message

**Tour**:
A date and time at which Members plan to view a Saved Listing.
_Avoid_: showing, visit, appointment

**Finalist**:
A Saved Listing chosen for Comparison. A Comparison needs at least two.
_Avoid_: shortlisted, selected (which is a Status)

**Comparison**:
The side-by-side view of Finalists: Fit Score, Estimated Monthly Total, Commute, Lease Type, Benefits, Watch-outs.
_Avoid_: compare view, matrix

**Group Fit**:
The average of each Member's Fit Score for the same Listing. It measures preference overlap, not interpersonal compatibility.
_Avoid_: group score, team match
