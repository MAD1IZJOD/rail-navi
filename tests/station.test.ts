import { validateStation } from "../src/lib/station/validate";
import { describe, expect, it } from "vitest";
import { findRoute, validateGraph } from "../src/lib/navigation/engine";
import type { Rect, RoutePreference } from "../src/lib/navigation/types";
import { demoStation as station, bridgeAEdgeIds, stationMetrics } from "../src/lib/station/demo-station";
import { manualPositioningProvider } from "../src/lib/positioning/manual";

const modes: RoutePreference[] = ["shortest", "fastest", "wheelchair", "avoid-stairs"];
const journeys = station.entrances.flatMap(gate => station.platforms.flatMap(platform =>
  modes.map(preference => ({ gate: gate.nodeId, platform: platform.nodeId, preference })),
));
const inside = (x: number, y: number, rect: Rect) =>
  x >= rect.x - 0.01 && x <= rect.x + rect.width + 0.01 &&
  y >= rect.y - 0.01 && y <= rect.y + rect.height + 0.01;

describe("RailNavi Demo Central", () => {
  it("has the documented station metrics and a valid graph", () => {
    expect(validateGraph(station)).toEqual([]);
    expect(validateStation(station)).toEqual([]);
    expect(stationMetrics).toEqual({
      platforms: 20, floors: 5, gates: 8, nodes: 416, edges: 661,
      verticalConnections: 270, verticalLandings: 112, facilities: 124,
    });
  });
  it.each(journeys)("$gate â†’ $platform using $preference is reachable and respects its constraints", ({ gate, platform, preference }) => {
    const route = findRoute(station, gate, platform, { preference });
    expect(route.status).toBe("available");
    expect(route.nodes[0]?.id).toBe(gate);
    expect(route.nodes.at(-1)?.id).toBe(platform);
    expect(route.distanceMeters).toBeCloseTo(route.edges.reduce((sum, edge) => sum + edge.distanceMeters, 0));
    expect(route.durationSeconds).toBeCloseTo(route.edges.reduce((sum, edge) => sum + edge.durationSeconds, 0));
    if (preference === "wheelchair") expect(route.edges.every(edge => edge.accessible && ["walk", "lift"].includes(edge.kind))).toBe(true);
    if (preference === "avoid-stairs") expect(route.edges.some(edge => edge.kind === "stairs")).toBe(false);
  });
  it("keeps every walking edge inside a drawn walkable surface", () => {
    for (const edge of station.edges.filter(edge => edge.kind === "walk")) {
      const from = station.nodes.find(node => node.id === edge.from)!;
      const to = station.nodes.find(node => node.id === edge.to)!;
      const surfaces: Rect[] = [
        ...station.corridors.filter(corridor => corridor.floor === from.floor),
        ...station.platforms.filter(platform => platform.floor === from.floor).map(platform => platform.bounds),
      ];
      for (let sample = 0; sample <= 20; sample++) {
        const fraction = sample / 20;
        const x = from.x + (to.x - from.x) * fraction;
        const y = from.y + (to.y - from.y) * fraction;
        expect(surfaces.some(rect => inside(x, y, rect)), `Walking edge outside plan: ${edge.id}`).toBe(true);
      }
    }
  });
  it("never crosses between platforms at track level", () => {
    const byId = new Map(station.nodes.map(node => [node.id, node]));
    for (const edge of station.edges) {
      const from = byId.get(edge.from)!;
      const to = byId.get(edge.to)!;
      if (from.floor === 0 && to.floor === 0 && from.platformId && to.platformId) {
        expect(from.platformId).toBe(to.platformId);
      }
    }
  });
  it("recalculates through the lower passage when Bridge A is closed", () => {
    const normal = findRoute(station, "gate-1", "p10-destination");
    const closed = findRoute(station, "gate-1", "p10-destination", { preference: "fastest", blockedEdgeIds: bridgeAEdgeIds });
    expect(normal.edges.some(edge => bridgeAEdgeIds.includes(edge.id))).toBe(true);
    expect(closed.status).toBe("available");
    expect(closed.edges.some(edge => bridgeAEdgeIds.includes(edge.id))).toBe(false);
    expect(closed.nodes.some(node => node.floor === -1)).toBe(true);
    expect(closed.durationSeconds).toBeGreaterThan(normal.durationSeconds);
  });
  it("uses different routes from different gates and to different platforms", () => {
    const a = findRoute(station, "gate-1", "p10-destination");
    const b = findRoute(station, "gate-4", "p10-destination");
    const c = findRoute(station, "gate-1", "p2-destination");
    expect(a.edges.map(edge => edge.id)).not.toEqual(b.edges.map(edge => edge.id));
    expect(a.distanceMeters).not.toBe(b.distanceMeters);
    expect(a.distanceMeters).not.toBe(c.distanceMeters);
  });
  it("reports an unreachable platform when all of its vertical connections close", () => {
    const blocked = station.edges.filter(edge => edge.kind !== "walk" &&
      (edge.from.startsWith("p10-") || edge.to.startsWith("p10-"))).map(edge => edge.id);
    expect(findRoute(station, "gate-1", "p10-destination", { preference: "fastest", blockedEdgeIds: blocked }).status).toBe("unreachable");
  });
  it.each(station.facilities)("facility $id has a unique accessible navigable connection", facility => {
    expect(station.facilities.filter(other => other.id === facility.id)).toHaveLength(1);
    const node = station.nodes.find(node => node.id === facility.nodeId);
    expect(node).toMatchObject({ x: facility.x, y: facility.y, floor: facility.floor, facilityId: facility.id });
    expect(findRoute(station, "gate-1", facility.nodeId, { preference: "wheelchair" }).status).toBe("available");
  });
  it.each(station.anchors)("resolves manual anchor $id to a verified graph node", async anchor => {
    const result = await manualPositioningProvider.locate(station, anchor.id);
    expect(result.status).toBe("located");
    if (result.status === "located") {
      expect(result.position.nodeId).toBe(anchor.nodeId);
      expect(result.position.accuracy).toBe("selected-checkpoint");
    }
  });
  it("rejects an unknown manual positioning anchor", async () => {
    expect((await manualPositioningProvider.locate(station, "unknown")).status).toBe("unknown");
  });
});
