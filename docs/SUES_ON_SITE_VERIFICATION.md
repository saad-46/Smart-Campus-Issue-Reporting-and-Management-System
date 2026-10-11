# SUES campus: on-site verification checklist

**Status: not started.** Nobody has inspected the campus for this project. The map is research-based (official documents and OpenStreetMap), and every position below keeps the confidence it had on 2026-10-09. This document is what a person with permission to walk the campus fills in so those statuses can be raised **with evidence**.

Source of truth: `data/campuses/sues-hyderabad/` (`locations.json`, `geometry.json`, `research-sources.json`). If the dataset changes, update this checklist; `tests/unit/campusData.test.ts` fails when an id here goes out of date.

## Rules

1. **Evidence before status.** A place is "Verified" only when an observation made on site, a dated photograph and an official source (or a second independent observation) agree on both **what it is** and **where it is**. One phone reading is "Corroborated" at most.
2. **Field observations are not official sources.** Record them as a new source of kind `field-observation` with the date and the observer, never as a college document.
3. **Never infer a building's identity from its shape, size or nearness.** A block is identified by a sign, a door plate, a staff member's confirmation or an official plan, and the identifying evidence is photographed.
4. **Do not use the campus centre as a position** for anything unplaced. If a place can't be found, record "not found" and leave it unplaced.
5. **Permission first.** Ask the college office before surveying. Stay in areas open to students. Do not enter restricted rooms or staff areas, and do not record security equipment, keys, access codes or room lists.
6. **No people.** Do not photograph students or staff. Keep faces, vehicle plates and ID cards out of frame. Do not write names of individuals in the notes.
7. **Do not change the dataset during the survey.** Fill in the observation template; a reviewer updates `locations.json` and `research-sources.json` afterwards, citing the observation.

## How to record a GPS observation safely

- Use a phone outdoors, away from walls, with location accuracy set to "precise". Wait 30 to 60 seconds for the reading to settle.
- Note the **accuracy figure** the phone shows (for example ±5 m). A reading worse than ±15 m is "approximate" evidence only.
- Take **three readings** a minute apart at the same spot; record all three and the date and time. Use the entrance or the foot of the wall, not the middle of the footprint, and say which.
- Take one photo facing the thing observed and one showing the sign, plate or landmark that identifies it. Name files `<place-id>-<yyyymmdd>-<n>.jpg`.
- Do not post readings, photos or this document's filled-in copy publicly until the college has agreed.

## Observation template

Copy one block per place. All fields are required unless marked optional.

```text
Place ID:                 (from the tables below)
Existing name:
Existing status:          (verified / corroborated / approximate / conflicting / unverified / unplaced)
Observed what:            (what the thing is, in the words of the sign or plate)
Identifying evidence:     (sign text, plate, official plan, confirmed by role not name)
Observed latitude, longitude, phone accuracy (m):
Readings:                 (3, with time)
Observation date and time:
Observer:                 (initials)
Photo references:         (file names)
Verification method:      (sign / plate / plan / staff confirmation / GPS only)
Footprint matched:        (OSM way id from the footprint table, or "none", or "not applicable")
Confidence after:         (verified / corroborated / approximate / unverified)
Reviewer notes:
Approval required:        (name and date of the person allowed to raise the status)
```

## 1. Mapped places (9)

| Place ID | Name | Current position (±m) | Status | What to establish |
| --- | --- | --- | --- | --- |
| `blocks-1-2-5` | Blocks 1, 2 and 5 area | 17.4285, 78.4439 (±30) | approximate | The exact location of **each** of Blocks 1, 2 and 5, and which mapped footprint each is |
| `blocks-3-4` | Blocks 3 and 4 area | 17.4277, 78.4420 (±60) | approximate | Each of Blocks 3 and 4, and the seminar hall; which footprint each is. Longitude was printed to three decimals only |
| `ghulam-ahmed-hall` | Ghulam Ahmed Hall | 17.4282, 78.4435 (±60) | conflicting | The auditorium's actual position. Official photographs disagree by about 240 m (see section 3) |
| `college-of-pharmacy` | Sultan-ul-Uloom College of Pharmacy | 17.427733, 78.443553 (±40) | approximate | Its main entrance and whether the OSM outline (way 737603230) is this college |
| `sports-grounds` | Sports grounds | 17.4290, 78.4451 (±60) | approximate | Where each court and ground is; the grounds lie outside the mapped college outline, so whether they belong to this campus boundary |
| `physical-education` | Shuttle court (Physical Education) | 17.4283, 78.4429 (±30) | approximate | The court beside the "Physical Education" sign |
| `gymnasium` | Gymnasium | 17.4270, 78.4416 (±80) | approximate | The gymnasium's entrance; latitude was printed to three decimals |
| `garden` | Garden | 17.427552, 78.441702 (±20) | approximate | That the OSM park way 737554364 is the garden operated by the college |
| `sbi` | State Bank of India (as mapped) | 17.4275672, 78.4422612 (±20) | unverified | Whether the branch is inside the campus, and who may use it |

