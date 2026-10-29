# Metadata: California BEAD plan: Schools, providers and projects

Title: California BEAD Plan: Schools, Providers and Projects

Former title (until October 29, 2026): California Public Schools Without Gigabit Broadband

Abstract: Interactive statewide map of California's BEAD plan (CPUC Resolution T-17920, ratified September 17, 2026) set against school broadband: the 79 public K-12 schools without gigabit that the plan connects (60 named as anchor institutions, 19 sharing a site with one), the 774 it does not, and the 83 funded project areas from 20 providers, shaded fiber, fixed wireless or satellite. The map opens on the 79 BEAD schools. Underneath is the original layer of California census blocks where the fastest fixed consumer broadband download reported to the CPUC is under 1 Gbps, with the public K-12 schools that sit in those blocks. Schools are grouped by county and district, can be spread out to individual schools, and are colored by speed tier. 781 schools (460 districts, 56 counties, 283,360 students) are in blocks under 1 Gbps; 72 more (26,049 students) have no speed data at their block; 9,498 are in gigabit blocks.

Purpose: Portfolio sample for a BEAD and broadband consulting application (CTC Technology and Energy, California). Shows school-level broadband gap analysis from official state and federal data.

Author and contact: Travis Cody Smith
Created: 2026-10-28. Last update: 2026-10-29 (retitled around the BEAD plan; BEAD school matching, project areas and a Gaps in the BEAD plan section; county shapes in place of county dots; one tap from county to schools; legend reordered). Earlier, 2026-10-28 (Chrome review: keyboard-activated dots and controls-first Tab order; aria-labels instead of native tooltips; coverage shading and the area id map decoded and recolored in a Web Worker; area data loads on demand; lossless 8-color coverage.png; small fallback basemap images; per-file version stamps on data and image URLs; Leaflet served from the site with cdnjs as fallback; the data file preloaded; tiles load for the destination zoom only; county dots nudged apart where they overlap; Areas tap mode ignores dots). Earlier the same day: area tap cards; "Tap opens" switch for schools, areas or both; school dots drawn above group dots; cards restyled with stat tiles and sections.

Spatial extent (WGS 84 degrees): west -124.596, south 32.226, east -114.248, north 42.094.
Coordinate system: sources read in WGS 84 / Pseudo-Mercator (EPSG:3857); school points in WGS 84 (EPSG:4326); displayed in EPSG:3857.

## Sources
1. California Public Utilities Commission, California Interactive Broadband Map, Fixed Consumer Downstream Maximum, end of year 2024 (data as of 2024-12-31; data files posted 2026-04-01). Map service CPUC/CPUC_EOY_2024_Fixed_Consumer_Downstream_Maximum, layer 0 (census blocks, field MAX_MaxAdDn, 362,474 blocks). Service description: "Maximum available download speeds in a Census Block, as determined by the presence of at least one subscriber." https://www.broadbandmap.ca.gov/ and https://www.cpuc.ca.gov/industries-and-topics/internet-and-phone/broadband-mapping-program/cpuc-annual-collected-broadband-data
2. National Center for Education Statistics, EDGE Public School Characteristics 2024-25 (published 2026-04-27, metadata modified 2026-07-10, school year 2024-08-01 to 2025-07-31; public domain). Map service K12_School_Locations/EDGE_ADMINDATA_PUBLICSCH_2425, layer 1. 10,351 California schools. https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_ADMINDATA_PUBLICSCH_2425/MapServer/1 ; documentation https://nces.ed.gov/programs/edge/Geographic/SchoolLocations
3. U.S. Geological Survey, The National Map, USGS Imagery Only basemap ("USDA, USGS The National Map: Orthoimagery. Data refreshed June, 2024."). Public domain. https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer
4. U.S. Geological Survey, The National Map, USGS Topo basemap (data refreshed 2026-09-04). Public domain. https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer
5. Federal Communications Commission, National Broadband Map (availability as of 2025-12-31). Consulted but not used: downloads and area summaries could not be retrieved for this build. https://broadbandmap.fcc.gov/

