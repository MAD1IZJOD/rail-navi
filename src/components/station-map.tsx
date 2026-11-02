"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, Expand, Minus, Plus, Move, Accessibility, ArrowUpDown } from "lucide-react";
import type { Facility, FacilityCategory, FloorId, GeneratedRoute, Point, Station } from "@/lib/navigation/types";
import { FacilityIcon } from "./facility-icon";

interface Props {
  station: Station;
  floor: FloorId;
  route?: GeneratedRoute | null;
  showFacilities?: boolean;
  facilityCategory?: FacilityCategory | "all";
  selectedFacilityId?: string;
  onFacilitySelect?: (facility: Facility) => void;
  preview?: boolean;
}
interface ViewBox { x: number; y: number; width: number; height: number }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function StationMap({
  station, floor, route, showFacilities = false, facilityCategory = "all",
  selectedFacilityId, onFacilitySelect, preview = false,
}: Props) {
  const base = { x: 0, y: 0, width: station.width, height: station.height };
  const [view, setView] = useState<ViewBox>(base);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const patternId = useId().replaceAll(":", "");
  const zoom = station.width / view.width;
  const nodes = useMemo(() => new Map(station.nodes.map(node => [node.id, node])), [station]);
  const landings = useMemo(() => {
    const groups = new Map<string, { nodeId: string; kinds: Set<string> }>();
    for (const edge of station.edges.filter(edge => edge.kind !== "walk")) {
      for (const id of [edge.from, edge.to]) {
        const node = nodes.get(id)!;
        if (node.floor !== floor) continue;
        const group = groups.get(id) ?? { nodeId: id, kinds: new Set<string>() };
        group.kinds.add(edge.kind);
        groups.set(id, group);
      }
    }
    return [...groups.values()];
  }, [station, floor, nodes]);

  const zoomAt = useCallback((factor: number, client?: Point) => {
    const svg = svgRef.current;
    setView(current => {
      let anchor = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
      if (svg && client) {
        const matrix = svg.getScreenCTM();
        if (matrix) {
          const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse());
          anchor = { x: point.x, y: point.y };
        }
      }
      const width = clamp(current.width / factor, station.width / 4, station.width);
      const ratio = width / current.width;
      return {
        x: clamp(anchor.x - (anchor.x - current.x) * ratio, -station.width * 0.2, station.width * 0.9),
        y: clamp(anchor.y - (anchor.y - current.y) * ratio, -station.height * 0.2, station.height * 0.9),
        width, height: width * station.height / station.width,
      };
    });
  }, [station.width, station.height]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || preview) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, { x: event.clientX, y: event.clientY });
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [preview, zoomAt]);

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (preview || (event.target as Element).closest("[data-map-item]")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.current.values()];
    if (before.length === 2 && after.length === 2) {
      const distance = (points: Point[]) => Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
      const oldDistance = distance(before);
      if (oldDistance > 2) zoomAt(distance(after) / oldDistance, {
        x: (after[0]!.x + after[1]!.x) / 2, y: (after[0]!.y + after[1]!.y) / 2,
      });
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setView(current => {
        const scale = Math.min(rect.width / current.width, rect.height / current.height);
        return {
          ...current,
          x: clamp(current.x - (event.clientX - previous.x) / scale, -station.width * 0.2, station.width * 0.9),
          y: clamp(current.y - (event.clientY - previous.y) / scale, -station.height * 0.2, station.height * 0.9),
        };
      });
    }
  };
  const release = (event: ReactPointerEvent<SVGSVGElement>) => pointers.current.delete(event.pointerId);
  const visibleFacilities = station.facilities.filter(facility => facility.floor === floor &&
    (facilityCategory === "all" || facility.category === facilityCategory) &&
    (showFacilities || zoom > 1.6 || facility.id === selectedFacilityId));
  const destination = route?.nodes.at(-1);
  const start = route?.nodes[0];
  const routeSegments = route?.status === "available" ? route.edges.flatMap((edge, i) => {
    const from = route.nodes[i]!;
    const to = route.nodes[i + 1]!;
    return from.floor === floor && to.floor === floor ? [{ edge, from, to }] : [];
  }) : [];
  const transitions = route?.floorChanges.filter(change => change.fromFloor === floor || change.toFloor === floor) ?? [];

  return (
    <div className={`station-map ${preview ? "map-preview" : ""}`}>
      <svg
        ref={svgRef} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="map-svg" role="group"
        aria-label={`Interactive station map, Level ${floor}, ${Math.round(zoom * 100)} percent zoom`}
        tabIndex={preview ? -1 : 0}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
        onKeyDown={event => {
          if (preview || event.target !== event.currentTarget) return;
          if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); zoomAt(event.key === "-" ? 1 / 1.25 : 1.25); }
          const delta: Record<string, Point> = { ArrowLeft: { x: -40, y: 0 }, ArrowRight: { x: 40, y: 0 }, ArrowUp: { x: 0, y: -40 }, ArrowDown: { x: 0, y: 40 } };
          const offset = delta[event.key];
          if (offset) { event.preventDefault(); setView(current => ({ ...current, x: current.x + offset.x, y: current.y + offset.y })); }
        }}
      >
        <defs>
          <pattern id={`grid-${patternId}`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="#c6cdc5" opacity=".5" /></pattern>
          <pattern id={`track-${patternId}`} width="12" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H12" stroke="#a3aaa2" strokeWidth="3" /></pattern>
        </defs>
        <rect x="-1000" y="-1000" width="4000" height="4000" fill="#eef0e9" />
        <rect x="0" y="0" width={station.width} height={station.height} fill={`url(#grid-${patternId})`} />
        <text x="52" y="91" className="plan-eyebrow">RAILNAVI DEMO CENTRAL</text>
        <text x="52" y="118" className="plan-subtitle">{floor === 0 ? "Concourse & platforms" : floor === 1 ? "Elevated pedestrian connections" : "Lower passenger passage"}</text>
        <g transform="translate(1110 76)" aria-hidden="true"><path d="M0 28V0M-6 10L0 0L6 10" fill="none" stroke="#30423b" strokeWidth="2" /><text y="47" textAnchor="middle" className="map-small">N</text></g>
        <rect x="40" y="150" width="1120" height="640" rx="28" fill="#e3e8dd" stroke="#d2d9ce" strokeWidth="2" />
        <g opacity={floor === 0 ? 1 : 0.24}>
          {Array.from({ length: 13 }, (_, i) => {
            const x = 208 + i * 64;
            return <g key={i}><rect x={x - 6} y="190" width="12" height="550" fill={`url(#track-${patternId})`} /><path d={`M${x - 4} 190V740M${x + 4} 190V740`} stroke="#9ca59b" strokeWidth="1.8" /></g>;
          })}
          {station.platforms.map(platform => (
            <g key={platform.id}>
              <rect {...platform.bounds} rx="7" fill={destination?.platformId === platform.id ? "#d9efb7" : "#fbfcf5"} stroke={destination?.platformId === platform.id ? "#5e8d42" : "#c6cfbf"} strokeWidth="2" />
              <path d={`M${platform.bounds.x + 4} 215V715M${platform.bounds.x + platform.bounds.width - 4} 215V715`} stroke="#d3b665" strokeWidth="1.5" strokeDasharray="3 5" />
              <rect x={platform.bounds.x + 5} y="229" width="28" height="32" rx="5" fill={destination?.platformId === platform.id ? "#204d33" : "#30453c"} />
              <text x={platform.bounds.x + 19} y="251" textAnchor="middle" className="platform-number">{platform.number}</text>
              <text x={platform.bounds.x + 19} y="697" textAnchor="middle" className="platform-bottom">{platform.number}</text>
            </g>
          ))}
        </g>
        {station.corridors.filter(c => c.floor === floor).map((corridor, i) => (
          <rect key={i} x={corridor.x} y={corridor.y} width={corridor.width} height={corridor.height} rx="9" fill={floor === 1 ? "#d4e4ec" : floor === -1 ? "#d7e5d3" : "#f8f9f1"} stroke={floor === 1 ? "#a3bfcc" : "#bdcbb4"} strokeWidth="2" />
        ))}
        {floor === 0 ? <>
          {[300, 620].map((y, i) => <g key={y} pointerEvents="none"><rect x="110" y={y - 20} width="976" height="40" rx="8" fill="#d9e5e6" fillOpacity=".36" stroke="#94b0ba" strokeDasharray="5 6" /><text x="600" y={y - 29} textAnchor="middle" className="bridge-label">FOOT OVERBRIDGE {i ? "B" : "A"} · LEVEL +1</text></g>)}
          <path d="M130 460H1066" stroke="#b0c5a5" strokeWidth="3" strokeDasharray="5 8" opacity=".5" />
          <text x="600" y="445" textAnchor="middle" className="bridge-label">LOWER PASSAGE · LEVEL −1</text>
          <text transform="translate(148 460) rotate(-90)" textAnchor="middle" className="concourse-label">MAIN CONCOURSE</text>
          <text transform="translate(1084 460) rotate(-90)" textAnchor="middle" className="concourse-label">SECONDARY CONCOURSE</text>
          {station.entrances.map(entrance => {
            const point = nodes.get(entrance.nodeId)!;
            return <g key={entrance.id}><rect x={point.x - 24} y={point.y - 15} width="48" height="30" rx="6" fill="#263e34" /><text x={point.x} y={point.y + 5} textAnchor="middle" className="gate-label">G{entrance.id.slice(-1)}</text><text x={point.x} y={point.y - 26} textAnchor="middle" className="map-small">{entrance.name.toUpperCase()}</text></g>;
          })}
        </> : station.corridors.filter(c => c.floor === floor).map(c => <text key={c.name} x={c.x + c.width / 2} y={c.y - 17} textAnchor="middle" className="bridge-label">{c.name.toUpperCase()}</text>)}
        {landings.map(group => {
          const point = nodes.get(group.nodeId)!;
          const lift = group.kinds.has("lift");
          return <g key={group.nodeId} transform={`translate(${point.x} ${point.y})`} pointerEvents="none">
            <title>{`${point.name}: ${[...group.kinds].join(", ")}`}</title>
            <rect x="-17" y="-10" width="34" height="20" rx="5" fill={lift ? "#e8f0fb" : "#f4eee1"} stroke={lift ? "#819fba" : "#b5a480"} />
            <text x="0" y="3" textAnchor="middle" className="vertical-bay-label">{[group.kinds.has("stairs") ? "S" : "", group.kinds.has("escalator") ? "E" : "", lift ? "L" : ""].filter(Boolean).join("·")}</text>
          </g>;
        })}
        {routeSegments.map(({ edge, from, to }) => <g key={edge.id} data-testid="route-segment" data-edge-id={edge.id} pointerEvents="none"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#fff" strokeWidth="15" strokeLinecap="round" /><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#08795b" strokeWidth="8" strokeLinecap="round" /></g>)}
        {visibleFacilities.map(facility => <g key={facility.id} data-map-item role="button" tabIndex={preview ? -1 : 0}
          aria-label={facility.name} className="facility-pin" transform={`translate(${facility.x} ${facility.y})`}
          onClick={() => onFacilitySelect?.(facility)}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onFacilitySelect?.(facility); } }}>
          <title>{facility.name}</title>
          <circle r={selectedFacilityId === facility.id ? 15 : 11} fill={selectedFacilityId === facility.id ? "#173e32" : "#fff"} stroke="#789482" strokeWidth="1.5" />
          <FacilityIcon category={facility.category} x="-6" y="-6" width="12" height="12" color={selectedFacilityId === facility.id ? "#fff" : "#446454"} />
        </g>)}
        {transitions.map(change => {
          const outgoing = change.fromFloor === floor;
          const point = nodes.get(outgoing ? change.fromNodeId : change.toNodeId)!;
          const otherFloor = outgoing ? change.toFloor : change.fromFloor;
          return <g key={change.edgeId} data-testid="floor-transition" pointerEvents="none">
            <circle cx={point.x} cy={point.y} r="15" fill="#fff" stroke="#08795b" strokeWidth="3" />
            <text x={point.x} y={point.y + 5} textAnchor="middle" className="transition-letter">{change.kind === "lift" ? "L" : change.kind === "escalator" ? "E" : "S"}</text>
            <rect x={point.x + 16} y={point.y - 28} width="65" height="21" rx="6" fill="#173e32" />
            <text x={point.x + 48} y={point.y - 13} textAnchor="middle" className="transition-floor">{outgoing ? "TO" : "FROM"} {otherFloor > 0 ? "+" : ""}{otherFloor}</text>
          </g>;
        })}
        {[{ point: start, label: "A", color: "#3e67bd" }, { point: destination, label: "B", color: "#08795b" }].map(({ point, label, color }) => point?.floor === floor ? <g key={label} data-testid={label === "A" ? "start-marker" : "destination-marker"} pointerEvents="none"><circle cx={point.x} cy={point.y} r="21" fill="#fff" opacity=".8" /><circle cx={point.x} cy={point.y} r="15" fill={color} stroke="#fff" strokeWidth="3" /><text x={point.x} y={point.y + 5} textAnchor="middle" className="marker-letter">{label}</text></g> : null)}
        <g transform="translate(60 818)"><path d="M0 0H100M0 -4V4M100 -4V4" stroke="#5b6b5f" strokeWidth="2" /><text x="50" y="20" textAnchor="middle" className="map-small">50 m</text></g>
        <text x="1140" y="831" textAnchor="end" className="map-small">FICTIONAL STATION · SCHEMATIC PLAN</text>
      </svg>
      {!preview && <>
        <div className="map-tools" aria-label="Map controls">
          <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => zoomAt(1.3)} disabled={zoom >= 3.99}><Plus size={19} /></button>
          <span className="zoom-label" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.3)} disabled={zoom <= 1}><Minus size={19} /></button>
          <span className="tool-divider" />
          <button type="button" className="icon-button" aria-label="Reset map view" onClick={() => setView(base)}><Expand size={18} /></button>
        </div>
        <div className="map-legend"><span><i className="legend-route" />Your route</span><span><ArrowUpDown size={13} />S Stairs · E Escalator · L Lift</span><span><Accessibility size={13} />Step-free via lifts</span></div>
        <div className="map-hint"><Move size={13} /><span>Drag to pan · Scroll or pinch to zoom</span><ArrowUpRight size={14} /></div>
      </>}
    </div>
  );
}
