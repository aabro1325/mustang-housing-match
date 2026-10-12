# F3: Cal Poly Commute Information

**Run record**: date ______ · Chrome version ______ · tester ______ · extension commit ______

One checkbox per acceptance criterion from `docs/product-brief.md`. Run against live pages in the user's own Chrome with the `live` providers configured in `.env`.

- [ ] With `VITE_COMMUTE_PROVIDER=live` and both keys set, analysing a listing shows distance in miles for the preferred Transport Mode.
- [ ] Walking, biking, driving and bus times are displayed; bus shows the "weekday 8 AM departure" note.
- [ ] A mode the provider cannot route shows "Not available" without breaking the others.
- [ ] Commute points change when Transport Mode changes; a time over the max commute lowers the score.
- [ ] A Manual Listing with a nonsense address shows "Address could not be located" with the "Edit address" link, the Watch-out "Address could not be located; Commute not scored", and Commute scores 0.
- [ ] With Wi-Fi off, analysing shows "Commute lookup failed" with a Retry button; Retry succeeds once online.
- [ ] Attribution lines for openrouteservice and Transitland are visible in the Commute section.
- [ ] Re-analysing the same address makes no new commute request (cached).
