# RailNavi

**Your train is waiting. We'll show you the way.**

RailNavi is an indoor navigation app designed to make large Indian railway stations easier to navigate. It helps passengers find their platform, understand the route, and make useful stops along the way.

## The idea

An unfamiliar station can turn a simple journey into a series of questions: Which entrance should I use? Which bridge reaches my platform? Is there a lift? Can I get water before my train leaves?

RailNavi brings those decisions into one clear experience. The aim is to help passengers move from a known station entrance to their platform with less uncertainty, whether they are travelling alone, visiting a station for the first time, carrying luggage, or looking for an accessible route.

## What RailNavi helps you do

- **Find your platform.** Look up a synthetic demo booking or search the fictional train list, then plan a route to its assigned platform.
- **Understand the station.** Explore an interactive indoor map, switch levels, and see which bridges, passages, stairs, escalators, and lifts connect your journey.
- **Choose a route that suits you.** Compare the shortest or fastest route, avoid stairs, or choose step-free guidance.
- **Find what you need nearby.** Search for drinking water, food, washrooms, a pharmacy, waiting areas, charging points, and passenger assistance using actual walking connections.
- **Make useful stops.** Add, remove, reorder, or optimize facility visits while keeping your platform as the final destination.
- **Plan around your departure.** Compare walking and visit estimates with a chosen arrival buffer, and see when a detour may leave too little time.
- **Adapt when plans change.** Explore how a journey responds to simulated platform changes, closed passages, or unavailable lifts.

## Explore the demo

The app includes **RailNavi Demo Central**, a fictional station where you can explore the passenger experience from start to arrival.

1. Open **Find My Platform** and try the sample reference **RN-DEMO-1035**.
2. Select **Gate 2** as your starting point and generate the route to **Platform 17**.
3. Search **water on my way**, add a useful stop, and review the walking detour and timing.
4. Follow the map and directions, or start simulated navigation to see the journey progress across station levels.

All station layouts, bookings, trains, facilities, departure times, and availability conditions in the demo are fictional. Demo references are not real PNRs. Location is selected manually or simulated; the app is not connected to live railway booking data or an indoor positioning service.

## Run locally

Requires **Node.js 22.12+** and npm.

```bash
git clone https://github.com/MAD1IZJOD/rail-navi.git
cd rail-navi
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The demo runs with local data and requires no API keys or database setup.

RailNavi is built with Next.js, TypeScript, Tailwind CSS, interactive SVG maps, and a reusable graph-routing engine.

## Technical documentation

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, station data, detailed demo scenarios, testing commands, deployment instructions, and implementation limitations.
