# F2: Personalized Fit Score

**Run record**: date ______ · Chrome version ______ · tester ______ · extension commit ______

One checkbox per acceptance criterion from `docs/product-brief.md`. Run against live pages in the user's own Chrome with the `live` providers configured in `.env`.

- [ ] Preferences screen accepts budget, Transport Mode, max commute, Lease Type, room type, five amenities, four Priorities; Save persists across panel close and browser restart (`storage.sync`).
- [ ] Every analysed listing shows a 0–100 Fit Score.
- [ ] Changing budget, Transport Mode, or a Priority recomputes the score immediately, with no network request (check the Network panel: no new commute calls).
- [ ] "Why this score?" lists four categories with points out of the category maximum; the maxima sum to 100.
- [ ] Benefits and Watch-outs are shown (up to three each) and change when preferences change.
- [ ] Analysing the same listing twice with the same preferences yields the same score.