## 2. Reportable locations with no known position (6)

These have no marker and are counted as "not placed". Do **not** place one at the campus centre or at a nearby footprint. If it is found, record its entrance position and the identifying evidence.

| Location ID | Name | Institution | Find |
| --- | --- | --- | --- |
| `mjcet-central-library` | S.M. Nizamuddin Central Library | MJCET | Which block or building holds it, its entrance, its floor |
| `law-college` | Sultan-Ul-Uloom College of Law | College of Law | Its building and entrance on this campus |
| `aakcba-college` | Amjad Ali Khan College of Business Administration | College of Business Administration | Its building and entrance |
| `gacoe-college` | Ghulam Ahmed College of Education | College of Education | Its building and entrance |
| `sujc-college` | Sultan-Ul-Uloom Junior College | Junior College | Its building and entrance; its own site says only "Banjara Hills", so also confirm it is on this campus |
| `sups-bh-school` | Sultan-ul-Uloom Public School, Banjara Hills | Public School | Its building and entrance (the CBSE address is Mount Pleasant) |

For each, also note whether it shares a building with another institution; the dataset records one place per location and does not say that.

## 3. Ghulam Ahmed Hall: conflicting positions

| Evidence | Position | Date | Source id |
| --- | --- | --- | --- |
| Geotagged photograph inside the hall | 17.4282, 78.4435 | 24 Nov 2018 | `naac-411-c` |
| Geotagged photograph inside the hall | 17.4282, 78.4435 | 5 Nov 2022 | `naac-411-c` |
| Geotagged photograph inside the hall | 17.4270, 78.4416 | 2 Jan 2023 | `naac-411-c` |

To resolve: stand at the hall's main door, record three readings and photograph the name board. Then check whether the 2023 photograph's position is instead the gymnasium (`gymnasium` is geotagged at the same 17.4270, 78.4416) or a second hall or lobby. Record which explanation the evidence supports; do not pick one without it.

## 4. Mapped footprints (6): which building is which

OpenStreetMap names none of these. They are shown as "Mapped building A to F, use not verified". For each: what is it called, what is it used for, which block or institution, and is it the same building as a place above.

| Label | OSM way | Approx. position | Name / use (to fill) | Matches place or location |
| --- | --- | --- | --- | --- |
| A | `way/340051389` | 17.42776, 78.44243 | | |
| B | `way/897374294` | 17.42832, 78.44257 | | |
| C | `way/775585790` | 17.42766, 78.44291 | | |
| D | `way/340053345` | 17.42843, 78.44324 | | |
| E | `way/340053359` | 17.42762, 78.44326 | | |
| F | `way/339688893` | 17.42851, 78.44371 | | |

Also record which of Blocks 1 to 5 stand in which footprint, using the block signs, not the order in which they appear on the map.

## 5. Gates (6 mapped barrier nodes)

The dataset draws these as "mapped gates"; none is confirmed as an entrance in use.

| OSM node | Position | Is it a gate? | Open to pedestrians / vehicles | Main entrance? | Signage text |
| --- | --- | --- | --- | --- | --- |
| `node/7682407084` | 17.42752, 78.44145 | | | | |
| `node/10803590216` | 17.42739, 78.44367 | | | | |
| `node/11038449765` | 17.42724, 78.44187 | | | | |
| `node/11039323503` | 17.42880, 78.44262 | | | | |
| `node/11039323504` | 17.42739, 78.44462 | | | | |
| `node/11039495994` | 17.42725, 78.44146 | | | | |

Do not record guard posts, cameras or schedules. Only whether a gate exists and who may pass.

## 6. Campus boundary and area

| Item | Current | To establish |
| --- | --- | --- |
| Boundary | none asserted | Walk the perimeter only where publicly accessible; record corner readings. An official site plan or the college office is the stronger evidence |
| Area | 25 acres (college site), 22 acres (Wikipedia), about 5.4 acres mapped (OSM, incomplete) | The figure the college itself gives, in writing, and what it covers |
| Sports grounds | outside the mapped outline | Whether they are inside the same boundary |

## 7. After the survey (reviewer)

1. Add each observation to `research-sources.json` as a source with `kind: "field-observation"`, the date and the observer's initials.
2. Raise a status only when rule 1 is met; otherwise leave it and add the observation to the record's notes.
3. For a newly found position, add `latitude`, `longitude` and `precisionMeters` (the phone accuracy, not a hopeful figure) to the place, and give the location its `placeId`.
4. Name a footprint only when the identifying evidence is on file. Keep "use not verified" otherwise.
5. Run `npm test` (the dataset tests enforce unique ids, valid sources and that no place is rated verified without a source), then look at the map.
6. Update `docs/SUES_CAMPUS_RESEARCH.md` counts and `lastVerifiedAt`.

| Place or location | Status before | Evidence | Status after | Reviewer | Date |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
