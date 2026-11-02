"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, ArrowUpRight, Accessibility, Check, ChevronDown, ChevronUp,
  Clock3, Flag, Footprints, Layers3, LoaderCircle, MapPin, Navigation,
  Route as RouteIcon, Search, ShieldCheck, Sparkles, TrainFront, X,
} from "lucide-react";
import { findRoute, floorLabel } from "@/lib/navigation/engine";
import type { Facility, FacilityCategory, FloorId, GeneratedRoute, RoutePreference } from "@/lib/navigation/types";
import { manualPositioningProvider } from "@/lib/positioning/manual";
import { bridgeAEdgeIds, demoStation as station } from "@/lib/station/demo-station";
import { FacilityIcon, facilityLabels } from "./facility-icon";
import { StationMap } from "./station-map";
import { TicketLookup } from "./ticket-lookup";
import { assignPlatform, demoTrains } from "@/lib/tickets/demo";

const preferences: { id: RoutePreference; name: string; description: string; icon: typeof Clock3 }[] = [
  { id: "fastest", name: "Fastest", description: "Least estimated time", icon: Clock3 },
  { id: "shortest", name: "Shortest", description: "Least distance", icon: Footprints },
  { id: "wheelchair", name: "Wheelchair", description: "Lifts & step-free paths", icon: Accessibility },
  { id: "avoid-stairs", name: "Avoid stairs", description: "Escalators & lifts", icon: Layers3 },
];
const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

