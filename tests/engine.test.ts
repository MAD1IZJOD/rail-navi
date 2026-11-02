import { describe, expect, it } from "vitest";
import { edgeCost, findRoute, validateGraph } from "../src/lib/navigation/engine";
import type { FloorId, NavigationEdge, NavigationGraph, NavigationNode, RoutePreference } from "../src/lib/navigation/types";

const n = (id: string, floor: FloorId = 0, x = 0, y = 0): NavigationNode => ({
  id, name: id, floor, x, y, type: "junction", accessible: true,
});
const e = (id: string, from: string, to: string, distanceMeters: number, durationSeconds: number, rest: Partial<NavigationEdge> = {}): NavigationEdge => ({
  id, from, to, distanceMeters, durationSeconds, kind: "walk", label: "Test passage",
  accessible: true, available: true, bidirectional: true, ...rest,
});
const graph: NavigationGraph = {
  nodes: [n("a"), n("b", 0, 10), n("c", 0, 0, 10), n("d", 0, 10, 10)],
  edges: [e("ab", "a", "b", 3, 30), e("bd", "b", "d", 3, 30), e("ac", "a", "c", 5, 5), e("cd", "c", "d", 5, 5)],
};
const floors: NavigationGraph = {
  nodes: [n("start"), n("upper", 1), n("far", 1, 100), n("platform", 0, 100)],
  edges: [
    e("stairs-up", "start", "upper", 12, 24, { kind: "stairs", accessible: false }),
    e("escalator-up", "start", "upper", 14, 18, { kind: "escalator", accessible: false, bidirectional: false }),
    e("lift-up", "start", "upper", 8, 48, { kind: "lift" }),
    e("bridge", "upper", "far", 50, 42, { label: "Foot Overbridge B" }),
    e("stairs-down", "far", "platform", 12, 24, { kind: "stairs", accessible: false }),
    e("lift-down", "far", "platform", 8, 48, { kind: "lift" }),
  ],
};

