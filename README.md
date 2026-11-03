# RailNavi — Batch 3

RailNavi is a working indoor railway-navigation proof of concept with a five-level fictional station, synthetic tickets, weighted routing, an interactive SVG map and a deterministic passenger-navigation simulator.

**RailNavi Demo Central is entirely fictional.** Maps, bookings, departures, passenger names, outages and movement are synthetic. There are no live railway APIs, scraped PNRs, GPS tracking, official logos or claimed railway partnerships. Batch 4 is not implemented.

## Run

Node.js 22.12+ and npm are required. Node 24 was used for verification.

```powershell
git clone https://github.com/MAD1IZJOD/rail-navi.git
cd rail-navi
npm ci
npm run dev
```

For the supplied checkout, use `D:\personal projects\rail navi`. Open [RailNavi locally](http://localhost:3000). No environment variables, secrets, accounts, paid mapping APIs or database are required.

## Reproduce the complete demo

1. Choose **Find My Platform**. Select **Platform 17 simulator demo · RN-DEMO-1035**, then **Find ticket**.
2. Choose **Gate 2**. Select **Navigate to Platform 17** and inspect the calculated route. Default preference is Fastest.
3. Select **Start simulated navigation**. Pause and Resume work at any position; **Next point** completes the current graph connection and pauses at the next decision point.
4. To reproduce the tested sequence, pause and select **Next point** until the passenger reaches Level +1 at the west landing of Foot Overbridge B. The floor changes only when the vertical edge completes.
5. Open **Demo controls**. Choose **Main concourse** as the alternate connection, then **Take selected path**. Pause and select **Next point** to finish that permitted detour. The engine detects the deviation and calculates a route from that actual landing.
6. Under **Other crossing outage**, select **Foot Overbridge B**. The route updates from the current position and the crossing becomes amber on its floor.
7. Close Demo controls. Open **Simulate platform change** above the map and select **Platform 11**. Ticket assignment, destination and route update together.
8. Use **Fit to route** to see the replacement path. Open Demo controls, choose **120×**, close the controls and Resume.
9. The passenger follows actual edges and vertical connectors to Platform 11. Arrival is announced and remaining distance/time reach zero.

This sequence is exercised by the desktop and mobile browser tests. No route geometry is hardcoded.

For accessibility, switch to a step-free route before starting. **Simulate all lifts unavailable** honestly blocks a wheelchair route; restoring lifts permits recalculation without substituting stairs. An occupied failed lift stops the simulation in place until restored.

**RN-DEMO-1001** still resolves to the earlier Platform 10 demo. All 30 previous references remain valid. There are now 28 departures and 38 synthetic bookings, with assignments covering all 20 platforms. Train-name, demo-number and one-character word-typo search are available without a booking.

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

## Architecture

```text
src/lib/navigation/types.ts       Shared station, geometry, graph and route contracts
src/lib/station/blueprint.ts      Physical regions, track restrictions, crossings and facility anchors
src/lib/station/topology.ts       Deterministic graph compilation from the physical plan
src/lib/station/demo-station.ts   Public station export, availability groups and inventory
src/lib/station/validate.ts       Exact line/rectangle coverage, restricted-area and connectivity validation
src/lib/station/cartography.ts   Palette, bounded camera fitting and priority/collision label placement
src/lib/navigation/engine.ts      Framework-independent Dijkstra and derived route instructions
src/lib/navigation/simulator.ts   Pure movement, progress, guidance, deviation and rerouting state
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

The separate station, geometry, topology, routing and simulation contracts can support later verified positioning providers, smart facility search, passenger assistance and route planning with multiple stops. Those Batch 4 features are not implemented here.

