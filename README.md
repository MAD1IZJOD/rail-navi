# RailNavi — Batch 4

RailNavi is a working indoor railway-navigation proof of concept with a five-level fictional station, synthetic tickets, weighted routing, an interactive SVG map a deterministic passenger-navigation simulator, network-ranked facility discovery, optional visits and departure-aware journey planning.

**RailNavi Demo Central is entirely fictional.** Maps, bookings, departures, passenger names, outages and movement are synthetic. There are no live railway APIs, scraped PNRs, GPS tracking, official logos or claimed railway partnerships. No live commerce, payments or emergency-service connection is provided.

## Run

Node.js 22.12+ and npm are required. Node 24 was used for verification.

```powershell
git clone https://github.com/MAD1IZJOD/rail-navi.git
cd rail-navi
npm ci
npm run dev
```

For the supplied checkout, use `D:\personal projects\rail navi`. Open [RailNavi locally](http://localhost:3000). No environment variables, secrets, accounts, paid mapping APIs or database are required.

## Reproduce the complete Batch 4 demo

1. Choose **Find My Platform**, select **Platform 17 simulator demo · RN-DEMO-1035**, then **Find ticket**.
2. Choose **Gate 2**, then **Navigate to Platform 17**. The fictional clock starts 25 minutes before that train's scheduled departure. Inspect the direct route.
3. Open **Facilities**, search **water on my way**, select the first suitable result and compare its walking detour, estimated visit and departure-fit status. Choose **Add stop · keep platform last**.
4. Open Facilities again, search **pharmacy** and add **Main · Station Pharmacy**. These are actual connected station records; water selection uses the routing engine, not a hardcoded answer.
5. Select the narrow timing/stops strip above the navigation controls, or **View stops and timing** in Directions. On mobile, close the sheet with its grip before using the map controls. Review **Useful stops. Platform last.** Reorder with the arrow buttons, adjust visit minutes, or **Optimize order**. The final platform stays last.
6. Review direct walking time, journey walking time, visits, detour, departure time, estimated arrival and margin after the selected 2/5/10-minute buffer. **Not recommended** offers a direct-platform alternative; estimates do not guarantee boarding.
7. Close the mobile sheet, then **Start simulated navigation**. Under **Demo controls**, select **120×** for a short showcase. Close the controls. The passenger follows actual graph edges and pauses at the first facility.
8. At a facility, choose **Continue after visit**. This counts its configured fictional dwell once, then resumes walking. Visited stops leave the pending itinerary. Continue likewise after the second visit.
9. While moving or paused, use Demo controls to **Close Bridge A** or close another crossing. The remaining itinerary recalculates from the passenger's actual position. An occupied connector finishes safely before queued replanning; failure of an occupied connector freezes movement until restored.
10. Open **Simulate platform change** above the map, select **Platform 11**, then close the control. The assigned platform, final marker, route, instructions and timing update together. Reachable optional stops are retained; a water stop on Platform 17 may remain an optional visit even though the final destination is now Platform 11.
11. Continue any remaining facility visit. The arrival state identifies **Platform 11 boarding area**, with zero remaining time/distance. Remove optional stops or restore a connection if the demonstration conditions make a route unavailable.

The production browser suite exercises this complete journey on desktop and mobile, compares composed route geometry with the routing engine, and separately checks adding/removing a stop while moving or paused. No route geometry is hardcoded.

For timing/availability demonstrations, open **Simulation Controls — Fictional Data** in the journey section. Adjust the demo clock, departure or facility availability. A closed pending shop produces an honest unavailable journey until removed/replaced or restored. A long dwell or late clock can trigger **Not recommended**. Opening hours are checked at estimated arrival, including earlier visits.

For accessibility, switch to a step-free route before starting. **Simulate all lifts unavailable** blocks a wheelchair journey; restoring lifts permits recalculation without substituting stairs. Passenger assistance offers information, first aid, accessible help, lost-and-found and ticketing facilities. Assistance is added as a visit so an active train's platform is preserved. **Route here** is offered as an explicit main-destination choice when no train is active.

The earlier **RN-DEMO-1001** Platform 10 demo and the Batch 3 simulator scenario remain available. There are 28 fictional departures and 38 synthetic bookings. Train-name, demo-number and one-character word-typo search work without a booking.

## Station inventory and topology

| Item | Actual count |
| --- | ---: |
| Platforms | 20 |
| Levels | 5 |
| Public gates | 8 |
| Foot overbridges | 4 |
| Passenger underpasses | 2 |
| Facilities / landmarks with facility anchors | 124 |
| Navigation nodes | 416 |
| Graph edges | 661 |
| Vertical access points | 112 |
| Vertical mode connections | 270 |
| Stairs / lifts / upward-only escalators | 112 / 92 / 66 |
| Manual positioning anchors | 13 |

Levels: −2 metro interchange, −1 underpasses/lower concourses, 0 terminals/platforms, +1 Bridges A/B, +2 Bridges C/D. Platforms are grouped West 1–6, Central 7–12 and East 13–20.

The main and secondary terminals run along the outside of the track field. Bridges A and B span all platforms. Upper Bridge C serves Platforms 1–10 from the main terminal; upper Bridge D serves Platforms 11–20 from the secondary terminal. Both underpasses provide alternative cross-station circulation. Outer elevated and lower concourses link their respective crossings without walking through tracks.

A lower transfer corridor reaches the fictional metro interchange via explicit lift/stair hubs. Gates 2, 4 and 7 provide bus/taxi-facing access. Water, washrooms, tea stalls, assistance points, waiting zones, ticketing, food courts, retail and a pharmacy are connected graph destinations.

Shared landing coordinates represent adjacent equipment bays, not detailed equipment footprints. Edge records are connections: most are bidirectional, while escalators are upward-only. Physical access-point counts differ from travel-mode counts.

## Facility catalogue and discovery

All 124 facilities keep their original graph anchors. Each has a description, fictional operating hours, visit duration, availability, services/synonyms, landmark and map priority. All 124 anchors are modeled as accessible; actual step-free reachability still depends on graph closures. Two retail records start unavailable (`p17-amenity`, `west-shop-11`). No inventory or price is represented as verified live information.

| Category | Count | Category | Count |
| --- | ---: | --- | ---: |
| Drinking water | 23 | Washrooms | 10 |
| Tea / coffee | 10 | Food / snacks | 2 |
| Convenience stores | 4 | Pharmacy | 1 |
| Waiting rooms | 30 | Information | 3 |
| Ticketing | 3 | Accessible assistance | 5 |
| General station help | 22 | First aid | 3 |
| Lost and found | 2 | Charging | 3 |
| Luggage | 2 | Transit interchange | 1 |

Search uses deterministic normalization, category synonyms and optional Platform, Gate or Level qualifiers. Examples: **nearest washroom**, **coffee near Platform 12**, **pharmacy on my way**, **food near Gate 3**, **accessible toilet**, **charging point on Level +1**, **help desk**, **something to eat before my train**. Mixed/unsupported requests suggest categories; this is a limited intent parser, not unrestricted natural-language understanding.

Results evaluate actual graph routes under the chosen preference and closures. Open/reachable options with feasible departure timing rank before unsuitable ones; qualifiers use network proximity, and **on my way** ranks walking-time detours. Other searches rank walking distance. Floor changes break ties. **On your route** requires at most **30 additional metres**, **45 additional walking seconds**, and **no added floor transitions**. The complete matched catalogue is evaluated (bounded by this station's 124 records); the best 12 are displayed. No Euclidean-only nearest result is substituted.

Discovery samples the simulated position when searching, refreshing, or when relevant conditions change. **Refresh near me** explicitly updates that sample; labels identify sampled estimates. This avoids recalculating the entire catalogue on each animation tick. Adding a result always plans again from the current passenger position.

## Architecture

```text
src/lib/navigation/types.ts       Shared station, geometry, graph and route contracts
src/lib/station/blueprint.ts      Physical regions, track restrictions, crossings and facility anchors
src/lib/station/topology.ts       Deterministic graph compilation from the physical plan
src/lib/station/demo-station.ts   Public station export, availability groups and inventory
src/lib/station/validate.ts       Exact line/rectangle coverage, restricted-area and connectivity validation
src/lib/station/cartography.ts   Palette, bounded camera fitting and priority/collision label placement
src/lib/navigation/engine.ts      Framework-independent Dijkstra and derived route instructions
src/lib/navigation/simulator.ts   Pure movement, facility arrivals, progress and safe rerouting
src/lib/navigation/context.ts     Physical-position graph context for discovery and previews
src/lib/facilities/catalog.ts     Deterministic enrichment, categories and fictional operating hours
src/lib/facilities/search.ts      Intent parsing, network ranking, insertion previews and timing fit
src/lib/journey/planner.ts        Ordered route composition, best insertion and exact stop ordering
src/lib/journey/time.ts           Explicit service-day clock and departure/buffer assessment
src/components/station-companion.tsx
                                 Discovery, assistance, facility details and itinerary/timing UI
src/lib/positioning/manual.ts     Async provider interface resolving known graph checkpoints
src/lib/tickets/demo.ts           Synthetic bookings, train search and immutable platform assignments
src/components/station-map.tsx    SVG layers, gestures, camera, passenger marker and map controls
src/components/use-navigation-simulation.ts
                                 Cleaned-up simulation clock and controller
src/components/simulation-controls.tsx
                                 Passenger transport controls and optional operator simulations
src/components/station-navigator.tsx
                                 Shared destination, train assignment and availability state
```

### Routing and geometry

One plan unit is 0.5 metres. Walking edges use geometric distance and a 1.2 m/s estimated speed. Vertical costs scale with explicit level separation: stairs 12 m / 24 s per level, escalators 14 m / 18 s per level, lifts 8 m per level and 40 s + 8 s per level including a fixed wait allowance.

Shortest minimizes distance. Fastest minimizes duration. Wheelchair minimizes duration after excluding inaccessible nodes/edges, stairs and escalators. Avoid stairs excludes stairs but permits escalators and lifts. Closed or unavailable connections are filtered before Dijkstra. Validation rejects invalid graph IDs, costs and floor transitions.

The physical validator checks complete walking segments as unions of exact line/rectangle intervals, rather than relying on sparse sampling. It checks restricted tracks, platform geometry, aligned vertical connectors, facility anchors, accessible reachability and ticket platform IDs. Existing gate/platform coverage tests exercise all 640 gate/platform/preference combinations.

### Map system

The light SVG map has independently controllable architecture, tracks, platforms, passages, connectors, facilities, labels, route, passenger and endpoint layers. Track fields are muted; blue routes use a white contrast casing; the passenger has a directional arrow.

Labels use deterministic priority placement in CSS pixels with collision rejection. Platform numerals stay within the visible part of a platform. Major regions appear in overview; connectors and important facilities become visible as zoom increases; minor facilities and landmark names appear at higher detail. Facilities can also be explicitly enabled and searched. Marker placement avoids collisions.

Fit-to-station, fit-to-route and passenger recentering share bounded camera utilities. Manual pan/zoom suspends follow. Recenter resumes it. Floor coordinates remain aligned. A dashed landmark ring identifies the next instruction's graph anchor. Unavailable crossing surfaces are amber. Every route segment uses actual ordered graph endpoints.

Animation uses CSS and the native Web Animations API, with reduced-motion support, finite animations and cleanup. Static architecture is memoized; stable availability data avoids rebuilding it on each passenger update. No 3D engine or new animation dependency was added.

### Movement and rerouting

Simulation advances in deterministic 0.1-second ticks. The speed multiplier changes simulated elapsed time, not route geometry. Edge duration determines progress; walking coordinates are interpolated along the edge, and the directional arrow uses the edge heading. A vertical connection retains its source floor until its endpoint is reached.

Current/upcoming guidance, decision distance, remaining route distance and ETA derive from the current ordered edge and structured route instructions. Floor transitions announce the actual connector and destination level through the status text.

For mid-walk rerouting, a temporary graph anchor is inserted at the exact interpolated position. Remaining/return edge costs are proportional to physical position, with directionality and accessibility preserved. There is no snap back to an entrance. A closing occupied walking connection permits egress along the already traversed portion, not travel through the closed section.

An occupied vertical connector completes to its landing before a queued destination change is applied. If it fails, movement stops in place until restored. Unreachable routes show an honest failure and fictional information-desk guidance.

Wrong turns are selected only at verified decision points and traverse a permitted connection before rerouting. Train assignments and station availability remain authoritative in the explorer; UI panels do not maintain competing platform assignments.

### Optional visits and fictional time

`JourneyStop` and `RouteVisit` extend the reusable route contract without coupling algorithms to React. `planJourney` concatenates genuine Dijkstra legs and records each visit's cumulative edge index. Walking totals exclude dwell; complete journey ETA adds pending/current dwell. Distance/time detours compare the itinerary with the direct route to the same final destination. Map previews, numbered visits and floor segments use those ordered edges, including repeated edges on a facility spur.

At most **four optional stops** are supported. Best insertion evaluates at most five positions while preserving existing relative order. **Optimize order** uses exact Held–Karp dynamic programming over the selected stops, with directed graph-oracle costs: O(2^k k²) states/transitions, k ≤ 4. It minimizes the selected distance/time objective. It does not jointly optimize all facilities in the station or solve time-window/dwell scheduling; hours and departure feasibility are reassessed after ordering.

Replanning preserves exact interpolated walking positions, occupied-connector safeguards, traveled distance, pause state and visited IDs. A facility arrival pauses until Continue; estimated dwell is applied once on continuation. Visited stops cannot be added again within the same session. Explicit Restart returns to the declared entrance with the session's current itinerary; Stop retains pending planning state. Reload resets the local showcase.

The clock is absolute seconds on a **fictional service day**, independent of device time. A ticket starts 25 minutes before its scheduled demo departure. Running simulation advances the clock by simulated travel, including the speed multiplier; pause/visit waiting freezes it, and Continue applies the selected dwell estimate. Operator clock changes are explicit. Midnight rollover is represented as Day 2, etc.; departures remain on their explicit original service day and are never silently moved to tomorrow.

Arrival = fictional now + remaining walking + remaining visits. Margin = departure − estimated arrival − selected buffer. **Comfortable timing** means at least 180 seconds of extra margin after the buffer; **Tight timing** means 0–179 seconds; a negative margin is **Not recommended**. Without a train, the app gives journey estimates without inventing a deadline. Missing routes or invalid durations produce no valid timing estimate.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts/stops a production server on port 3100, which must be free. On Linux CI, use `npx playwright install --with-deps chromium` first. Tests fail on runtime/console errors and compare route geometry against graph calculations.

The suite includes small hand-verifiable routing fixtures, complete station geometry/reachability checks, synthetic ticket tests, deterministic simulation and outage recovery tests, and production browser journeys. Responsive browser checks and screenshots use widths 360, 390, 430, 768, 1280 and 1440, including reduced motion. Screenshots/traces are local ignored artifacts in `test-results/`.

## Deployment

Import [MAD1IZJOD/rail-navi](https://github.com/MAD1IZJOD/rail-navi) into Vercel with the Next.js preset, repository root, branch main, Node 22.12+ or 24, install `npm ci` and build `npm run build`. Use default framework output settings. No environment variables are required. Verify `/`, direct `/ticket`, `/demo`, reloads and touch layouts at the actual deployed URL. A local build is not evidence of remote deployment.

## Limits and future work

- This is a schematic fictional station and synthetic simulation, not surveyed railway data or live indoor positioning.
- State and assignment/outage changes are local to the explorer and reset on reload. They are not a shared railway operations feed.
- Lift waits, congestion, speed and equipment bays are simplified. Positions during a vertical ride retain the source-floor view until the landing.
- Camera follow is a bounded 2D simulation; screen-space label widths use a deterministic text estimate rather than typographic shaping.
- Tick timing is deterministic, not a precision wall-clock model. A background/throttled browser can advance more slowly in real time.
- Chromium desktop/touch emulation and reduced motion are tested. Physical Android/iOS devices, Safari/Firefox, screen-reader acceptance and long-duration memory profiling remain future validation.
- The existing ESLint 9/framework-plugin compatibility constraint and moderate development-tool dependency advisories remain; forced upgrades should not be applied without compatibility testing.
- There is no offline cache, real PNR integration, scanned ticket recognition, mobile native app or multi-station ingestion.

The separate station, geometry, topology, routing and simulation contracts can support later verified positioning providers, QR checkpoint providers, an offline station cache, localized labels/instructions and a mobile installation manifest in later work. Batch 5 is not implemented.

