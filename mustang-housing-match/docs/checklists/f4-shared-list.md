# F4: Shared Roommate Master List

**Run record**: date ______ · Chrome version ______ · tester ______ · extension commit ______

One checkbox per acceptance criterion from `docs/product-brief.md`. Run against live pages in the user's own Chrome with the `live` providers configured in `.env`.

Needs `VITE_SHARING_PROVIDER=appsync` and a deployed backend; use two Chrome profiles (A = owner, B = roommate).
- [ ] A creates a list with a name; the Roommates tab shows the list name and A as owner.
- [ ] "Copy invitation link" copies a link; opening it in a browser shows the join landing page.
- [ ] B pastes the link in "Join with a link", enters a name, and sees the same list name and both members.
- [ ] A saves a listing; it appears on B's Saved tab within a few seconds without reloading.
- [ ] B removes it; it disappears for A.
- [ ] Saving the same listing again (same URL, or a Manual Listing with the same address) shows the Duplicate notice and opens the existing Saved Listing.
- [ ] Each Saved Listing card shows Fit Score, rent, primary benefit, main concern, and Status.
- [ ] A Corrects a fact on a saved listing; B sees the corrected value.
- [ ] A third profile with a wrong or rotated link cannot join; after A rotates the link, the old link fails and the new one works.
- [ ] After A removes B, B's next action fails with an "unauthorized" message.
