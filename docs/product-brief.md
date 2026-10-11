# Mustang Housing Match: product brief

Source: the team's Trello board (features, benefit hypotheses, acceptance criteria, user stories) and the Figma design at
https://www.figma.com/design/Tvbv5dUte2Hbelu50lHS8d/Mustang-Housing-Match?node-id=0-1

Figma screens (Page 1, each a 420px-wide Chrome side panel): Welcome and setup `3:5757`, Housing preferences `3:5832`,
Analyze current listing `3:5982`, Evaluating listing `3:6085`, Match results `3:6169`, Saved listings `3:6293`,
Compare rentals `3:6394`, Roommate decision `3:6573`.

## F1: Capture Rental Listing (8, XL)

Benefit hypothesis: if Mustang Housing Match automatically captures the important information from a rental listing, then students will spend at least 50% less time manually recording listing details.

Acceptance criteria:
- The extension recognizes all supported rental-listing pages.
- Selecting "Analyze Listing" captures the address, monthly rent, bedrooms, bathrooms, lease length, and listed amenities.
- Missing information is labeled "Not listed" rather than guessed.
- Users can correct extracted information.
- Corrected information is saved and used in the listing's scorecard.
- Unsupported pages display a clear message without causing an error.

User stories:
- US1 Detect a Supported Listing (3, M): as a Cal Poly student searching for housing, I want to know when the extension supports the rental webpage I am viewing so that I can determine whether the listing can be analyzed.
- US2 Extract Listing Information (5, L): as a Cal Poly student, I want to automatically capture the address, rent, bedrooms, bathrooms, lease information, and amenities from a rental listing so that I do not have to record the information manually.
- US3 Correct Extracted Information (3, M): as a Cal Poly student, I want to correct missing or inaccurate listing information so that my housing evaluation is based on accurate data.

## F2: Personalized Fit Score (13, XXL)

Benefit hypothesis: if each listing receives a personalized Fit Score based on the student's priorities, then at least 70% of pilot users will report that it is easier to identify their best housing options.

Acceptance criteria:
- Users can enter and update their budget, transportation, lease, room, parking, laundry, pet, utility, and furnishing preferences.
- Every analyzed listing receives a score from 0–100.
- The score is calculated using the user's saved preferences.
- Changing a preference automatically recalculates the score.
- The scorecard explains the most important factors affecting the score.
- The scorecard displays both benefits and watch-outs.
- The same listing and preferences consistently produce the same score.

User stories:
- US4 Enter Housing Preferences (5, L): as a Cal Poly student, I want to enter my budget, transportation needs, lease preferences, and desired amenities so that the extension can evaluate listings based on what matters to me.
- US5 Calculate a Fit Score (8, XL): as a Cal Poly student, I want to receive a personalized Fit Score from 0–100 for each rental so that I can quickly determine how well it meets my housing needs.
- US6 View Benefits and Watch-Outs (5, L): as a Cal Poly student, I want to see the main benefits and watch-outs affecting a listing's Fit Score so that I can understand its tradeoffs before applying.

## F3: Cal Poly Commute Information (8, XL)

Benefit hypothesis: if students can see Cal Poly-specific distance and travel-time information, then at least 80% of pilot users will be able to evaluate a listing's commute without opening a separate mapping application.

Acceptance criteria:
- The listing address is compared with the Cal Poly campus location.
- The scorecard displays distance in miles.
- Available walking, biking, driving, and public-transit times are displayed.
- Commute information is included in the Fit Score.
- The calculation uses the student's preferred transportation method.
- Changing the transportation preference recalculates the Fit Score.
- Missing or invalid addresses produce a clear error message instead of inaccurate commute information.

