# San Luis Obispo cost defaults for the Cost Breakdown

Research for issue #6. Accessed 2026-10-07. All amounts are monthly, per person, unless marked. "Per person" divides a household figure by the number of bedrooms (one student per bedroom), which is how the Estimated Monthly Total is defined in `CONTEXT.md`.

Scope: Estimates for Not Listed recurring costs (electricity/gas, water/sewer/trash, internet, parking), deposit and application-fee ranges under California law, which costs scale with bedroom count, and the lease structures Cal Poly students are offered. The Campus Reference Point question in the ticket title is answered in one short section at the end; the map (#1) is not touched.

## 1. Defaults table

| Cost line | Recommended Estimate (per person) | Scales with | Confidence | Basis |
|---|---|---|---|---|
| Electricity + gas | **$55** for a 4-bedroom house; formula `($85 + $35 x bedrooms) / bedrooms` -> 2BR $78, 3BR $63, 4BR $56, 5BR $52 | Weakly with occupants (fixed loads dominate) | Medium. Tariff prices are primary and current; usage is an assumption anchored on PG&E's own Territory T baseline. | §2.1 |
| Water + sewer + trash | **$60** for a 4-bedroom house; formula `($110 + $30 x bedrooms) / bedrooms` -> 2BR $85, 3BR $67, 4BR $58, 5BR $52. Use **$0** when the listing says water/trash included (common in apartments). | Water/sewer: linearly with occupants plus a fixed base. Trash: fixed per household, steps up at the 64-gal cart. | Medium-high. Every rate is from the city or franchised hauler schedule; only gallons-per-person is assumed. | §2.2 |
| Internet | **$40 per household / bedrooms**, floor $10 -> 2BR $20, 3BR $13, 4BR $10 | Fixed per household | Medium. Spectrum/AT&T list prices are primary but promotional; post-promo is +$10. | §2.3 |
| Parking | **$0** if the listing states off-street parking; **$2** in a city Residential Parking District ($20/yr permit); **$45** if the listing says "paid parking" with no amount (city garage benchmark) | Per car, not per bedroom | High for the city prices; low for how often a listing's "paid parking" matches the garage price. | §2.4 |
| Security deposit (one-time) | **1 x monthly rent** (household), i.e. one month of the per-person rent. Flag anything above 1x as a Watch-out unless the landlord is a "small landlord" (max 2x). | Rent | High (statute). | §3.1 |
| Application / screening fee (one-time) | **$65.86 per applicant** (2026 statutory cap), i.e. per roommate | Number of applicants | High for the statute; medium for the 2026 dollar figure (CPI figure republished from the California Apartment Association). | §3.2 |

Combined utilities (electricity + gas + water/sewer/trash) come to about **$115 per person in a 4-bedroom house** where tenants pay everything, and about $55 where the landlord pays water and trash. The Figma demo value of $90 "utilities" sits between those two cases and is defensible only as a blend; the two-line split above is recommended so the Estimate can drop to the right value when a listing says "water/trash included".

Rent context (not an Estimate; for sanity-checking captured rent): HUD's revised FY2026 Fair Market Rents for the San Luis Obispo-Paso Robles MSA are $1,842 (0BR), $2,036 (1BR), $2,671 (2BR), $3,584 (3BR), $4,105 (4BR) at the 40th percentile, i.e. $1,336 / $1,195 / $1,026 per bedroom for 2/3/4BR ([HUD FY2026 FMR revision notice, Federal Register 2026-07741](https://public-inspection.federalregister.gov/2026-07741.pdf), published 2026-04-21, effective 30 days after publication). Cal Poly's 2025-26 undergraduate cost of attendance budgets $13,761 for off-campus housing and $7,146 for meals over the academic year of fall, winter and spring quarters, about $1,529/month housing over nine months ([Cal Poly Financial Aid, 2025-26 undergraduate COA](https://www.calpoly.edu/financial-aid/costs-and-affordability/undergraduate-costs-attendance-2025-26)).

## 2. Recurring costs

### 2.1 Electricity and gas (PG&E)

PG&E serves San Luis Obispo for both electricity and gas; the city does not run an electric or gas utility.

Electric prices, effective March 1, 2026 ([PG&E residential rate plan pricing sheet](https://www.pge.com/assets/pge/docs/account/rate-plans/residential-electric-rate-plan-pricing.pdf.coredownload.pdf)):

| Plan | Season | Below baseline | Above baseline |
|---|---|---|---|
| E-1 tiered | all year | 33¢/kWh (Tier 1) | 41¢/kWh (Tier 2) |
| E-TOU-C (default), off-peak | summer Jun 1-Sep 30 | 32¢ | 40¢ |
| E-TOU-C, peak 4-9 p.m. | summer | 44¢ | 52¢ |
| E-TOU-C, off-peak | winter Oct 1-May 31 | 29¢ | 32¢ |
| E-TOU-C, peak 4-9 p.m. | winter | 37¢ | 40¢ |

The sheet says "For the latest rate plan prices (cost kWh) visit our Tariffs page", so these move several times a year.

Baseline allowance. San Luis Obispo is in PG&E Baseline Territory T. Schedule E-1 Special Condition 2 lists Territory T basic (Code B) quantities of **6.5 kWh/day summer and 7.5 kWh/day winter** (all-electric Code H: 7.1 summer, 12.9 winter) ([PG&E Electric Schedule E-1, Baseline Quantities table](https://www.pge.com/tariffs/assets/pdf/tariffbook/ELEC_SCHEDS_E-1.pdf)). PG&E states the allowance "must represent 50 to 60 percent of the electricity needs of the average customer in each territory" ([PG&E baseline allowance page](https://www.pge.com/en/account/rate-plans/how-rates-work/baseline-allowance.html)), which implies an average Territory T household uses roughly 360-415 kWh/month, below the California residential average of 503 kWh/month at 31.97¢ and a $160.86 average bill ([EIA 2024 Average Monthly Bill - Residential, Table 5A](https://www.eia.gov/electricity/sales_revenue_price/pdf/table_5a.pdf)).

Gas. PG&E's bundled residential non-CARE rate is **$2.792/therm** as of March 1, 2026 (CARE $2.211), and PG&E's own "average Non-CARE residential gas bill (31 therms)" is **$86.54/month** ([PG&E Gas Rate Advisory, effective March 1, 2026](https://www.pge.com/assets/pge/docs/account/rate-plans/gas-rate-advisory-0326.pdf)).

Household scenarios (computed from the prices above; assumptions: 30% of kWh in the 4-9 p.m. peak, household usage 250 + 40 x occupants kWh and 8 + 5 x occupants therms, SLO's mild climate keeping gas below the PG&E system average):

| Occupants | kWh | Electricity | Therms | Gas | Electricity + gas per person |
|---|---|---|---|---|---|
| 2 | 330 | $114 | 18 | $50 | **$82** |
| 3 | 370 | $129 | 23 | $64 | **$64** |
| 4 | 410 | $144 | 28 | $78 | **$55** |
| 5 | 450 | $159 | 33 | $92 | **$50** |

Confidence: medium. Prices and the Territory T baseline are primary and current. The usage assumptions are the weak link; a house with electric heat or a hot tub will exceed these, and apartments with gas water heating paid by the landlord will fall below. Scaling: per-person cost falls as bedrooms rise because refrigerator, water heater standby and Wi-Fi are fixed.

### 2.2 Water, sewer and trash (City of San Luis Obispo and San Luis Garbage)

Water and sewer are billed by the City's Utilities Department. Rates were adopted in three steps; the step in force today is July 1, 2025 ([City of SLO Water and Sewer Rates](https://www.slocity.org/government/department-directory/utilities-department/utility-billing/water-and-sewer-rates)):

| Item | Jul 1, 2024 | **Jul 1, 2025** | Jul 1, 2026 |
|---|---|---|---|
| Single-family water base fee (monthly) | $30.25 | **$31.91** | $33.67 |
| Water Tier 1, 0-5 units | $8.54 | **$9.01** | $9.51 |
| Water Tier 2, 6-12 units | $9.84 | **$10.38** | $10.95 |
| Water Tier 3, 13+ units | $16.97 | **$17.90** | $18.88 |
| Multi-family water, all use | $9.58 | **$10.11** | $10.67 |
| Single-family sewer base fee (monthly) | $24.52 | **$26.11** | $27.81 |
| Residential sewer volumetric (up to cap) | $9.82 | **$10.46** | $11.14 |

"One unit of water = 1 CCF = 748 gallons." A 5% Utility Users Tax applies to the whole water portion of the bill. Residential sewer volume is capped at winter (Dec-Feb) water use; new single-family accounts default to a 5-unit cap and new multi-family accounts to 4 units per dwelling (same page). The city page carries a July 2026 step, but a February 23, 2026 city session said the rate structure itself is under review ([Edhat notice of the SLO utility-rates community conversation](https://www.edhat.com/slo/news/slo-public-information-session-understanding-utility-rates-a-community-conversation/)); treat the July 2026 column as provisional.

Trash is billed directly by the franchised hauler, San Luis Garbage Company. The City adopted the 2025 rates on March 18, 2025 effective March 19, 2025 ([City of SLO public hearing notice](https://www.slocity.org/Home/Components/News/News/11029/2322)), and the hauler's City of San Luis Obispo table shows a 5.13% adjustment effective January 1, 2026 giving bundled residential cart rates of **$26.71 (32-gal), $53.41 (64-gal), $80.14 (96-gal)** per month, with one organics cart and one recycling cart included at no extra cost ([San Luis Garbage, City of SLO 2026 rate table](https://www.sanluisgarbage.com/assets/docs/uploads/city-of-slo-2026-rates.pdf), linked from [sanluisgarbage.com/rates](https://www.sanluisgarbage.com/rates)).

Household scenarios at 50 gallons per person per day indoor use (California's residential indoor standard is 47 gpcd):

| Occupants | Water units | Water incl. 5% UUT | Sewer | Trash cart | Water + sewer + trash per person |
|---|---|---|---|---|---|
| 2 | 4.1 | $72 | $69 | 32-gal $27 | **$84** |
| 3 | 6.1 | $93 | $78 | 32-gal $27 | **$66** |
| 4 | 8.1 | $115 | $78 | 64-gal $53 | **$62** |
| 5 | 10.2 | $137 | $78 | 64-gal $53 | **$54** |

Confidence: medium-high on the rates (all primary, current), medium on the gallons assumption. Scaling: water/sewer rise with occupants but carry about $58/month of fixed base fees; trash is a per-household step function. Apartment listings frequently include water and trash in rent (several properties on Cal Poly's marketplace list "Water/Sewer" and "Trash" under utilities included, [findoffcampushousing.calpoly.edu](https://findoffcampushousing.calpoly.edu/)), so this line should go to $0 when a listing says so and generate a Landlord Question otherwise.

### 2.3 Internet

Three wireline providers advertise in the city.

- Spectrum: Internet 100 **$30/mo** "Year 1" (regular $40), Internet 500 $40 ($50), 1 Gig $60 ($70); Advanced WiFi $10/mo extra on the two lower tiers ([Spectrum internet plans](https://www.spectrum.com/internet/plans); Spectrum's SLO city page returned 404, so this is the national price sheet).
- AT&T Fiber (limited addresses): Internet 300 **$35/mo plus tax**, Internet 500 $50, Internet 1000 $65; new-customer promo $15/mo for 12 months on 300/500 ([AT&T Fiber San Luis Obispo](https://www.att.com/local/fiber/california/san-luis-obispo)).
- Astound (about 17% of city addresses per an aggregator): from about $30/mo; no provider-run SLO price page was found ([CableTV.com SLO listing](https://www.cabletv.com/internet-near-me/ca/san-luis-obispo), secondary).

Default: **$40 per household**, split by bedrooms (2BR $20, 4BR $10). The Figma's $20 per person matches a two-person household. Confidence: medium; promotional prices are primary but expire after 12 months (+$10) and equipment fees vary. Scaling: fixed per household.

### 2.4 Parking

- City Residential Parking District permit: **$20 per permit per year**, maximum two per address, expires September 15; available only to the property owner or an authorized agent, so tenants need the owner to file an Authorization Form ([City of SLO Residential Permits](https://www.slocity.org/government/department-directory/public-works/parking-services/residential-permits)). That is about $2/month and only applies inside a district.
- City downtown garage permit: **$45/month** covering 842 Palm, 919 Palm and 871 Marsh; hourly $2, daily max $8 ([City of SLO Parking Structures](https://slocity.org/government/department-directory/public-works/parking-services/parking-guide/parking-structures)).
- Cal Poly commuter permit (a Commute cost, not a housing cost, but relevant when Transport Mode is car): Commuter Annual **$519**, valid 8/24/2026-5/21/2027; Commuter Grand Annual $720; semester $259.50 ([Cal Poly Parking permit fees](https://afd.calpoly.edu/parking/slo/parking-on-campus/permits/general)). About $58/month over nine months.
- Private complexes charge parking as a monthly add-on fee but publish no standard price (Mustang News notes monthly payments "include additional fees, such as parking" at Mustang Village, [Mustang News, Oct 20 2025](https://mustangnews.net/housing-advice-mustang-village/)).

Default: $0 when the listing states off-street parking; otherwise Not Listed plus a Landlord Question; $45 only when a listing says parking is paid without an amount. Confidence: high on the city prices, low on applying the garage price to a private lot. Scaling: per car.

## 3. One-time costs under California law

### 3.1 Security deposit (Civil Code §1950.5)

Civil Code §1950.5(c)(1): "a landlord shall not demand or receive security, however denominated ... in an amount or value in excess of an amount equal to one month's rent, in addition to any rent for the first month paid on or before initial occupancy." The one-month cap was enacted by AB 12 (Haney, 2023) and applies to deposits collected on or after **July 1, 2024**; before that the limits were two months' rent unfurnished and three months furnished ([Senate Judiciary Committee analysis of AB 12](https://sjud.senate.ca.gov/sites/sjud.senate.ca.gov/files/ab_12_haney_sjud_analysis.pdf); [City and County of San Francisco notice on the July 1, 2024 change](https://www.sf.gov/news--security-deposit-laws-are-changing-july-1-2024)). Exceptions in §1950.5(c): a "small landlord" who is a natural person (or an LLC of natural persons) owning no more than two residential rental properties with no more than four units in total may collect up to **two months' rent**, except from a service member; a landlord may still require advance payment of six months' rent on a lease of six months or longer. Deposits must be itemized and returned within **21 calendar days** of move-out (§1950.5(h)). Statute text: [leginfo.legislature.ca.gov §1950.5](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5) (verified against the mirror at [california.public.law](https://california.public.law/codes/civil_code_section_1950.5), updated Jan 1, 2026, because leginfo blocks automated fetches).

Default for the Cost Breakdown: deposit Estimate = **1 x monthly rent**; show "up to 2x if small landlord" in the Landlord Question; a captured deposit above 1x is a Watch-out. Cal Poly's own "Know Your Housing Rights" fact sheet (created August 2022) still states the old two-times/three-times limits ([Cal Poly Dean of Students fact sheet](https://content-calpoly-edu.s3.amazonaws.com/deanofstudents/1/images/Know-Your-Housing-Rights_Fact-Sheet.pdf)); do not use it as the source for the cap.

### 3.2 Application screening fee (Civil Code §1950.6)

§1950.6(b): "In no case shall the amount of the application screening fee charged by the landlord or their agent be greater than thirty dollars ($30) per applicant", adjustable "annually ... commensurate with an increase in the Consumer Price Index, beginning on January 1, 1998", and never more than "the actual out-of-pocket costs of gathering information concerning the applicant". Since January 1, 2025 (AB 2493) the landlord must either approve the first qualified applicant in order received or refund the fee to every applicant not selected within 7 days of selecting a tenant or 30 days after application, whichever is first (§1950.6(c)(2)). A landlord may accept a reusable screening report under §1950.1 (§1950.6(g)). Statute text: [leginfo §1950.6](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.6) (verified via [california.public.law](https://california.public.law/codes/civil_code_section_1950.6)).

CPI-adjusted cap: the California Apartment Association publishes the figure each December behind a member wall ([CAA, "Maximum applicant screening fee increase for 2026"](https://caanet.org/maximum-applicant-screening-fee-increase-for-2026/)); republished as **$65.86 for 2026** (up from $64.50 in 2025) by a property-management firm citing CAA ([Lifetime PM, Apr 4 2026](https://www.lifetimepm.com/blog/california-tenant-screening-fee-2026-ab-2493-compliance)). Default: **$65.86 per applicant** (each roommate who applies pays it). Confidence: high on the statute, medium on the dollar figure.

## 4. Lease structures offered to Cal Poly students

1. **Off-campus leases are predominantly 12-month, starting mid-summer or September.** Mustang News describes landlords near campus "with leases starting mid summer in accordance with the school year" and students who "cannot secure a full year's worth of living" ([Mustang News, Jan 23 2025](https://mustangnews.net/opinion_housing_nepotism/)); Fairview Apartments offers "September-to-September leases", described as "Year-long leases" ([Mustang News, Jun 2 2025](https://mustangnews.net/leasing-agencies-face-changes-amidst-semester-advice/)). A listing near campus shows August 1-July 29 ([N Chorro St listing](https://citizenremote.com/apartments/san-luis-obispo/n-chorro-st-san-luis-obispo-ca-648913/), single data point).
2. **Academic-year terms exist mainly on campus and at purpose-built student housing.** University Housing's license is "a binding contract for the full academic year" ([Cal Poly University Housing, continuing students](https://housing.calpoly.edu/student-housing/continuing-student-housing)); Poly Canyon Village leases "span nine months" ([Morning Mustang newsletter](https://morning-mustang.beehiiv.com/p/pcv-pricetag-nearly-doubled-in-8-years)). Cal Poly's marketplace lists "Individual Leases" as an amenity at some complexes ([findoffcampushousing.calpoly.edu](https://findoffcampushousing.calpoly.edu/)). Mustang Village includes furniture, electricity and water in rent ([Mustang News, Oct 20 2025](https://mustangnews.net/housing-advice-mustang-village/)). Treat the School-year Lease Type as the exception that must be explicitly stated.
3. **Signing season runs November through February for the following fall.** Cal Poly's Off-Campus Housing Program: "Most students start looking for fall housing near the end of the prior term"; "Some property managers open applications as early as the end of fall term for the upcoming year"; spring searchers should ask about cancellations ([Cal Poly Dean of Students, Off-Campus Housing](https://deanofstudents.calpoly.edu/offcampushousing)). Mustang News: "students should sign a lease by November to secure housing for the next year" and be "ready for leases to open in November", with the Off-Campus Housing fair on November 13 ([Mustang News, Oct 6 2025](https://mustangnews.net/the-housing-hunt-5-tips-for-navigating-the-off-campus-housing-search/)); upperclassmen advise "have your lease signed by week 5 of winter quarter" ([Mustang News, Jan 23 2025](https://mustangnews.net/opinion_housing_nepotism/)). A February 2021 student quote: "Usually around this time everyone is already trying to find housing or housing is already gone" ([KCBX, Feb 3 2021](https://www.kcbx.org/housing/2021-02-03/cal-poly-students-weigh-fall-housing-options)).
4. **Summer subleasing follows from 12-month leases.** Students who miss the season "end up subleasing come fall quarter" ([Mustang News, Jan 23 2025](https://mustangnews.net/opinion_housing_nepotism/)), and the Off-Campus Housing Program notes listing sites "may not reflect lease takeover opportunities" ([Cal Poly Dean of Students](https://deanofstudents.calpoly.edu/offcampushousing)). Mustang News reports that living "off lease" is common as a way to cut rent ([KCBX interview with Mustang News, 2019](https://www.kcbx.org/housing/2019-03-04/kcbx-two-way-the-legality-of-living-off-lease-in-san-luis-obispo)).
5. **Semester conversion is moving lease dates earlier in 2026-27.** Cal Poly's first semester is fall 2026 ([semesters.calpoly.edu](https://semesters.calpoly.edu/)) with commuter permits valid from **8/24/2026** ([Cal Poly Parking fees](https://afd.calpoly.edu/parking/slo/parking-on-campus/permits/general)); JDR Real Estate Services plans to restructure leases "to begin Aug. 1" and the Off-Campus Housing Program emailed landlords about "adjusted start and end dates" ([Mustang News, Jun 2 2025](https://mustangnews.net/leasing-agencies-face-changes-amidst-semester-advice/)).

Implications for F5: Lease Type detection should default to 12-month when a listing gives a 12-month term or an August/September start with no end date; School-year should require an explicit 9- or 10-month term; the 12-month Watch-out text can say that summer months are typically covered by subleasing. The Not Listed Landlord Question should ask for start date, end date, and early-termination/sublet terms, since the semester shift means 2026-27 start dates vary by landlord.

## 5. Campus Reference Point (note for #1, not a change to it)

Cal Poly's published street address is "1 Grand Avenue, San Luis Obispo, CA 93407", and the university directs visitors to the Welcome Center "in the Yakʔitʸutʸu residential center" at the Grand Avenue entrance ([Cal Poly Visit](https://www.calpoly.edu/visit)). The Grand Avenue entrance is the natural single Campus Reference Point for Commute because it is the geocodable official address and the campus edge nearest most student rentals; the map ticket (#1) owns the final choice.

## 6. Method and gaps

- Primary sources: PG&E tariff sheets and rate advisory, City of SLO utility billing and parking pages, San Luis Garbage rate table, Civil Code text, HUD Federal Register notice, Cal Poly Financial Aid, Dean of Students, University Housing and Parking pages. Secondary where unavoidable: Mustang News (Cal Poly's student paper) and KCBX for lease timing; one property-management blog for the CPI-adjusted screening-fee figure; one aggregator for Astound.
- `slocity.org` and `leginfo.legislature.ca.gov` block automated fetches; the city pages were read through a text proxy and the statutes were cross-checked against a verbatim mirror.
- Not found: a Cal Poly-authored lease-timing timeline (the Dean of Students site links a "Rental Timeline" video only); a Spectrum page specific to SLO; an official state publication of the 2026 screening-fee dollar figure.
- Utility scenario inputs and formulas are in this file; the scaling formulas in §1 are linear fits to the scenario tables, within $5 per person of each computed row.
