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
- **Confirm where you are.** Scan a fixed station QR checkpoint, decode a QR image, enter its code, or choose it manually.
- **Keep your journey with you.** Save the station offline, recover a journey after reopening, and switch between English and Hindi without losing your route.
- **Adapt when plans change.** Explore how a journey responds to simulated platform changes, closed passages, or unavailable lifts.

## Explore the demo

The app includes **RailNavi Demo Central**, a fictional station where you can explore the passenger experience from start to arrival.

1. Open **Find My Platform** and try the sample reference **RN-DEMO-1035**.
2. Select **Gate 2** as your starting point and generate the route to **Platform 17**.
3. Search **water on my way**, add a useful stop, and review the walking detour and timing.
4. Follow the map and directions, or start simulated navigation to see the journey progress across station levels.

All station layouts, bookings, trains, facilities, departure times, and availability conditions in the demo are fictional. Demo references are not real PNRs. Location comes from a selected or scanned fixed checkpoint, or clearly labeled simulation; the app is not connected to live railway booking data or an indoor positioning service.

## Take the station with you

Open **Station & app → Save Station Offline** while connected. Wait for **Available offline** before disconnecting. Downloaded maps, routing, facilities, demo tickets, Hindi text and checkpoint decoding then work locally, including after a reload. The app offers **Resume Journey** from your last confirmed location. Browser storage can be evicted; offline platform assignments are fictional and are never verified live information.

On Android, use **Install RailNavi** when your browser offers it, or its **Install app / Add to Home screen** menu. On iPhone or iPad, open in Safari, choose **Share → Add to Home Screen**. Installation options vary by browser; this is a web app.

Use **Scan checkpoint** for the camera or manual fallback. Camera use requires HTTPS (localhost works for local testing) and permission; frames stay on your device. Open **Station & app → Print demo checkpoints** for real QR codes, including Gate 2, Bridge B and Platform 17. Links use the current app origin and work offline only on a device that has saved the station. **QR checkpoints identify known fixed locations; they do not provide continuous live indoor tracking.** Public QR codes are location references, not proof of identity.

Choose **English / हिन्दी** at any point. No accounts, location permissions, analytics, frame uploads or real passenger records are needed. **Clear saved RailNavi data** removes the app’s local downloads and journey. Future real-station use requires surveyed layouts, maintained checkpoints and authorized railway integrations.

## Run locally

Requires **Node.js 24+** and npm.

```bash
git clone https://github.com/MAD1IZJOD/rail-navi.git
cd rail-navi
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The demo runs with local data and requires no API keys or database setup.

RailNavi is built with Next.js, TypeScript, Tailwind CSS, interactive SVG maps, and a reusable graph-routing engine.

## Technical documentation

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` to verify a local checkout.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, station data, detailed demo scenarios, testing commands, deployment instructions, and implementation limitations.
