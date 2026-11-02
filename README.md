# RailNavi

RailNavi is an indoor station-navigation proof of concept for Indian railway passengers. Batch 1 provides a working local station simulation, weighted routing engine and interactive navigation experience.

**RailNavi Demo Central is completely fictional.** Its map, passenger facilities, distances and availability are synthetic. This project uses no official railway logos, live railway feeds, real tickets or passenger information. Batch 1 is not deployed by this repository setup.

## Run locally

Use Node.js 22.12 or newer and npm. Node 24 was used for local verification.

```powershell
git clone https://github.com/MAD1IZJOD/rail-navi.git
cd rail-navi
npm ci
npm run dev
```

Open [RailNavi locally](http://localhost:3000). Select **Explore Demo Station** to open `/demo`.

For the supplied checkout, run the commands from `D:\personal projects\rail navi`.

No environment variables, API keys, database, paid mapping service or location permission are required. The lockfile pins dependency resolution.

## Try the complete journey

1. Open the demo and select Gate 1 as the starting point and Platform 10 as the destination. On mobile, expand **Plan your station journey**.
2. Choose Fastest, Shortest, Wheelchair or Avoid stairs, then select **Find my route**. The top **Try Gate 1 to Platform 10** action also computes this journey.
3. Read the distance, estimated time and actual directions. Select a direction to display its level, or use the +1 / 0 / −1 floor controls.
4. Select **Switch to a step-free route** to compute a lift-based alternative.
5. Change the gate, checkpoint, destination or preference and calculate again. Editing the inputs clears the previous route so it cannot be mistaken for the new selection.
6. Under **Passage availability**, simulate the Bridge A walkway closure and calculate another route.
7. Open **Facilities**, search or filter, select a facility to locate it, then select **Route here**.

The map supports pointer dragging, two-finger pinch, scroll zoom, zoom buttons, reset, and keyboard arrows / + / − when focused. Floor badges indicate levels used by the route. S / E / L signs mark shared stair, escalator and lift access bays. Zooming reveals facility markers; the Facilities tool shows them explicitly.

On mobile, the planner and directions live in an expandable bottom panel while the route summary remains visible. The map retains its view when switching floors so matching landings stay aligned.

## Batch 1 capabilities

- Next.js App Router, strict TypeScript and Tailwind CSS.
- Original interactive SVG station plan, platform and track geometry, entrances, facility inspection and actual graph-edge route overlays.
- Deterministic Dijkstra routing with availability checks, directed escalators, wheelchair restrictions and floor-aware instructions.
- Four navigation preferences, manually selected entrance/checkpoint positioning, route recalculation, closure alternatives and structured invalid/unreachable results.
- Responsive landing page and navigation experience with accessible form labels, keyboard map controls and reduced-motion support.

PNR lookup and live positioning are not implemented.

## Station inventory

| Item | Count |
| --- | ---: |
| Platforms | 12 |
| Station levels | 3 |
| Entrance/exit gates | 4 |
| Railway tracks shown | 13 |
| Foot overbridges | 2 |
| Lower passenger passages | 1 |
| Main / secondary concourses | 2 |
| Navigation nodes | 154 |
| Graph edges | 237 |
| Physical vertical access points | 42 |
| Vertical mode connections | 100 |
| Stair connections | 42 |
| Upward-only escalator connections | 28 |
| Lift connections | 30 |
| Connected passenger facilities | 48 |
| Manual location anchors | 8 |

Each edge record is a connection, not two records for opposite directions. Bidirectional walking, stairs and lifts can be traversed both ways. Escalators run from Level 0 upwards to Level +1 only. Adjacent modes at a shared landing are modeled as parallel edges, rather than separate passenger coordinates.

Levels are −1 (lower passage, elevation −5 m), 0 (concourses and platforms), and +1 (foot overbridges, elevation +6 m). Platform numbers run west to east, with gates on the outside of the track field. Passengers can cross the tracks only on an explicitly modeled bridge or lower passage.

Facilities include washrooms, water, food, tea, convenience shops, a pharmacy, information desks, ticket counters, waiting rooms, accessible facilities, and security/help points. Every facility has its own ID, category, position, level and connected graph node.

## Architecture

```text
src/app/                         App Router pages, metadata and responsive styles
src/components/station-map.tsx   SVG geometry, interaction and floor-specific route rendering
src/components/station-navigator.tsx
                                Journey form, routing state, directions and facility inspection
src/components/facility-icon.tsx Category icons and labels
src/lib/navigation/types.ts     Stations, levels, platforms, facilities, anchors, graph and route types
src/lib/navigation/engine.ts     Pure TypeScript validation, Dijkstra and derived instructions
src/lib/station/demo-station.ts  Deterministic station graph, geometry and inventory
src/lib/positioning/manual.ts    Async positioning-provider contract and manual implementation
tests/engine.test.ts             Small, hand-verifiable algorithm fixtures
tests/station.test.ts            Station connectivity, geometric safety, facilities and positioning
tests/browser/navigation.spec.ts
                                Complete desktop/mobile production-browser checks
```

The engine depends only on TypeScript types. It does not import React, Next.js, a browser API, a UI package or station-specific data. A future React Native client can reuse it.

The station contract groups its graph, geometry and anchors together. A different station can supply the same contract. There is no backend or persistence layer in Batch 1.

### Coordinates, costs and eligibility

The SVG plan uses one coordinate system: **one plan unit equals 0.5 metres**. Walking edge length is Euclidean plan distance, rounded to 0.1 m. These edges remain inside a platform, concourse or permitted pedestrian passage. Traversal duration is distance / **1.2 m/s**, rounded to 0.1 s.

Vertical edges have explicit path length and time: stairs 12 m / 24 s, escalators 14 m / 18 s, and lifts 8 m / 48 s. Lower-passage connections add 1 m to path length. Lift duration includes a fixed waiting and boarding allowance. These values are deliberately simplified estimates, not surveyed measurements.

| Preference | Optimization cost | Eligibility |
| --- | --- | --- |
| Shortest | Total edge distance in metres | All available permitted modes |
| Fastest | Total edge duration in seconds | All available permitted modes |
| Wheelchair | Total edge duration in seconds | Accessible nodes and edges; excludes all stairs and escalators |
| Avoid stairs | Total edge duration in seconds | Excludes stairs; allows escalators and lifts |

Wheelchair and Avoid stairs are hard filters, not soft penalties. Temporarily unavailable or explicitly blocked edges are excluded for every mode. A directed edge can only be used in its declared direction.

Dijkstra uses nonnegative costs and deterministic insertion order for equal costs, with O(V² + E) complexity. This is adequate for the 154-node demonstration; a heap or preprocessing can be introduced if measured larger-station performance warrants it. Graph validation rejects duplicate IDs, missing endpoints, invalid costs, and walking edges that change floor.

A generated route contains availability status, ordered nodes/edges, total path distance (including vertical travel), estimated duration, floor changes and instructions. The interface rounds distance to metres and duration up to whole minutes. Instructions group contiguous walks with matching passage labels and headings, then describe each actual vertical edge. The SVG draws only same-floor edges on the selected level and marks the actual floor-change landings.

### Positioning and future integrations

The asynchronous `PositioningProvider` contract resolves a location to a known graph anchor. Batch 1's manual provider resolves only declared manual checkpoints. It does not track a moving passenger.

Future authorized QR or BLE providers should return a verified graph node through this contract. Raw browser GPS is not treated as accurate indoor positioning. Ticket/PNR-to-platform lookup should be a separate authorized service that resolves to a platform ID; it should not modify the routing algorithm.

## Commands and verification

```powershell
npm run dev          # Development server
npm run typecheck    # Strict TypeScript checks
npm run lint         # ESLint, zero warnings allowed
npm test             # Vitest unit tests
npm run test:watch   # Unit test watch mode
npm run build        # Production build
npm run start        # Serve the production build
```

Browser checks run against a production server on port 3100, started and stopped by Playwright:

```powershell
npx playwright install chromium
npm run build
npm run test:e2e
```

On a Linux CI runner, install browser system dependencies with `npx playwright install --with-deps chromium` first. Port 3100 must be free.

The checked suite includes **283 unit tests** and **16 browser cases** (eight journeys/interactions each on desktop 1440×1000 and mobile 390×844). Browser checks compare rendered SVG edge IDs against the calculated route on every floor and fail on console or runtime errors, including hydration errors.

Unit coverage includes same-level and multi-floor paths, shortest versus fastest choices, exact costs, accessibility, avoid-stairs filtering, one-way escalators, temporary closures, alternate routes, disconnected destinations, invalid IDs, all 192 gate/platform/preference combinations, every facility's wheelchair reachability, manual anchors, and geometric containment of every walking edge.

Browser screenshots and failure traces are generated in ignored `test-results/`. They are local artifacts, not repository source.

## Vercel deployment

This is a conventional Next.js application with no custom runtime or native application dependencies.

1. Import [MAD1IZJOD/rail-navi](https://github.com/MAD1IZJOD/rail-navi) into Vercel using the existing GitHub repository and branch `main`.
2. Select the Next.js framework preset and the repository root as the root directory.
3. Use Node.js 22.12+ (or Node 24), install command `npm ci`, and build command `npm run build`. Keep the framework's default output settings.
4. No environment variables or external services are needed.
5. Deploy, then verify the homepage, direct access and reload at `/demo`, routing, floor changes and mobile layout at the actual deployment URL.

Read the [Next.js deployment documentation](https://nextjs.org/docs/app/getting-started/deploying). A successful local production build demonstrates readiness; it does not verify a remote deployment.

## Known limitations

- The station is schematic, deterministic and fictional. This is not a surveyed map or an operational safety system for any real station.
- Positioning is manually selected and does not update as someone walks. There is no background tracking or arrival detection.
- Waiting, congestion, outages and walking speed are simplified. Bridge closure is an in-memory simulation and resets on reload.
- Vertical modes share a landing coordinate; individual equipment footprints and lift queues are not modeled.
- The app is English-only and browser-based. It has no offline cache, mobile application, ticket scanning, PNR lookup, live platform assignment or multi-station selection.
- Browser automation verifies Chromium desktop and a touch-enabled mobile viewport. Real-device, Safari/Firefox and assistive-technology acceptance testing remain future work.
- The framework's lint plugins currently require ESLint 9-compatible peer dependencies. ESLint 9 reports an end-of-support notice on installation; an ESLint 10 upgrade must wait for compatible framework plugins or a deliberate lint-config migration. The dependency audit reports moderate development-tool advisories in the lint dependency tree. `npm audit --omit=dev` reports zero production advisories at verification time. Do not apply forced audit upgrades without retesting compatibility.

## Future batches

Batch 1 stops at the station simulation and navigation foundation.

Batch 2 can introduce a separately authorized ticket/PNR-to-platform integration, clear data provenance and platform-change handling. Later batches can add verified indoor-positioning providers, surveyed station ingestion and validation, equipment availability management, multiple stations, localization, offline capabilities and Android/iOS clients.

The existing station, platform, anchor and route types provide extension points. Real station ingestion will need stronger geometry validation, operational ownership, calibrated traversal times, current lift availability and user acceptance checks before real passenger use.
