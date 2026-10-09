# SUES campus research

Research behind the campus map and location list in UniFix. Sources were read on **9 October 2026**. The dataset itself is in [`data/campuses/sues-hyderabad/`](../data/campuses/sues-hyderabad/).

UniFix is a student-built project designed around this campus. It is not an official product of, or endorsed by, the Sultan-ul-Uloom Education Society or its institutions.

## Summary

- The campus is at **"Mount Pleasant", 8-2-249 to 267, Road No. 3, Banjara Hills, Hyderabad 500 034**. This comes from the college's own website and NAAC documents.
- Seven society institutions are at Mount Pleasant. Four schools in the Old City and one foundation are elsewhere and are not mapped.
- OpenStreetMap has six building footprints, roads, paths and gates inside the college area, but **names none of the buildings**.
- The college's NAAC self-study report (2023) has geotagged photographs of Blocks 1 to 5, the auditorium, the seminar hall and the sports facilities. These give camera positions to three or four decimal places, which is enough to place an area marker and not enough to say which footprint is which block.
- So the map shows real footprints without names, and **nine place markers** with a stated uncertainty. **No position is rated "verified".** Six reportable locations have no known position and are deliberately left off the map.
- No on-site survey was done. Everything here can be improved by someone walking the campus.

## How the research was done

1. Official websites of the society and each institution were fetched and read.
2. The college's NAAC SSR-2023 metric 4.1.1 documents (index and annexes C, D, E, F) were downloaded and read in full, including the geotag overlays printed on the photographs.
3. One OpenStreetMap extract of the area was downloaded through the Overpass API and converted with `scripts/import-osm-campus.mjs`.
4. Wikipedia was used only as a secondary check.

Not used: Google Maps or any paid or keyed API, any geocoding service, satellite imagery tracing, or social media. Claude Cowork was not available in this session and was not used.

## Sources

