import type {
  GeneratedRoute, NavigationEdge, NavigationGraph, NavigationNode,
  RoutePreference, RouteStep, RoutingOptions, FloorId,
} from "./types";

export const floorLabel = (floor: FloorId) => `Level ${floor > 0 ? "+" : ""}${floor}`;

/** Distance minimizes metres. Other modes minimize seconds after hard eligibility filters.
 * Durations already include vertical travel and a deterministic lift waiting allowance.
 * No heuristic or screen-space distance can create a connection absent from the graph.
 */
export function edgeCost(edge: NavigationEdge, preference: RoutePreference): number {
  return preference === "shortest" ? edge.distanceMeters : edge.durationSeconds;
}

export function validateGraph(graph: NavigationGraph): string[] {
  const errors: string[] = [];
  const nodes = new Map<string, NavigationNode>();
  const edges = new Set<string>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) errors.push(`Duplicate node: ${node.id}`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || ![-2, -1, 0, 1, 2].includes(node.floor)) {
      errors.push(`Invalid position: ${node.id}`);
    }
    nodes.set(node.id, node);
  }
  for (const edge of graph.edges) {
    if (edges.has(edge.id)) errors.push(`Duplicate edge: ${edge.id}`);
    edges.add(edge.id);
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) { errors.push(`Unknown edge endpoint: ${edge.id}`); continue; }
    if (!Number.isFinite(edge.distanceMeters) || edge.distanceMeters < 0 ||
        !Number.isFinite(edge.durationSeconds) || edge.durationSeconds <= 0) {
      errors.push(`Invalid cost: ${edge.id}`);
    }
    if ((edge.kind === "walk") !== (from.floor === to.floor)) {
      errors.push(`Invalid floor connection: ${edge.id}`);
    }
  }
  return errors;
}

function heading(from: NavigationNode, to: NavigationNode): "east" | "west" | "north" | "south" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "east" : "west") : (dy >= 0 ? "south" : "north");
}

function instructions(nodes: NavigationNode[], edges: NavigationEdge[]): RouteStep[] {
  const steps: RouteStep[] = [];
  let previousWalkKey = "";
  edges.forEach((edge, i) => {
    const from = nodes[i]!;
    const to = nodes[i + 1]!;
    if (from.floor !== to.floor) {
      steps.push({
        kind: "transition", action: { type: "transition", connection: edge.kind, via: edge.label, toFloor: to.floor, ascending: to.floor > from.floor },
        text: `Take the ${edge.kind === "lift" ? "lift" : edge.kind} ${to.floor > from.floor ? "up" : "down"} to ${floorLabel(to.floor)} at ${edge.label}.`,
        floor: from.floor, toFloor: to.floor,
        nodeIds: [from.id, to.id], edgeIds: [edge.id],
        distanceMeters: edge.distanceMeters, durationSeconds: edge.durationSeconds,
      });
      previousWalkKey = "";
      return;
    }
    const direction = heading(from, to);
    const key = `${from.floor}:${edge.label}:${direction}`;
    const text = `Walk ${direction} along ${edge.label} towards ${to.name}.`;
    const last = steps.at(-1);
    if (last?.kind === "walk" && key === previousWalkKey) {
      last.text = text;
      last.action = { type: "walk", direction, via: edge.label, target: to.name };
      last.nodeIds.push(to.id);
      last.edgeIds.push(edge.id);
      last.distanceMeters += edge.distanceMeters;
      last.durationSeconds += edge.durationSeconds;
    } else {
      steps.push({
        kind: "walk", action: { type: "walk", direction, via: edge.label, target: to.name }, text, floor: from.floor, toFloor: to.floor,
        nodeIds: [from.id, to.id], edgeIds: [edge.id],
        distanceMeters: edge.distanceMeters, durationSeconds: edge.durationSeconds,
      });
    }
    previousWalkKey = key;
  });
  const end = nodes.at(-1);
  if (end) steps.push({
    kind: "arrive", action: { type: "arrive", target: end.name, floor: end.floor }, text: `You have reached ${end.name} on ${floorLabel(end.floor)}.`,
    floor: end.floor, toFloor: end.floor, nodeIds: [end.id], edgeIds: [],
    distanceMeters: 0, durationSeconds: 0,
  });
  return steps;
}

