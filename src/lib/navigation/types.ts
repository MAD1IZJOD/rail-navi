/** Framework-independent station contract. Coordinates share one SVG plan; 1 unit = 0.5 m. */
export type FloorId = -1 | 0 | 1;
export type ConnectionType = "walk" | "stairs" | "escalator" | "lift";
export type NodeType = "gate" | "junction" | "platform" | "landing" | "facility" | "checkpoint";
export type FacilityCategory = "washroom" | "water" | "food" | "tea" | "shop" | "pharmacy" | "information" | "tickets" | "waiting" | "accessible" | "security";
export type RoutePreference = "shortest" | "fastest" | "wheelchair" | "avoid-stairs";

export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface Floor { id: FloorId; name: string; description: string; elevationMeters: number }
export interface NavigationNode extends Point {
  id: string;
  name: string;
  floor: FloorId;
  type: NodeType;
  accessible: boolean;
  platformId?: string;
  facilityId?: string;
}
export interface NavigationEdge {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  durationSeconds: number;
  kind: ConnectionType;
  label: string;
  accessible: boolean;
  available: boolean;
  bidirectional: boolean;
}
export interface NavigationGraph {
  nodes: readonly NavigationNode[];
  edges: readonly NavigationEdge[];
}
export interface Platform {
  id: string;
  number: number;
  name: string;
  floor: FloorId;
  nodeId: string;
  accessNodeIds: string[];
  bounds: Rect;
}
export interface Entrance {
  id: string;
  name: string;
  subtitle: string;
  floor: FloorId;
  nodeId: string;
}
export interface Facility extends Point {
  id: string;
  name: string;
  category: FacilityCategory;
  floor: FloorId;
  nodeId: string;
  accessible: boolean;
}
export interface LocationAnchor {
  id: string;
  nodeId: string;
  label: string;
  source: "manual" | "qr" | "ble";
}
export interface Station extends NavigationGraph {
  id: string;
  name: string;
  fictional: true;
  metersPerUnit: number;
  width: number;
  height: number;
  floors: Floor[];
  platforms: Platform[];
  entrances: Entrance[];
  facilities: Facility[];
  anchors: LocationAnchor[];
  corridors: (Rect & { floor: FloorId; name: string })[];
}
export interface RoutingOptions {
  preference: RoutePreference;
  blockedEdgeIds?: readonly string[];
}
export interface RouteStep {
  kind: "walk" | "transition" | "arrive";
  text: string;
  floor: FloorId;
  toFloor: FloorId;
  nodeIds: string[];
  edgeIds: string[];
  distanceMeters: number;
  durationSeconds: number;
}
export interface FloorChange {
  fromFloor: FloorId;
  toFloor: FloorId;
  fromNodeId: string;
  toNodeId: string;
  edgeId: string;
  kind: ConnectionType;
}
export interface GeneratedRoute {
  status: "available" | "unreachable" | "invalid";
  message: string;
  preference: RoutePreference;
  nodes: NavigationNode[];
  /** Traversal order is in nodes; bidirectional edges retain their stored orientation. */
  edges: NavigationEdge[];
  distanceMeters: number;
  durationSeconds: number;
  floorChanges: FloorChange[];
  instructions: RouteStep[];
}