describe("weighted routes on hand-verifiable graphs", () => {
  it("finds a same-level shortest path with exact distance and duration", () => {
    const route = findRoute(graph, "a", "d", { preference: "shortest" });
    expect(route.status).toBe("available");
    expect(route.nodes.map(item => item.id)).toEqual(["a", "b", "d"]);
    expect(route.distanceMeters).toBe(6);
    expect(route.durationSeconds).toBe(60);
    expect(route.floorChanges).toEqual([]);
  });
  it("chooses a longer but faster path", () => {
    const route = findRoute(graph, "a", "d", { preference: "fastest" });
    expect(route.edges.map(item => item.id)).toEqual(["ac", "cd"]);
    expect(route.distanceMeters).toBe(10);
    expect(route.durationSeconds).toBe(10);
  });
  it("uses the documented cost functions", () => {
    expect(edgeCost(graph.edges[0]!, "shortest")).toBe(3);
    for (const preference of ["fastest", "wheelchair", "avoid-stairs"] as const) {
      expect(edgeCost(graph.edges[0]!, preference)).toBe(30);
    }
  });
  it("routes through explicit floor transitions", () => {
    const route = findRoute(floors, "start", "platform");
    expect(route.nodes.map(item => item.floor)).toEqual([0, 1, 1, 0]);
    expect(route.edges.map(item => item.id)).toEqual(["escalator-up", "bridge", "stairs-down"]);
    expect(route.distanceMeters).toBe(76);
    expect(route.durationSeconds).toBe(84);
    expect(route.floorChanges).toHaveLength(2);
  });
  it("derives upward and downward instructions from the actual edges", () => {
    const route = findRoute(floors, "start", "platform");
    expect(route.instructions[0]?.text).toContain("escalator up to Level +1");
    expect(route.instructions[1]?.text).toContain("Walk east along Foot Overbridge B");
    expect(route.instructions[2]?.text).toContain("stairs down to Level 0");
    expect(route.instructions.at(-1)?.text).toContain("reached platform");
    expect(route.instructions.flatMap(s => s.edgeIds)).toEqual(route.edges.map(item => item.id));
  });
  it("uses lifts and accessible walkways for a wheelchair", () => {
    const route = findRoute(floors, "start", "platform", { preference: "wheelchair" });
    expect(route.edges.map(item => item.id)).toEqual(["lift-up", "bridge", "lift-down"]);
    expect(route.distanceMeters).toBe(66);
    expect(route.durationSeconds).toBe(138);
  });
  it("excludes stairs while allowing an escalator", () => {
    const route = findRoute(floors, "start", "platform", { preference: "avoid-stairs" });
    expect(route.edges.map(item => item.id)).toEqual(["escalator-up", "bridge", "lift-down"]);
  });
  it("respects escalator directionality on the return journey", () => {
    const route = findRoute(floors, "upper", "start");
    expect(route.edges.map(item => item.id)).toEqual(["stairs-up"]);
    expect(route.instructions[0]?.text).toContain("stairs down");
  });
  it("chooses an alternative when a preferred connection is blocked", () => {
    const route = findRoute(graph, "a", "d", { preference: "shortest", blockedEdgeIds: ["ab"] });
    expect(route.edges.map(item => item.id)).toEqual(["ac", "cd"]);
  });
  it("ignores temporarily unavailable edges", () => {
    const changed = { ...graph, edges: graph.edges.map(edge => ({ ...edge, available: edge.id !== "ac" })) };
    expect(findRoute(changed, "a", "d").edges.map(item => item.id)).toEqual(["ab", "bd"]);
  });
  it("returns an empty unreachable result when all exits are blocked", () => {
    const route = findRoute(graph, "a", "d", { preference: "shortest", blockedEdgeIds: ["ab", "ac"] });
    expect(route.status).toBe("unreachable");
    expect(route.nodes).toEqual([]);
    expect(route.instructions).toEqual([]);
  });
  it("handles disconnected destinations", () => {
    expect(findRoute({ ...graph, nodes: [...graph.nodes, n("island")] }, "a", "island").status).toBe("unreachable");
  });
  it.each([["missing", "d"], ["a", "missing"]])("rejects invalid endpoint %s → %s", (from, to) => {
    expect(findRoute(graph, from, to).status).toBe("invalid");
  });
  it("returns a zero-length arrival when start equals destination", () => {
    const route = findRoute(graph, "a", "a");
    expect(route.status).toBe("available");
    expect(route.distanceMeters).toBe(0);
    expect(route.durationSeconds).toBe(0);
    expect(route.instructions).toHaveLength(1);
  });
  it("does not pass through inaccessible intermediate nodes", () => {
    const changed = { ...graph, nodes: graph.nodes.map(node => ({ ...node, accessible: node.id !== "c" })) };
    expect(findRoute(changed, "a", "d", { preference: "wheelchair" }).edges.map(item => item.id)).toEqual(["ab", "bd"]);
  });
  it("rejects an inaccessible wheelchair origin", () => {
    const changed = { ...graph, nodes: graph.nodes.map(node => ({ ...node, accessible: node.id !== "a" })) };
    expect(findRoute(changed, "a", "d", { preference: "wheelchair" }).status).toBe("unreachable");
  });
  it("finds a lift alternative when the escalator closes", () => {
    const route = findRoute(floors, "start", "platform", { preference: "avoid-stairs", blockedEdgeIds: ["escalator-up"] });
    expect(route.edges[0]?.kind).toBe("lift");
  });
  it("cannot invent a connection between floors", () => {
    const disconnected = { nodes: [n("a"), n("b", 1)], edges: [] };
    expect(findRoute(disconnected, "a", "b").status).toBe("unreachable");
  });
  it("rejects a walking edge that changes floors", () => {
    const invalid = { nodes: [n("a"), n("b", 1)], edges: [e("bad", "a", "b", 10, 10)] };
    expect(validateGraph(invalid)).toContain("Invalid floor connection: bad");
    expect(findRoute(invalid, "a", "b").status).toBe("invalid");
  });
  it.each([-1, NaN, Infinity])("rejects invalid distances: %s", distance => {
    expect(findRoute({ ...graph, edges: [e("bad", "a", "b", distance, 1)] }, "a", "b").status).toBe("invalid");
  });
  it("rejects duplicate node IDs, edge IDs and missing endpoints", () => {
    expect(validateGraph({ nodes: [n("a"), n("a")], edges: [e("x", "a", "b", 1, 1), e("x", "a", "b", 1, 1)] })).toEqual(expect.arrayContaining(["Duplicate node: a", "Duplicate edge: x", "Unknown edge endpoint: x"]));
  });
  it.each(["shortest", "fastest", "wheelchair", "avoid-stairs"] as RoutePreference[])("returns consistent ordered edges for %s", preference => {
    const route = findRoute(floors, "platform", "start", { preference });
    route.edges.forEach((edge, i) => {
      const pair = [route.nodes[i]!.id, route.nodes[i + 1]!.id];
      expect(edge.bidirectional ? pair.includes(edge.from) && pair.includes(edge.to) : pair[0] === edge.from && pair[1] === edge.to).toBe(true);
    });
  });
});
