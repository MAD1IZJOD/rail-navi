import type {
  Station, NavigationNode, NavigationEdge, Platform, Facility,
  FacilityCategory, FloorId, ConnectionType,
} from "../navigation/types";

const nodes: NavigationNode[] = [];
const edges: NavigationEdge[] = [];
const platforms: Platform[] = [];
const facilities: Facility[] = [];
const byId = new Map<string, NavigationNode>();
const METRES_PER_UNIT = 0.5;
const round = (value: number) => Math.round(value * 10) / 10;

function node(id: string, name: string, x: number, y: number, floor: FloorId, type: NavigationNode["type"] = "junction", platformId?: string) {
  const value: NavigationNode = { id, name, x, y, floor, type, accessible: true, platformId };
  nodes.push(value);
  byId.set(id, value);
  return value;
}
function connect(from: string, to: string, label: string, kind: ConnectionType = "walk", bidirectional = true) {
  const a = byId.get(from)!;
  const b = byId.get(to)!;
  const vertical = kind !== "walk";
  const distanceMeters = vertical
    ? ({ stairs: 12, escalator: 14, lift: 8, walk: 0 }[kind] + (a.floor === -1 || b.floor === -1 ? 1 : 0))
    : round(Math.hypot(b.x - a.x, b.y - a.y) * METRES_PER_UNIT);
  const durationSeconds = vertical
    ? ({ stairs: 24, escalator: 18, lift: 48, walk: 0 }[kind])
    : round(distanceMeters / 1.2);
  edges.push({
    id: `${from}--${to}--${kind}`, from, to, label, kind,
    distanceMeters, durationSeconds, bidirectional,
    accessible: kind === "walk" || kind === "lift", available: true,
  });
}

/** A shared landing represents adjacent stair/lift/escalator bays.
 * Parallel vertical edges are different physical modes at that landing.
 * Escalators are upward-only; return travel uses stairs or a lift.
 */
function vertical(column: string, prefix: string, x: number) {
  for (const [suffix, y, floor, label] of [
    ["a", 300, 1, "Foot Overbridge A"],
    ["b", 620, 1, "Foot Overbridge B"],
    ["u", 460, -1, "Lower passenger passage"],
  ] as const) {
    const groundId = `${column}-${suffix}`;
    const otherId = `${column}-${suffix}-${floor}`;
    node(otherId, `${label} · ${prefix}`, x, y, floor, "landing");
    connect(groundId, otherId, `${label} · ${prefix}`, "stairs");
    if (suffix !== "a") connect(groundId, otherId, `${label} · ${prefix}`, "lift");
    if (suffix !== "u") connect(groundId, otherId, `${label} · ${prefix}`, "escalator", false);
  }
}

// Two concourses run ALONG the outer tracks, never across them at platform level.
for (const [side, x, name] of [["west", 130, "Main concourse"], ["east", 1066, "Secondary concourse"]] as const) {
  const points = [["north", 230], ["a", 300], ["u", 460], ["center", 530], ["b", 620], ["south", 700]] as const;
  for (const [suffix, y] of points) node(`${side}-${suffix}`, `${name}${suffix === "center" ? " checkpoint" : ""}`, x, y, 0, suffix === "center" ? "checkpoint" : "landing");
  for (let i = 1; i < points.length; i++) connect(`${side}-${points[i - 1]![0]}`, `${side}-${points[i]![0]}`, name);
  vertical(side, name, x);
}

for (let number = 1; number <= 12; number++) {
  const id = `platform-${number}`;
  const x = 240 + (number - 1) * 64;
  for (const [suffix, y] of [["a", 300], ["u", 460], ["destination", 530], ["b", 620]] as const) {
    node(`p${number}-${suffix}`, `Platform ${number}${suffix === "destination" ? " boarding area" : " access"}`, x, y, 0, suffix === "destination" ? "platform" : "landing", id);
  }
  connect(`p${number}-a`, `p${number}-u`, `Platform ${number} walkway`);
  connect(`p${number}-u`, `p${number}-destination`, `Platform ${number} walkway`);
  connect(`p${number}-destination`, `p${number}-b`, `Platform ${number} walkway`);
  vertical(`p${number}`, `Platform ${number}`, x);
  platforms.push({
    id, number, name: `Platform ${number}`, floor: 0, nodeId: `p${number}-destination`,
    accessNodeIds: [`p${number}-a`, `p${number}-u`, `p${number}-b`],
    bounds: { x: x - 19, y: 200, width: 38, height: 530 },
  });
}

// Only upper bridges and the lower passage connect columns across the tracks.
for (const [suffix, floor, name] of [["a", 1, "Foot Overbridge A"], ["b", 1, "Foot Overbridge B"], ["u", -1, "Lower passenger passage"]] as const) {
  const columns = ["west", ...platforms.map(p => `p${p.number}`), "east"];
  for (let i = 1; i < columns.length; i++) connect(`${columns[i - 1]}-${suffix}-${floor}`, `${columns[i]}-${suffix}-${floor}`, name);
}

const entrances: Station["entrances"] = [
  { id: "gate-1", name: "Gate 1", subtitle: "Northwest · Station Road", floor: 0, nodeId: "gate-1" },
  { id: "gate-2", name: "Gate 2", subtitle: "Southwest · Bus interchange", floor: 0, nodeId: "gate-2" },
  { id: "gate-3", name: "Gate 3", subtitle: "Northeast · City Square", floor: 0, nodeId: "gate-3" },
  { id: "gate-4", name: "Gate 4", subtitle: "Southeast · Taxi forecourt", floor: 0, nodeId: "gate-4" },
];
for (const entrance of entrances) {
  const west = entrance.id === "gate-1" || entrance.id === "gate-2";
  const north = entrance.id === "gate-1" || entrance.id === "gate-3";
  node(entrance.nodeId, entrance.name, west ? 65 : 1135, north ? 230 : 700, 0, "gate");
  connect(entrance.nodeId, `${west ? "west" : "east"}-${north ? "north" : "south"}`, west ? "Main concourse entrance" : "Secondary concourse entrance");
}