User stories:
- US7 Calculate Distance to Cal Poly (5, L): as a Cal Poly student, I want to see the distance between a rental and the Cal Poly campus so that I can determine whether the location is convenient.
- US8 View Travel Times (5, L): as a Cal Poly student, I want to see estimated walking, biking, driving, and public-transit times so that I can compare my transportation options.
- US9 Apply Commute to Fit Score (5, L): as a Cal Poly student, I want to have my preferred transportation method included in the Fit Score so that rentals with impractical commutes receive a lower rating.

## F4: Shared Roommate Master List (13, XXL)

Benefit hypothesis: if roommates can save and compare listings in one shared location, then at least 75% of pilot groups will report spending less time searching through tabs, spreadsheets, and group chats.

Acceptance criteria:
- A user can create and name a shared housing list.
- Each shared list has a unique invitation link.
- Invited roommates can access the same list.
- Users can save and remove listings.
- Duplicate listings are identified before being added.
- Every saved listing displays its Fit Score, rent, primary benefit, main concern, and current status.
- Authorized group members can add notes and update listing information.
- Changes made by one member appear for the other group members.
- Unauthorized users cannot access a private shared list.

User stories:
- US10 Create a Shared List (5, L): as a student searching for housing with roommates, I want to create a shared housing list so that everyone can review the same rental options.
- US11 Save a Listing (5, L): as a student searching for housing, I want to save a rental to a master list so that I do not lose a promising housing option.
- US12 Invite Roommates (5, L): as a student searching with roommates, I want to invite my roommates to a shared list so that we can review and compare listings together.

## F5: Total Cost and Lease Risk Breakdown (8, XL)

Benefit hypothesis: if students can see the estimated total cost and major lease risks for each rental, then at least 70% of pilot users will identify one or more expenses or lease conditions that were not obvious from the advertised rent.

Acceptance criteria:
- The scorecard separates base rent, estimated utilities, parking costs, deposits, and other listed fees.
- The tool calculates an estimated monthly total.
- The tool identifies whether the lease is school-year, month-to-month, or 12 months.
- A 12-month lease can be flagged as a watch-out based on the user's preference.
- Unknown costs are labeled as estimates or "Not listed."
- Missing information is converted into suggested questions for the landlord.
- Costs and lease risks affect the Fit Score when they conflict with the user's preferences.

User stories:
- US13 Estimate Total Monthly Cost (5, L): as a budget-conscious student, I want to see the estimated total monthly cost, including rent, utilities, and parking, so that I can determine whether I can truly afford the rental.
- US14 Identify Lease Length (3, M): as a Cal Poly student, I want to know whether a rental requires a school-year, month-to-month, or 12-month lease so that I can avoid paying for months when I will not live there.
- US15 Flag Missing Cost Information (3, M): as a Cal Poly student, I want to see which costs and fees are missing from a listing so that I know what questions to ask the landlord before applying.

## F6: Tour and Decision Workflow (8, XL)

Benefit hypothesis: if roommates can track tours, questions, notes, and decisions within their shared list, then at least 70% of pilot groups will report feeling more organized and confident when selecting a rental.

Acceptance criteria:
- Users can assign each listing a status: Saved, Considering, Tour Scheduled, Applied, Rejected, or Selected.
- Users can enter a tour date and time.
- Group members can add and view dated notes.
- Group members can record questions to ask the landlord.
- Users can select at least two finalist listings for side-by-side comparison.
- The comparison displays Fit Score, total cost, commute, lease length, benefits, and concerns.
- Status, tour, and note changes are visible to authorized group members.
- Notes and decisions remain saved after users close and reopen the extension.

User stories:
- US16 Update Listing Status (3, M): as a student searching with roommates, I want to update each listing's status so that everyone knows whether it is saved, being considered, scheduled for a tour, applied to, rejected, or selected.
- US17 Add Tour Notes and Questions (5, L): as a student attending a rental tour, I want to add notes and landlord questions to the listing so that important information is available to all my roommates.
- US18 Compare Finalists (8, XL): as a student making a housing decision with roommates, I want to compare our finalist listings side by side so that we can agree on the rental that best fits the group's needs.