/** Deterministic Dijkstra, O(V² + E), suitable for this small station graph.
 * This pure TypeScript module has no browser, React, or server dependencies.
 */
export function findRoute(
  graph: NavigationGraph, startId: string, destinationId: string,
  options: RoutingOptions = { preference: "fastest" },
): GeneratedRoute {
  const empty = (status: "invalid" | "unreachable", message: string): GeneratedRoute => ({
    status, message, preference: options.preference, nodes: [], edges: [],
    distanceMeters: 0, durationSeconds: 0, floorChanges: [], instructions: [],
  });
  const errors = validateGraph(graph);
  if (errors.length) return empty("invalid", `Station graph is invalid: ${errors[0]}`);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (!nodes.has(startId) || !nodes.has(destinationId)) {
    return empty("invalid", "Choose a known station start and destination.");
  }
  const wheelchair = options.preference === "wheelchair";
  if (wheelchair && (!nodes.get(startId)!.accessible || !nodes.get(destinationId)!.accessible)) {
    return empty("unreachable", "This location does not have an accessible connection.");
  }
  const blocked = new Set(options.blockedEdgeIds ?? []);
  const adjacency = new Map<string, { to: string; edge: NavigationEdge }[]>();
  for (const edge of graph.edges) {
    if (!edge.available || blocked.has(edge.id)) continue;
    if (options.preference === "avoid-stairs" && edge.kind === "stairs") continue;
    if (wheelchair && (!edge.accessible || edge.kind === "stairs" || edge.kind === "escalator" ||
        !nodes.get(edge.from)!.accessible || !nodes.get(edge.to)!.accessible)) continue;
    const add = (from: string, to: string) => {
      const list = adjacency.get(from) ?? [];
      list.push({ to, edge });
      adjacency.set(from, list);
    };
    add(edge.from, edge.to);
    if (edge.bidirectional) add(edge.to, edge.from);
  }
  const costs = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { from: string; edge: NavigationEdge }>();
  const visited = new Set<string>();
  while (true) {
    let current: string | undefined;
    let best = Infinity;
    for (const [id, cost] of costs) {
      if (!visited.has(id) && cost < best) { current = id; best = cost; }
    }
    if (current === undefined) break;
    if (current === destinationId) break;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next.to)) continue;
      const candidate = best + edgeCost(next.edge, options.preference);
      if (candidate < (costs.get(next.to) ?? Infinity)) {
        costs.set(next.to, candidate);
        previous.set(next.to, { from: current, edge: next.edge });
      }
    }
  }
  if (!costs.has(destinationId)) {
    return empty("unreachable", "No route is available with these preferences and passage closures. Try another preference or restore a passage.");
  }
  const routeNodes = [nodes.get(destinationId)!];
  const routeEdges: NavigationEdge[] = [];
  let cursor = destinationId;
  while (cursor !== startId) {
    const entry = previous.get(cursor)!;
    routeEdges.push(entry.edge);
    routeNodes.push(nodes.get(entry.from)!);
    cursor = entry.from;
  }
  routeNodes.reverse();
  routeEdges.reverse();
  return {
    status: "available", message: startId === destinationId ? "You are already at your destination." : "Route ready.",
    preference: options.preference, nodes: routeNodes, edges: routeEdges,
    distanceMeters: routeEdges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
    durationSeconds: routeEdges.reduce((sum, edge) => sum + edge.durationSeconds, 0),
    floorChanges: routeEdges.flatMap((edge, i) => {
      const from = routeNodes[i]!;
      const to = routeNodes[i + 1]!;
      return from.floor === to.floor ? [] : [{
        fromFloor: from.floor, toFloor: to.floor, fromNodeId: from.id,
        toNodeId: to.id, edgeId: edge.id, kind: edge.kind,
      }];
    }),
    instructions: instructions(routeNodes, routeEdges),
  };
}