## Processing steps (lineage)
1. Exported the CPUC layer as images at 100 m per pixel over the whole state (73 tiles, 1440 x 813 px, EPSG:3857, origin x -13,870,000, y 5,175,000) and classified each pixel against the layer's legend colors (8 speed classes). Blocks the legend leaves unfilled (values of 1,000,000 Mbps or more: 600 at 20,000,000 and 19 at 1,000,000) were treated as gigabit. Unshaded areas are blocks not in the layer.
2. Exported NCES school locations as images at the same grid and found every school point; points in or near any block under 1 Gbps were kept as candidates.
3. Queried the NCES service by location for the candidates (18 queries, 1,342 school records) and transcribed name, district, address, enrollment, county, locale and coordinates.
4. Read each school's speed class at its own coordinates (599 schools); on an unshaded block edge, used the nearest shaded pixel within 300 m (182); otherwise marked "No speed data" (72). Schools found to be in gigabit blocks (489) were dropped from the dots; the statewide gigabit count (9,498) is total schools minus the others.
5. Grouped schools by county, then by NCES district ID (first 7 digits of the school ID). Group color is the most common tier.
6. Generalized the speed layer to 400 m cells (most common tier, kept where at least 4 of 16 pixels are shaded) for display as coverage.png; exported the two USGS basemaps at 400 m as single images (sat.jpg, str.jpg).
7. Split the 400 m layer into connected patches of one tier (8-connectivity, 8,824 patches) for the tap cards; stored patch IDs as areas.png and per-patch true ground area, cell bounds, gigabit sub-class shares and the mapped schools inside as areas.json (areas.py).
8. Built the page (template.html, app.js, data.json) with Leaflet 1.9.4. Basemaps are USGS The National Map tile services loaded live (USGS Imagery Topo, USGS Topo), with the shipped statewide images as a fallback underneath; the California outline (california.json) is the generalized TIGERweb state boundary from the U.S. Census Bureau, fetched October 28, 2026.

Tools: Python 3.13 (NumPy 2.5.3, SciPy 1.18.1, Pillow 12.3.0), Leaflet 1.9.4. Bulk capture and transcription run by four Claude Sonnet worker agents (846,146 tokens in total). Published at https://traviscs.github.io/California-GigaBit-Schools-Draft/ (GitHub Pages, repository TravisCS/California-GigaBit-Schools-Draft) and as a claude.ai artifact (https://claude.ai/artifact/HRmdQ8KehpESwc6PrRtwoZ, private until shared).

## AI-use statement
Code and layout generated with Claude (Anthropic), which also gathered and processed the data from the sources above. Data, placement and accuracy have not yet been reviewed by Travis Cody Smith.

## Limitations
- Speeds are maximum advertised download speeds where at least one subscriber exists, as reported to the CPUC; not measured speeds, and no upload or latency.
- A school's own circuit (E-Rate, CENIC K12 High Speed Network) can differ from what homes in its block can buy. The map shows neighborhood access.
- Rural census blocks can be large, and schools on block edges may take a neighboring block's speed (see step 4).
- The FCC December 31, 2025 release is newer than the CPUC data used here.
- The display layer is generalized to 400 m, and the basemaps blur at close zoom.

## Use constraints and attribution
All sources are U.S. or California government data. Credit the CPUC for speeds, NCES for schools and USGS The National Map for basemaps with any copy of the map.

## Citation (APA)
Smith, T. C. (2026). *California BEAD plan: Schools, providers and projects* [Interactive map]. https://traviscs.github.io/California-GigaBit-Schools-Draft/

Figure note: *Note.* Speeds from California Public Utilities Commission (2026), data as of December 31, 2024. Schools from National Center for Education Statistics (2026). Basemap from U.S. Geological Survey (2024, 2026). Built with Leaflet; code generated with Claude and not yet reviewed by the author.

## Files
- index.html: the interactive map (same as the artifact)
- data.json, coverage.png, areas.json, areas.png, sat.jpg, str.jpg, california.json: map data, images and the state outline. coverage.png is an 8-color indexed PNG (transparent plus the seven tier colors; the page reads the colors back as tier indexes). areas.png encodes area ids in RGB and must stay lossless. sat.jpg and str.jpg are 900 px fallbacks that sit under the live USGS tiles.
- leaflet-1.9.4.js: the Leaflet library (BSD 2-clause, unchanged copy of the cdnjs build) served from this site so the map works on networks that block CDNs; cdnjs is the fallback
- tools/stamp.py: bumps the deploy stamp in index.html (the ?v= query on data and image URLs) so a cached index.html never pairs with stale data; run it before committing data or image changes
- .map-source/: captured tiles, NCES query list and transcribed school rows (nces_rows.tsv), template.html, app.js, about.html, build scripts