export function StationNavigator({ initialTicket = false }: { initialTicket?: boolean }) {
  const [ticketOpen, setTicketOpen] = useState(initialTicket);
  const [trains, setTrains] = useState(demoTrains);
  const [activeTrainId, setActiveTrainId] = useState("");
  const [platformNotice, setPlatformNotice] = useState("");
  const activeTrain = trains.find(train => train.id === activeTrainId);
  const [origin, setOrigin] = useState("gate-1");
  const [destination, setDestination] = useState("p10-destination");
  const [preference, setPreference] = useState<RoutePreference>("fastest");
  const [bridgeClosed, setBridgeClosed] = useState(false);
  const [floor, setFloor] = useState<FloorId>(0);
  const [route, setRoute] = useState<GeneratedRoute | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"directions" | "facilities">("directions");
  const [expanded, setExpanded] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility>();
  const [category, setCategory] = useState<FacilityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const directionsRef = useRef<HTMLElement>(null);
  const facilityResults = useMemo(() => station.facilities.filter(facility =>
    (category === "all" || facility.category === category) &&
    facility.name.toLowerCase().includes(query.toLowerCase().trim())),
  [category, query]);

  function invalidate() { setRoute(null); setError(""); setPlatformNotice(""); }
  function navigateTrain(trainId: string, anchorId: string) {
    const train = trains.find(item => item.id === trainId);
    const platform = station.platforms.find(item => item.id === train?.platformId);
    if (!platform || train?.status === "cancelled") { setRoute(null); setError("This demo departure is unavailable."); return; }
    setActiveTrainId(trainId); setOrigin(anchorId); setDestination(platform.nodeId);
    setTicketOpen(false); setPlatformNotice("");
    void calculate({ origin: anchorId, destination: platform.nodeId });
  }
  function changePlatform(platformId: string) {
    if (!activeTrain) return;
    const updated = assignPlatform(trains, activeTrain.id, platformId, station.platforms.map(p => p.id));
    setTrains(updated);
    const platform = station.platforms.find(p => p.id === platformId)!;
    setRoute(null); setDestination(platform.nodeId);
    setPlatformNotice(`Simulation: ${activeTrain.name} moved to Platform ${platform.number}. Route recalculated from your selected checkpoint.`);
    void calculate({ destination: platform.nodeId });
  }
  async function calculate(override: { origin?: string; destination?: string; preference?: RoutePreference; bridgeClosed?: boolean } = {}) {
    const chosenOrigin = override.origin ?? origin;
    const chosenDestination = override.destination ?? destination;
    const chosenPreference = override.preference ?? preference;
    const closure = override.bridgeClosed ?? bridgeClosed;
    setComputing(true);
    setError("");
    try {
      const fix = await manualPositioningProvider.locate(station, chosenOrigin);
      if (fix.status !== "located") { setError(fix.message); setRoute(null); return; }
      const result = findRoute(station, fix.position.nodeId, chosenDestination, {
        preference: chosenPreference, blockedEdgeIds: closure ? bridgeAEdgeIds : [],
      });
      setRoute(result);
      setTab("directions");
      if (result.status === "available") {
        setFloor(fix.position.floor);
        setExpanded(false);
        setSelectedFacility(undefined);
      } else { setError(result.message); setExpanded(true); }
    } catch {
      setError("We could not calculate this route. Please select your locations and try again.");
      setRoute(null);
    } finally { setComputing(false); }
  }
  function quickDemo() {
    setActiveTrainId(""); setPlatformNotice("");
    setOrigin("gate-1"); setDestination("p10-destination"); setPreference("fastest"); setBridgeClosed(false);
    void calculate({ origin: "gate-1", destination: "p10-destination", preference: "fastest", bridgeClosed: false });
  }
  function inspect(facility: Facility) {
    setSelectedFacility(facility); setFloor(facility.floor);
  }
  function showDirections() {
    setTab("directions");
    setExpanded(true);
    requestAnimationFrame(() => directionsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  const available = route?.status === "available";
  const routeEnd = route?.nodes.at(-1)?.name;
  const submit = (event: FormEvent) => { event.preventDefault(); void calculate(); };

  return (
    <main className="navigator">
      {ticketOpen && <TicketLookup trains={trains} onClose={() => setTicketOpen(false)} onNavigate={navigateTrain} />}
      <header className="app-header">
        <Link href="/" className="brand" aria-label="RailNavi home"><span className="brand-icon"><TrainFront size={22} /></span>rail<span>navi</span><i /></Link>
        <button type="button" className="platform-entry" onClick={() => setTicketOpen(true)}>Find My Platform <ArrowUpRight size={16}/></button>
        <details className="help-menu"><summary>How it works <ChevronDown size={14} /></summary><div><strong>Your station, made familiar.</strong><p>Select a known entrance, choose your platform, and calculate a route. Switch levels to follow the highlighted path.</p><p>This fictional station uses manual positioning. No location permission is needed.</p><Link href="/">About RailNavi <ArrowUpRight size={14} /></Link></div></details>
      </header>
      <section className="station-strip">
        <div><div className="eyebrow">EXPLORE THE STATION <span className="demo-badge">FICTIONAL DEMO</span></div><h1>{station.name}</h1><p>12 platforms <span>·</span> 3 levels <span>·</span> One clear way forward</p></div>
        <button type="button" className="quick-demo" aria-label="Try Gate 1 to Platform 10" onClick={quickDemo} disabled={computing}><Sparkles size={16} /><span>Try Gate 1 <ArrowRight size={13} /> Platform 10</span><ArrowUpRight size={17} /></button>
      </section>
      <div className="navigation-workspace">
        <aside className={`navigation-panel ${expanded ? "panel-expanded" : ""}`} aria-label="Journey planner and directions">
          <button type="button" className="mobile-panel-toggle" onClick={() => { if (!expanded && available) showDirections(); else setExpanded(!expanded); }} aria-expanded={expanded} aria-controls="planner-content">
            <span className="mobile-grip" /><span><strong>{available ? `${minutes(route.durationSeconds)} min · ${Math.round(route.distanceMeters)} m` : "Plan your station journey"}</strong><small>{available ? routeEnd : "Choose your start, platform and route"}</small></span>{expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
          <div className="panel-content" id="planner-content">
            <div className="panel-tabs" role="tablist" aria-label="Station tools">
              <button type="button" role="tab" aria-selected={tab === "directions"} aria-controls="directions-tab" id="directions-tab-button" onClick={() => setTab("directions")}><RouteIcon size={16} />Directions</button>
              <button type="button" role="tab" aria-selected={tab === "facilities"} aria-controls="facilities-tab" id="facilities-tab-button" onClick={() => setTab("facilities")}><MapPin size={16} />Facilities<span>48</span></button>
            </div>
            {tab === "directions" ? <div role="tabpanel" id="directions-tab" aria-labelledby="directions-tab-button">
              <form className="journey-form" onSubmit={submit}>
                <div className="panel-heading"><h2>Where are you headed?</h2><p>A little guidance. A lot less guesswork.</p></div>
                <div className="location-fields">
                  <div className="location-field"><span className="location-dot start-dot" /><label htmlFor="origin">YOUR STARTING POINT</label><select id="origin" value={origin} onChange={event => { setOrigin(event.target.value); invalidate(); }}>{station.anchors.map(anchor => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}</select></div>
                  <div className="location-field"><span className="location-dot end-dot" /><label htmlFor="destination">YOUR DESTINATION</label><select id="destination" value={destination} onChange={event => { setDestination(event.target.value); setActiveTrainId(""); invalidate(); }}><optgroup label="Platforms">{station.platforms.map(platform => <option key={platform.id} value={platform.nodeId}>{platform.name} · Boarding area</option>)}</optgroup><optgroup label="Station facilities">{station.facilities.map(facility => <option key={facility.id} value={facility.nodeId}>{facility.name}</option>)}</optgroup></select></div>
                </div>
                <p className="manual-note"><MapPin size={12} />Manually selected location · No GPS required</p>
                <fieldset className="preference-field"><legend>MAKE IT YOUR WAY</legend><div className="preference-grid">{preferences.map(item => <label key={item.id} className={`preference-option ${preference === item.id ? "selected" : ""}`}><input type="radio" name="preference" value={item.id} checked={preference === item.id} onChange={() => { setPreference(item.id); invalidate(); }} /><item.icon size={17} /><span><strong>{item.name}</strong><small>{item.description}</small></span>{preference === item.id && <Check size={13} className="preference-check" />}</label>)}</div></fieldset>
                <details className="simulation-settings"><summary>Passage availability <ChevronDown size={13} /></summary><label><input type="checkbox" checked={bridgeClosed} onChange={event => { setBridgeClosed(event.target.checked); invalidate(); }} />Simulate Bridge A closure</label><p>Closes the cross-station walkway. The engine finds another permitted connection.</p></details>
                <button type="submit" className="button button-primary calculate-button" disabled={computing}>{computing ? <LoaderCircle size={18} className="spin" /> : <Navigation size={17} />} {computing ? "Calculating route…" : available ? "Calculate again" : "Find my route"}<ArrowRight size={17} /></button>
              </form>
              {error && <div className="route-error" role="alert"><strong>Route unavailable</strong><p>{error}</p></div>}
              {available && <section ref={directionsRef} className="directions-section" aria-label="Calculated directions" aria-live="polite">
                <div className="route-summary" data-testid="route-summary">
                  <div className="route-ready"><span className="status-dot" />YOUR ROUTE IS READY <span>{preferences.find(item => item.id === route.preference)?.name}</span></div>
                  <div className="route-numbers"><strong>{minutes(route.durationSeconds)}<span> min</span></strong><i /><strong>{Math.round(route.distanceMeters)}<span> m</span></strong><small>{route.floorChanges.length} level changes</small></div>
                  <p><span className="summary-a">A</span>{route.nodes[0]?.name}<ArrowRight size={13} /><span className="summary-b">B</span>{routeEnd}</p>
                  {route.preference !== "wheelchair" && <button type="button" className="text-button" onClick={() => { setPreference("wheelchair"); void calculate({ preference: "wheelchair" }); }}><Accessibility size={15} />Switch to a step-free route<ArrowUpRight size={14} /></button>}
                </div>
                <div className="steps-heading"><h3>Your way, step by step</h3><span>{route.instructions.length} steps</span></div>
                <ol className="directions-list">{route.instructions.map((step, i) => <li key={i}><button type="button" className={`direction-step ${step.floor === floor ? "on-floor" : ""}`} onClick={() => { setFloor(step.kind === "transition" ? step.toFloor : step.floor); setExpanded(false); }}><span className={`step-number ${step.kind === "arrive" ? "arrival" : ""}`}>{step.kind === "arrive" ? <Flag size={14} /> : i + 1}</span><span><strong>{step.text}</strong><small>{floorLabel(step.floor)}{step.kind === "transition" ? ` → ${floorLabel(step.toFloor)}` : ""}{step.distanceMeters > 0 ? ` · ${Math.round(step.distanceMeters)} m` : ""}</small></span><ArrowUpRight size={13} /></button></li>)}</ol>
                <p className="estimate-note">Estimates use a 1.2 m/s walking speed and fixed vertical travel times. Follow station signage in a real station.</p>
              </section>}
              {!available && !error && <div className="route-empty"><div><RouteIcon size={24} /></div><h3>A clear path starts here.</h3><p>Select your starting point and platform.<br />We’ll connect the dots, safely.</p><button type="button" className="text-button" onClick={quickDemo}>Try the Gate 1 → Platform 10 journey<ArrowRight size={14} /></button></div>}
            </div> : <div className="facilities-panel" role="tabpanel" id="facilities-tab" aria-labelledby="facilities-tab-button">
              <div className="panel-heading"><h2>Amenities along the way</h2><p>Find a quick stop or the help you need.</p></div>
              <label className="facility-search"><Search size={16} /><input aria-label="Search facilities" placeholder="Water, tea, pharmacy…" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <label className="category-label" htmlFor="facility-category">FACILITY TYPE</label>
              <select id="facility-category" className="category-select" value={category} onChange={event => setCategory(event.target.value as FacilityCategory | "all")}><option value="all">All facilities</option>{Object.entries(facilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <p className="facility-count">{facilityResults.length} facilities across all levels · Select to locate</p>
              <div className="facility-list">{facilityResults.map(facility => <button type="button" className={`facility-card ${selectedFacility?.id === facility.id ? "selected" : ""}`} key={facility.id} onClick={() => { inspect(facility); setExpanded(false); }}><span className="facility-icon"><FacilityIcon category={facility.category} size={18} /></span><span><strong>{facility.name}</strong><small>{floorLabel(facility.floor)} · {facilityLabels[facility.category]}</small></span><ArrowUpRight size={15} /></button>)}</div>
              {facilityResults.length === 0 && <p className="no-results">No facilities match your search. Try another name or category.</p>}
            </div>}
            <div className="panel-footnote"><ShieldCheck size={14} />Synthetic station data. Real routing logic.</div>
          </div>
        </aside>
        <section className="map-panel" aria-label="Station plan">
          {platformNotice && <div className="platform-notice" role="status">{platformNotice}</div>}
          {activeTrain && <div className="train-control"><span><strong>{activeTrain.name}</strong> · Platform <b data-testid="active-platform">{activeTrain.platformId.split("-")[1]}</b></span><details><summary>Simulate platform change</summary><label htmlFor="simulate-platform">Demo assignment</label><select id="simulate-platform" value={activeTrain.platformId} onChange={event => changePlatform(event.target.value)}>{station.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></details></div>}
          <div className="map-topbar"><div><span className="status-dot" /><strong>{floorLabel(floor)}</strong><span>{station.floors.find(item => item.id === floor)?.name}</span></div><button type="button" className={`facilities-toggle ${tab === "facilities" ? "active" : ""}`} onClick={() => { setTab(tab === "facilities" ? "directions" : "facilities"); setExpanded(true); }}><MapPin size={15} /><span>Facilities</span></button></div>
          {bridgeClosed && <div className="closure-banner">Bridge A walkway closed · Routes use an alternative crossing</div>}
          <StationMap station={station} floor={floor} route={route} showFacilities={tab === "facilities"} facilityCategory={category} selectedFacilityId={selectedFacility?.id} onFacilitySelect={inspect} />
          {available && <div className="next-direction" key={route.edges.map(e => e.id).join("|")}><span className="next-arrow"><Navigation size={24}/></span><div><small>YOUR NEXT DIRECTION · {floorLabel(route.instructions[0]!.floor)}</small><strong>{route.instructions[0]?.text}</strong><p>{Math.round(route.distanceMeters)} m · {minutes(route.durationSeconds)} min · {routeEnd}</p></div></div>}
          <div className="floor-switcher" aria-label="Select station level"><span>LEVELS</span>{station.floors.map(item => <button type="button" key={item.id} aria-label={`Show ${floorLabel(item.id)}`} aria-pressed={floor === item.id} onClick={() => setFloor(item.id)}><strong>{item.id > 0 ? "+" : ""}{item.id}</strong><span>{item.name}</span>{route?.nodes.some(node => node.floor === item.id) && <i className="floor-route-dot" />}</button>)}</div>
          {available && <div className="map-route-chip"><Navigation size={15} /><span><strong>{minutes(route.durationSeconds)} min</strong> to {routeEnd}</span><button type="button" onClick={showDirections}>Directions<ChevronUp size={14} /></button></div>}
          {selectedFacility && <div className="facility-detail" role="region" aria-label="Selected facility"><button type="button" className="detail-close icon-button" aria-label="Close facility details" onClick={() => setSelectedFacility(undefined)}><X size={17} /></button><span className="facility-icon"><FacilityIcon category={selectedFacility.category} size={22} /></span><div><small>{facilityLabels[selectedFacility.category]} · {floorLabel(selectedFacility.floor)}</small><h3>{selectedFacility.name}</h3><p><Accessibility size={14} />Accessible via step-free connections</p><button type="button" className="text-button" onClick={() => { setActiveTrainId(""); setPlatformNotice(""); setDestination(selectedFacility.nodeId); void calculate({ destination: selectedFacility.nodeId }); }}>Route here<ArrowRight size={15} /></button></div></div>}
          <div className="station-disclaimer">Demonstration station · No live railway or passenger data</div>
        </section>
      </div>
    </main>
  );
}