function facility(id: string, name: string, category: FacilityCategory, x: number, y: number, floor: FloorId, anchor: string) {
  const nodeId = `facility-${id}`;
  const value = node(nodeId, name, x, y, floor, "facility");
  value.facilityId = id;
  facilities.push({ id, name, category, x, y, floor, nodeId, accessible: true });
  connect(anchor, nodeId, `${name} access`);
}
for (const [side, x, prefix] of [["west", 130, "Main"], ["east", 1066, "East"]] as const) {
  const list: [string, FacilityCategory, number, string][] = [
    ["Information desk", "information", 260, "north"],
    ["Ticket counters", "tickets", 340, "a"],
    ["Security help point", "security", 380, "a"],
    ["Drinking water", "water", 490, "center"],
    ["Waiting room", "waiting", 550, "center"],
    ["Accessible washroom", "accessible", 660, "b"],
    [side === "west" ? "Platform Pantry" : "City Bites", "food", 740, "south"],
    [side === "west" ? "Station Pharmacy" : "Travel Essentials", side === "west" ? "pharmacy" : "shop", 580, "center"],
  ];
  list.forEach(([name, category, y, anchor], i) => facility(`${side}-${category}`, `${prefix} · ${name}`, category, x + (i % 2 ? 28 : -28), y, 0, `${side}-${anchor}`));
}
for (const platform of platforms) {
  const x = platform.bounds.x + 19;
  facility(`p${platform.number}-water`, `Platform ${platform.number} · Drinking water`, "water", x - 10, 550, 0, platform.nodeId);
  facility(`p${platform.number}-amenity`, `Platform ${platform.number} · ${platform.number % 2 ? "Chai Corner" : "Washroom"}`, platform.number % 2 ? "tea" : "washroom", x + 10, 580, 0, platform.nodeId);
}
facility("bridge-a-shop", "Bridge A · Travel Essentials", "shop", 370, 306, 1, "p3-a-1");
facility("bridge-a-tea", "Bridge A · Chai Express", "tea", 816, 294, 1, "p10-a-1");
facility("bridge-b-food", "Bridge B · Fresh Tiffin", "food", 498, 626, 1, "p5-b-1");
facility("bridge-b-help", "Bridge B · Help point", "security", 880, 614, 1, "p11-b-1");
facility("lower-accessible", "Lower passage · Accessible rest area", "accessible", 370, 448, -1, "p3-u--1");
facility("lower-washroom", "Lower passage · Washroom", "washroom", 562, 470, -1, "p6-u--1");
facility("lower-water", "Lower passage · Drinking water", "water", 754, 448, -1, "p9-u--1");
facility("lower-waiting", "Lower passage · Quiet waiting area", "waiting", 880, 470, -1, "p11-u--1");

export const demoStation: Station = {
  id: "railnavi-demo-central", name: "RailNavi Demo Central", fictional: true,
  metersPerUnit: METRES_PER_UNIT, width: 1200, height: 860,
  floors: [
    { id: 1, name: "Foot overbridges", description: "Bridge A & Bridge B", elevationMeters: 6 },
    { id: 0, name: "Concourse & platforms", description: "Gates, platforms & passenger facilities", elevationMeters: 0 },
    { id: -1, name: "Lower passage", description: "Accessible passage & rest facilities", elevationMeters: -5 },
  ],
  nodes, edges, platforms, entrances, facilities,
  anchors: [
    ...entrances.map(e => ({ id: e.id, nodeId: e.nodeId, label: `${e.name} · ${e.subtitle}`, source: "manual" as const })),
    { id: "main-checkpoint", nodeId: "west-center", label: "Main concourse checkpoint", source: "manual" },
    { id: "east-checkpoint", nodeId: "east-center", label: "Secondary concourse checkpoint", source: "manual" },
    { id: "bridge-a-checkpoint", nodeId: "west-a-1", label: "Bridge A · West landing (+1)", source: "manual" },
    { id: "lower-checkpoint", nodeId: "west-u--1", label: "Lower passage · West landing (−1)", source: "manual" },
  ],
  corridors: [
    { x: 82, y: 175, width: 96, height: 600, floor: 0, name: "Main concourse" },
    { x: 1018, y: 175, width: 96, height: 600, floor: 0, name: "Secondary concourse" },
    ...entrances.map(e => ({ x: e.id === "gate-1" || e.id === "gate-2" ? 45 : 1066, y: e.id === "gate-1" || e.id === "gate-3" ? 212 : 682, width: e.id === "gate-1" || e.id === "gate-2" ? 85 : 89, height: 36, floor: 0 as const, name: e.name })),
    { x: 110, y: 280, width: 976, height: 40, floor: 1, name: "Foot Overbridge A" },
    { x: 110, y: 600, width: 976, height: 40, floor: 1, name: "Foot Overbridge B" },
    { x: 110, y: 434, width: 976, height: 52, floor: -1, name: "Lower passenger passage" },
  ],
};

export const bridgeAEdgeIds = edges.filter(e => e.kind === "walk" && e.label === "Foot Overbridge A").map(e => e.id);
export const stationMetrics = {
  platforms: platforms.length, floors: demoStation.floors.length,
  gates: entrances.length, nodes: nodes.length, edges: edges.length,
  verticalConnections: edges.filter(e => e.kind !== "walk").length,
  verticalLandings: nodes.filter(n => n.floor === 0 && n.type === "landing").length,
  facilities: facilities.length,
};