| Id | Kind | Source | What it supports |
| --- | --- | --- | --- |
| `mjcet-home` | Official | <https://www.mjcollege.ac.in/> | College name; address; "25 acre"; S.M. Nizamuddin Central Library; Seminar Hall (150 seats); Ghulam Ahmed Hall; "all the blocks in the college have ramps and lifts" |
| `mjcet-other-institutions` | Official | <https://mjcollege.ac.in/other-institutions> | The other society institutions and their websites |
| `mjcet-old-city` | Official | <https://mjcollege.ac.in/page-old-city-schools> | Four schools elsewhere in Hyderabad; no street addresses |
| `mjcet-sues-history` | Official | <https://mjcollege.ac.in/sues-history> | Society established in 1980 |
| `mjcet-sports` | Official | <https://mjcollege.ac.in/page-sports-facilities> | Which sports facilities exist; no positions |
| `naac-411-index` | Official | [MJCET-QIF-4.1.1.pdf](https://mjcollege.ac.in/naac/SSR-2023/C4/MJCET-QIF-4.1.1.pdf) | Five blocks; auditorium named Ghulam Ahmed Hall; address |
| `naac-411-f` | Official | [4.1.1-F](https://www.mjcollege.ac.in/naac/SSR-2023/C4/MJCET-QIF-4.1.1-F.pdf) | Geotagged photographs of Blocks 1 to 5 |
| `naac-411-c` | Official | [4.1.1-C](https://www.mjcollege.ac.in/naac/SSR-2023/C4/MJCET-QIF-4.1.1-C.pdf) | Geotagged photographs inside Ghulam Ahmed Hall |
| `naac-411-d` | Official | [4.1.1-D](https://www.mjcollege.ac.in/naac/SSR-2023/C4/MJCET-QIF-4.1.1-D.pdf) | Geotagged photographs of courts, grounds and the gymnasium |
| `naac-411-e` | Official | [4.1.1-E](https://www.mjcollege.ac.in/naac/SSR-2023/C4/MJCET-QIF-4.1.1-E.pdf) | Seminar hall, 150 seats; banner reads "Seminar Hall, Block-4" |
| `sucp`, `law`, `aakcba`, `gacoe`, `sujc` | Official | Each institution's website | Official names and founding years; none gives a building or position |
| `cbse-saras` | Government | [CBSE affiliation record](https://saras.cbse.gov.in/SARAS/AffiliatedList/AfflicationDetails/3630008) | Public School address at Mount Pleasant. Seen in a search result only; the record was not opened |
| `wikipedia-sues` | Secondary | [Wikipedia](https://en.wikipedia.org/wiki/Sultan-ul-Uloom_Education_Society) | "22-acre" campus; institution list |
| `osm` | Map data | [OpenStreetMap](https://www.openstreetmap.org/way/737548446) | Geometry only: outlines, footprints, roads, gates, a garden, a bank node |
| `sues-site` | Official | <https://sultanululoom.ac.in/> | Society name only. The page returned no address, list or map to the fetch tool |

## Confidence levels

| Status | Meaning |
| --- | --- |
| Verified | An official source or strong independent evidence establishes both what the place is and where it is |
| Corroborated | Several credible public sources agree, but the precise position inside the campus is not confirmed |
| Approximate | The general area is supported (for example by one official geotagged photograph), but the exact position or building is uncertain |
| Sources disagree | Sources give different positions |
| Unverified | The position, or whether the place belongs to the campus, is not established |

The app shows the status as a badge wherever a place or location appears.

## Campus

| Field | Value | Status |
| --- | --- | --- |
| Address | "Mount Pleasant", 8-2-249 to 267, Road No. 3, Banjara Hills, Hyderabad 500 034 | Verified (college website, NAAC index) |
| Centre | 17.42794 N, 78.44343 E | Corroborated: centroid of the OSM college outline; official geotags fall inside or within about 150 m |
| Stated area | 25 acres (college website); 22 acres (Wikipedia) | The two sources differ |
| Boundary | None asserted | Unverified |

**Why there is no boundary.** OpenStreetMap's college outline (way 737548446) covers about 5.4 acres, against a stated 22 to 25, and official photographs are geotagged outside it. It is drawn as a dashed "mapped college outline" and described as incomplete. It is never used as a geofence, and reports are not rejected for being outside it.

## Institutions

At Mount Pleasant:

| Institution | Founded | On this campus |
| --- | --- | --- |
| Muffakham Jah College of Engineering and Technology (MJCET) | 1980 | Verified |
| Sultan-ul-Uloom College of Pharmacy | not stated | Corroborated; OSM maps an outline with this name |
| Sultan-Ul-Uloom College of Law | 1989 | Corroborated |
| Amjad Ali Khan College of Business Administration | 1991–92 | Corroborated |
| Ghulam Ahmed College of Education | 1985 | Corroborated |
| Sultan-Ul-Uloom Junior College | 1994 | Approximate: its site says only "Banjara Hills" |
| Sultan-ul-Uloom Public School, Banjara Hills | not stated | Corroborated (CBSE address) |

Elsewhere, listed but never drawn: Sultan-Ul-Uloom Public Schools, Old City (Syed Ali Chabutra, Golconda, Khazipura, Hafiz Baba Nagar) and the SU Knowledge Hub Foundation.

## Map places (9)

| Place | Position | Within about | Status | Evidence |
| --- | --- | --- | --- | --- |
| Blocks 1, 2 and 5 area | 17.4285, 78.4439 | 30 m | Approximate | Photographs captioned Block 1, Block 2 and Block 5 share this geotag |
| Blocks 3 and 4 area | 17.4277, 78.4420 | 60 m | Approximate | Photographs captioned Block 3 and Block 4, and the seminar hall; longitude printed to three decimals |
| Ghulam Ahmed Hall | 17.4282, 78.4435 | 60 m | Sources disagree | Two photographs (2018, 2022) here; a third (2023) is geotagged 17.4270, 78.4416, about 240 m away |
| College of Pharmacy | 17.42773, 78.44355 | 40 m | Approximate | Centre of the OSM outline with that name (way 737603230); one map source |
| Sports grounds | 17.4290, 78.4451 | 60 m | Approximate | Basketball, volleyball and football photographs; OSM maps grass beside it |
| Shuttle court (Physical Education) | 17.4283, 78.4429 | 30 m | Approximate | One photograph beside a "Physical Education" sign |
| Gymnasium | 17.4270, 78.4416 | 80 m | Approximate | One photograph; latitude printed to three decimals |
| Garden | 17.42755, 78.44170 | 20 m | Approximate | OSM park named "Garden", operator MJCET (way 737554364); one map source |
| State Bank of India (as mapped) | 17.42757, 78.44226 | 20 m | Unverified | An OSM bank node; whether it is inside the campus is not established |

Counts: 0 verified, 0 corroborated, 7 approximate, 1 conflicting, 1 unverified.

The geotags are **camera positions**, not building centres, and a phone's overlay rounds them. Each marker is drawn with a dashed ring of its "within about" radius so the uncertainty is visible.

## Reportable locations (19)

Block 1, Block 2, Block 3, Block 4, Block 5, Seminar Hall (Block 4), Ghulam Ahmed Hall, S.M. Nizamuddin Central Library, Sports grounds, Shuttle court, Gymnasium, Garden, the six other institutions, and the bank as mapped.

- 13 are attached to a map place (11 approximate, 1 conflicting, 1 unverified).
- **6 have no known position** and no marker: the Central Library, and the Colleges of Law, Business Administration and Education, the Junior College and the Public School. Their existence at Mount Pleasant is supported; where they stand inside the campus is not published. Issues reported there are counted as "not placed on the map" and never guessed onto a marker.

No floors, room numbers, laboratory lists, canteens, hostels, parking areas or department locations are in the dataset, because no public source read here documents them. A reporter can type those details; the app stores them as the reporter's words.

## Map geometry

One Overpass extract, OSM base timestamp 2026-10-09T06:11:06Z, reduced to 197 features (about 53 KB):

| Feature | Count | Notes |
| --- | --- | --- |
| Campus building footprints | 6 | Ways 340051389, 897374294, 775585790, 340053345, 340053359, 339688893. Unnamed in OSM; labelled "Mapped building A–F, use not verified" |
| Mapped college outline | 1 | Way 737548446; incomplete |
| College of Pharmacy outline | 1 | Way 737603230 |
| Roads and service roads | 48 | Includes Road No. 3 |
| Paths | 6 | |
| Mapped gates | 6 | Barrier nodes within 130 m of the outline. Not confirmed as entrances in use |
| Surrounding buildings | 124 | Context only |
| Garden, grass, water | 5 | |

The map is drawn as inline SVG from this file. No tiles are loaded and no request leaves the site, which keeps the public Viewer free of external requests and needs no API key or change to the content security policy. Attribution "© OpenStreetMap contributors (ODbL)" is shown with the map.

## Conflicts and open questions

1. **Which footprint is which block.** Not established by any public source. This is the single most useful thing an on-site check would add.
2. **Ghulam Ahmed Hall** has two official geotags 240 m apart. The marker uses the position two photographs agree on and is labelled "Sources disagree".
3. **Campus area and boundary**: 25 acres, 22 acres, and a 5.4-acre mapped outline.
4. **Sports grounds** are geotagged outside the mapped college outline.
5. **Positions of the library and five institutions** are unknown.
6. **Gates**: mapped barrier nodes; which are real entrances, and which is the main gate, is unknown.
7. **The bank** may or may not be inside the campus.
8. **The society's own website** could not be read beyond its name, so the institution list rests on the college's page and each institution's site.

## How to improve this

A person on campus can settle most of the above in an hour: note which block each building is, where the library and each institution's entrance are, and which gates are used. Update `locations.json`, cite the survey as a source in `research-sources.json`, and raise the status. The tests in `tests/unit/campusData.test.ts` will hold the dataset to its rules.

## Privacy and safety

Only places already shown in public official documents or on OpenStreetMap are included. Nothing about security equipment, restricted rooms, staff quarters or individuals is recorded, and none should be added.
