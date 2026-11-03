"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, ArrowUpRight, Accessibility, Check, ChevronDown, ChevronUp,
  Clock3, Flag, Footprints, Layers3, LoaderCircle, MapPin, Navigation,
  Route as RouteIcon, ShieldCheck, Sparkles, TrainFront,
} from "lucide-react";
import { findRoute, floorLabel } from "@/lib/navigation/engine";
import type { Facility, FacilityCategory, FloorId, GeneratedRoute, JourneyStop, RoutePreference, RoutingOptions } from "@/lib/navigation/types";
import { manualPositioningProvider } from "@/lib/positioning/manual";
import { bridgeAEdgeIds, liftEdgeIds, demoStation as station } from "@/lib/station/demo-station";
import { FacilityDiscovery, FacilityDetails, JourneyPlanning } from "./station-companion";
import { discoverFacilities, toJourneyStop, type FacilityMatch } from "@/lib/facilities/search";
import { facilityAvailable } from "@/lib/facilities/catalog";
import { insertBestStop, MAX_OPTIONAL_STOPS, optimizeStops, planJourney } from "@/lib/journey/planner";
import { assessTiming, serviceTime } from "@/lib/journey/time";
import { positionContext } from "@/lib/navigation/context";
import { useNavigationSimulation } from "./use-navigation-simulation";
import { SimulationControls } from "./simulation-controls";
import { sessionGuidance } from "@/lib/navigation/simulator";
import { StationMap } from "./station-map";
import { TicketLookup } from "./ticket-lookup";
import { assignPlatform, demoTrains } from "@/lib/tickets/demo";

const preferences: { id: RoutePreference; name: string; description: string; icon: typeof Clock3 }[] = [
  { id: "fastest", name: "Fastest", description: "Least estimated time", icon: Clock3 },
  { id: "shortest", name: "Shortest", description: "Least distance", icon: Footprints },
  { id: "wheelchair", name: "Wheelchair", description: "Lifts & step-free paths", icon: Accessibility },
  { id: "avoid-stairs", name: "Avoid stairs", description: "Escalators & lifts", icon: Layers3 },
];
const minutes = (seconds: number) => Math.max(0, Math.ceil(seconds / 60));

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
  const [stops, setStops] = useState<JourneyStop[]>([]);
  const onVisit = useCallback((id: string) => setStops(current => current.filter(s => s.id !== id)), [setStops]);
  const [plannedRoute, setRoute] = useState<GeneratedRoute | null>(null);
  const onStop = useCallback(() => setRoute(null), [setRoute]);
  const sim = useNavigationSimulation(station, setFloor, onVisit, setStops, onStop);
  const [facilityAvailability, setFacilityAvailability] = useState<Record<string, boolean>>({});
  const [buffer, setBuffer] = useState(300);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<FacilityMatch>();
  const [liftsClosed, setLiftsClosed] = useState(false);
  const [crossingOutage, setCrossingOutage] = useState("");
  const route = sim.session?.route ?? plannedRoute;
  const guidance = sim.session ? sessionGuidance(sim.session) : null;
  const blockedIds = useMemo(() => [...(bridgeClosed ? bridgeAEdgeIds : []), ...(liftsClosed ? liftEdgeIds : []), ...station.edges.filter(e => e.kind === "walk" && e.label === crossingOutage).map(e => e.id)], [bridgeClosed, liftsClosed, crossingOutage]);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"directions" | "facilities">("directions");
  const [expanded, setExpanded] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility>();
  const [category, setCategory] = useState<FacilityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const directionsRef = useRef<HTMLElement>(null);
  const journeyRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => ({ preference, blockedEdgeIds: blockedIds }), [preference, blockedIds]);
  const sourceId = station.anchors.find(a => a.id === origin)?.nodeId ?? origin;
  const context = positionContext(station, sourceId, sim.session, options);
  const direct = useMemo(() => findRoute(context.graph, context.startId, destination, options), [context.graph, context.startId, destination, options]);
  const remainingRoute = route && guidance ? { ...route, durationSeconds: guidance.walkingSeconds, dwellSeconds: guidance.dwellSeconds } : route;
  const timing = assessTiming(sim.nowSeconds, activeTrain ? serviceTime(activeTrain.departure) : undefined, remainingRoute, buffer);

  function updateStops(next: JourneyStop[], nextPreference = preference, keepPanel = true) {
    setStops(next); setPreference(nextPreference);
    void calculate({ stops: next, preference: nextPreference, keepPanel, reason: "Optional stops updated. Your final destination is preserved." });
  }
  function addStop(f: Facility, accessible = false) {
    if (stops.some(s => s.id === f.id) || sim.session?.visitedStopIds?.includes(f.id)) return;
    if (stops.length >= MAX_OPTIONAL_STOPS) { setPlatformNotice("Choose up to four optional stops. Remove one before adding another."); return; }
    const nextPreference = accessible ? "wheelchair" : preference;
    const opts = { ...options, preference: nextPreference };
    const pos = positionContext(station, sourceId, sim.session, opts);
    if (!pos.valid) { setPlatformNotice("Restore the occupied connector before planning this stop."); return; }
    const next = insertBestStop(pos.graph, pos.startId, destination, stops, {...toJourneyStop(f, sim.nowSeconds, facilityAvailability), available: true}, opts);
    if (next.route.status !== "available") { setPlatformNotice(next.route.message); return; }
    updateStops(next.stops, nextPreference, false); setSelectedFacility(undefined);
    setPlatformNotice(f.name + " added. " + (activeTrain ? "Your train platform remains the final destination." : "Your final destination is preserved."));
  }
  function optimizeJourney() {
    if (!context.valid) return;
    const best = optimizeStops(context.graph, context.startId, destination, stops, options);
    if (best.route.status !== "available") { setPlatformNotice(best.route.message); return; }
    updateStops(best.stops); setPlatformNotice("Stop order optimized using actual walking connections. Final destination preserved.");
  }
  function moveStop(id: string, delta: number) {
    const next = [...stops], i = next.findIndex(s => s.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!]; updateStops(next);
  }
  function setFacilityAvailable(id: string, available: boolean) {
    const next = { ...facilityAvailability, [id]: available }; setFacilityAvailability(next);
    setPlatformNotice("Fictional facility availability updated." + (stops.some(s => s.id === id) ? " Pending stop reassessed; remove it if unavailable." : ""));
    if (route || sim.session) void calculate({ availability: next, keepPanel: true, reason: "Facility availability changed. Pending stops reassessed." });
  }
  function changeClock(seconds: number) {
    sim.setClock(seconds);
    if (route || sim.session) void calculate({ now: seconds, keepPanel: true, reason: "Fictional clock updated. Facility opening hours and timing reassessed." });
  }

  function invalidate() { setSelectedFacility(undefined); setSelectedMatch(undefined); sim.stop(); setRoute(null); setError(""); setPlatformNotice(""); }
  function changeAvailability(kind: "bridge" | "lifts", closed: boolean) {
    if (kind === "bridge") setBridgeClosed(closed); else setLiftsClosed(closed);
    if (sim.session) void calculate({ ...(kind === "bridge" ? {bridgeClosed: closed} : {liftsClosed: closed}), reason: kind === "bridge" ? "Bridge A availability changed. Route recalculated from the passenger position." : "Lift availability changed. Accessible routing restrictions remain enforced." });
    else { setRoute(null); setError(""); }
  }
  function changeCrossing(name: string) {
    setCrossingOutage(name);
    if (sim.session) void calculate({crossingOutage: name, reason: name ? name + " closed. Recalculating from your actual simulated position." : "Crossing restored. Route recalculated."});
    else { setRoute(null); setError(""); }
  }
  function navigateTrain(trainId: string, anchorId: string) {
    const train = trains.find(item => item.id === trainId);
    const platform = station.platforms.find(item => item.id === train?.platformId);
    if (!platform || train?.status === "cancelled") { setRoute(null); setError("This demo departure is unavailable."); return; }
    setActiveTrainId(trainId); setOrigin(anchorId); setDestination(platform.nodeId);
    setTicketOpen(false); setPlatformNotice(""); setStops([]);
    sim.setClock(Math.max(0, serviceTime(train!.departure) - 25 * 60));
    void calculate({ origin: anchorId, destination: platform.nodeId, stops: [], now: Math.max(0, serviceTime(train!.departure) - 25 * 60) });
  }
  function changePlatform(platformId: string) {
    if (!activeTrain) return;
    const updated = assignPlatform(trains, activeTrain.id, platformId, station.platforms.map(p => p.id));
    setTrains(updated);
    const platform = station.platforms.find(p => p.id === platformId)!;
    setRoute(null); setDestination(platform.nodeId);
    setPlatformNotice(`Simulation: ${activeTrain.name} moved to Platform ${platform.number}. Route recalculated from your ${sim.session ? "current simulated position" : "selected checkpoint"}.`);
    void calculate({ destination: platform.nodeId, reason: "Platform assignment changed. Route recalculated from the current passenger position." });
  }
  async function calculate(override: { origin?: string; destination?: string; preference?: RoutePreference; bridgeClosed?: boolean; liftsClosed?: boolean; crossingOutage?: string; reason?: string; stops?: JourneyStop[]; availability?: Record<string, boolean>; now?: number; keepPanel?: boolean } = {}) {
    const chosenOrigin = override.origin ?? origin;
    const chosenDestination = override.destination ?? destination;
    const chosenPreference = override.preference ?? preference;
    const closure = override.bridgeClosed ?? bridgeClosed;
    const blocked = [...(closure ? bridgeAEdgeIds : []), ...((override.liftsClosed ?? liftsClosed) ? liftEdgeIds : []), ...station.edges.filter(e => e.kind === "walk" && e.label === (override.crossingOutage ?? crossingOutage)).map(e => e.id)];
    const opts: RoutingOptions = { preference: chosenPreference, blockedEdgeIds: blocked };
    const now = override.now ?? sim.nowSeconds;
    const fromId = station.anchors.find(a => a.id === chosenOrigin)?.nodeId ?? chosenOrigin;
    const pos = positionContext(station, fromId, override.origin ? null : sim.session, opts);
    const pending = override.stops ?? stops;
    const tentative = planJourney(pos.graph, pos.startId, chosenDestination, pending.map(s => ({...s, available: true})), opts);
    let dwell = override.origin ? 0 : sim.session?.currentStop?.dwellSeconds ?? 0;
    const ready = pending.map(stop => {
      const visit = tentative.stopVisits?.find(s => s.id === stop.id);
      const walking = tentative.edges.slice(0, visit?.edgeIndex ?? 0).reduce((n, e) => n + e.durationSeconds, 0);
      const f = station.facilities.find(f => f.id === stop.id);
      const available = !f || facilityAvailable(f, now + pos.prefixSeconds + walking + dwell, override.availability ?? facilityAvailability);
      dwell += stop.dwellSeconds;
      return {...stop, available};
    });
    setStops(ready);
    setError(""); setSelectedMatch(undefined); setSelectedFacility(undefined);
    if (sim.session && !override.origin) {
      sim.replan(chosenDestination, { preference: chosenPreference, blockedEdgeIds: blocked }, override.reason ?? "Route recalculated from the current simulated position.", ready);
      if (!override.keepPanel) setExpanded(false); return;
    }
    if (override.origin) sim.stop();
    setComputing(true);
    setError("");
    try {
      const fix = await manualPositioningProvider.locate(station, chosenOrigin);
      if (fix.status !== "located") { setError(fix.message); setRoute(null); return; }
      const result = planJourney(station, fix.position.nodeId, chosenDestination, ready, opts);
      setRoute(result);
      if (!override.keepPanel) setTab("directions");
      if (result.status === "available") {
        if (!override.keepPanel) { setFloor(fix.position.floor); setExpanded(false); }
        setSelectedFacility(undefined);
      } else { setError(result.message); setExpanded(true); }
    } catch {
      setError("We could not calculate this route. Please select your locations and try again.");
      setRoute(null);
    } finally { setComputing(false); }
  }
  function quickDemo() {
    setActiveTrainId(""); setPlatformNotice(""); setStops([]);
    setOrigin("gate-1"); setDestination("p10-destination"); setPreference("fastest"); setBridgeClosed(false); setLiftsClosed(false); setCrossingOutage("");
    void calculate({ origin: "gate-1", destination: "p10-destination", preference: "fastest", bridgeClosed: false, liftsClosed: false, crossingOutage: "", stops: [] });
  }
  function inspect(facility: Facility, match?: FacilityMatch) {
    const found = match ?? discoverFacilities({station, position: context, finalId: destination, stops, options, now: sim.nowSeconds, availability: facilityAvailability, query: facility.name, departure: activeTrain ? serviceTime(activeTrain.departure) : undefined, buffer, remainingVisitSeconds: sim.session?.currentStop?.dwellSeconds}).results.find(r => r.facility.id === facility.id);
    setSelectedMatch(found); setSelectedFacility(facility); setFloor(facility.floor); setExpanded(false);
  }
  function showJourney() {
    setTab("directions"); setExpanded(true);
    requestAnimationFrame(() => journeyRef.current?.scrollIntoView({block: "start", behavior: "smooth"}));
  }
  function showDirections() {
    setTab("directions");
    setExpanded(true);
    requestAnimationFrame(() => directionsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  const available = route?.status === "available" && sim.session?.status !== "blocked";
  const routeEnd = sim.session ? station.nodes.find(n => n.id === sim.session!.destinationId)?.name : route?.nodes.at(-1)?.name;
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
        <div><div className="eyebrow">EXPLORE THE STATION <span className="demo-badge">FICTIONAL DEMO</span></div><h1>{station.name}</h1><p>{station.platforms.length} platforms <span>·</span> {station.floors.length} levels <span>·</span> One clear way forward</p></div>
        <button type="button" className="quick-demo" aria-label="Try Gate 1 to Platform 10" onClick={quickDemo} disabled={computing}><Sparkles size={16} /><span>Try Gate 1 <ArrowRight size={13} /> Platform 10</span><ArrowUpRight size={17} /></button>
      </section>
      <div className="navigation-workspace">
        <aside className={`navigation-panel ${expanded ? "panel-expanded" : ""}`} aria-label="Journey planner and directions">
          <button type="button" className="mobile-panel-toggle" onClick={() => { if (!expanded && available) showDirections(); else setExpanded(!expanded); }} aria-expanded={expanded} aria-controls="planner-content">
            <span className="mobile-grip" /><span><strong>{available ? `${minutes(guidance?.remainingSeconds ?? (route.durationSeconds + (route.dwellSeconds ?? 0)))} min · ${Math.round(guidance?.remainingDistance ?? route.distanceMeters)} m` : "Plan your station journey"}</strong><small>{available ? routeEnd : "Choose your start, platform and route"}</small></span>{expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
          <div className="panel-content" id="planner-content">
            <div className="panel-tabs" role="tablist" aria-label="Station tools">
              <button type="button" role="tab" aria-selected={tab === "directions"} aria-controls="directions-tab" id="directions-tab-button" onClick={() => setTab("directions")}><RouteIcon size={16} />Directions</button>
              <button type="button" role="tab" aria-selected={tab === "facilities"} aria-controls="facilities-tab" id="facilities-tab-button" onClick={() => setTab("facilities")}><MapPin size={16} />Facilities<span>{station.facilities.length}</span></button>
            </div>
            {tab === "directions" ? <div role="tabpanel" id="directions-tab" aria-labelledby="directions-tab-button">
              <form className="journey-form" onSubmit={submit}>
                <div className="panel-heading"><h2>Where are you headed?</h2><p>A little guidance. A lot less guesswork.</p></div>
                <div className="location-fields">
                  <div className="location-field"><span className="location-dot start-dot" /><label htmlFor="origin">YOUR STARTING POINT</label><select id="origin" value={origin} onChange={event => { setOrigin(event.target.value); invalidate(); }}>{station.anchors.map(anchor => <option key={anchor.id} value={anchor.id}>{anchor.label}</option>)}</select></div>
                  <div className="location-field"><span className="location-dot end-dot" /><label htmlFor="destination">YOUR DESTINATION</label><select id="destination" value={destination} onChange={event => { setDestination(event.target.value); setActiveTrainId(""); if (sim.session) void calculate({destination: event.target.value, reason: "Destination changed. Route updated from your simulated position."}); else invalidate(); }}><optgroup label="Platforms">{station.platforms.map(platform => <option key={platform.id} value={platform.nodeId}>{platform.name} · Boarding area</option>)}</optgroup><optgroup label="Station facilities">{station.facilities.map(facility => <option key={facility.id} value={facility.nodeId}>{facility.name}</option>)}</optgroup></select></div>
                </div>
                <p className="manual-note"><MapPin size={12} />Manually selected location · No GPS required</p>
                <fieldset className="preference-field"><legend>MAKE IT YOUR WAY</legend><div className="preference-grid">{preferences.map(item => <label key={item.id} className={`preference-option ${preference === item.id ? "selected" : ""}`}><input type="radio" name="preference" value={item.id} checked={preference === item.id} onChange={() => { setPreference(item.id); if (sim.session) void calculate({preference: item.id, reason: "Navigation preference changed. Route updated from your simulated position."}); else invalidate(); }} /><item.icon size={17} /><span><strong>{item.name}</strong><small>{item.description}</small></span>{preference === item.id && <Check size={13} className="preference-check" />}</label>)}</div></fieldset>
                <details className="simulation-settings"><summary>Passage availability <ChevronDown size={13} /></summary><label><input type="checkbox" checked={bridgeClosed} onChange={event => { changeAvailability("bridge", event.target.checked); }} />Simulate Bridge A closure</label><label><input type="checkbox" checked={liftsClosed} onChange={event => changeAvailability("lifts", event.target.checked)} />Simulate lift outage</label><label>Station crossing availability<select aria-label="Station crossing availability" value={crossingOutage} onChange={event => changeCrossing(event.target.value)}><option value="">All other crossings available</option>{station.geometry?.regions.filter(r => (r.kind === "bridge" || r.kind === "underpass") && r.name !== "Foot Overbridge A").map(r => <option key={r.id} value={r.name}>{r.name} closed</option>)}</select></label><p>Shared demo availability applies to planning and live simulation. Restore connections here if no safe route exists.</p></details>
                <button type="submit" className="button button-primary calculate-button" disabled={computing}>{computing ? <LoaderCircle size={18} className="spin" /> : <Navigation size={17} />} {computing ? "Calculating route…" : available ? "Calculate again" : "Find my route"}<ArrowRight size={17} /></button>
              </form>
              {error && <div className="route-error" role="alert"><strong>Route unavailable</strong><p>{error}</p></div>}
              {available && <section ref={directionsRef} className="directions-section" aria-label="Calculated directions" aria-live="polite">
                <div className="route-summary" data-testid="route-summary">
                  <div className="route-ready"><span className="status-dot" />YOUR ROUTE IS READY <span>{preferences.find(item => item.id === route.preference)?.name}</span></div>
                  <div className="route-numbers"><strong>{minutes(guidance?.remainingSeconds ?? (route.durationSeconds + (route.dwellSeconds ?? 0)))}<span> min</span></strong><i /><strong>{Math.round(route.distanceMeters)}<span> m</span></strong><small>{route.floorChanges.length} level changes</small></div>
                  <p><span className="summary-a">A</span>{route.nodes[0]?.name}<ArrowRight size={13} /><span className="summary-b">B</span>{routeEnd}</p>
                  <button type="button" className="text-button" onClick={showJourney}><Clock3 size={15}/>View stops and timing<ArrowUpRight size={14}/></button>
                  {route.preference !== "wheelchair" && <button type="button" className="text-button" onClick={() => { setPreference("wheelchair"); void calculate({ preference: "wheelchair" }); }}><Accessibility size={15} />Switch to a step-free route<ArrowUpRight size={14} /></button>}
                </div>
                <div className="steps-heading"><h3>Your way, step by step</h3><span>{route.instructions.length} steps</span></div>
                <ol className="directions-list">{route.instructions.map((step, i) => <li key={i}><button type="button" className={`direction-step ${step.floor === floor ? "on-floor" : ""}`} onClick={() => { setFloor(step.kind === "transition" ? step.toFloor : step.floor); setExpanded(false); }}><span className={`step-number ${step.kind === "arrive" ? "arrival" : ""}`}>{step.kind === "arrive" ? <Flag size={14} /> : i + 1}</span><span><strong>{step.text}</strong><small>{floorLabel(step.floor)}{step.kind === "transition" ? ` → ${floorLabel(step.toFloor)}` : ""}{step.distanceMeters > 0 ? ` · ${Math.round(step.distanceMeters)} m` : ""}</small></span><ArrowUpRight size={13} /></button></li>)}</ol>
                <p className="estimate-note">Estimates use a 1.2 m/s walking speed and fixed vertical travel times. Follow station signage in a real station.</p>
              </section>}
              {!available && !error && !sim.session && <div className="route-empty"><div><RouteIcon size={24} /></div><h3>A clear path starts here.</h3><p>Select your starting point and platform.<br />We’ll connect the dots, safely.</p><button type="button" className="text-button" onClick={quickDemo}>Try the Gate 1 → Platform 10 journey<ArrowRight size={14} /></button></div>}
            </div> : <div role="tabpanel" id="facilities-tab" aria-labelledby="facilities-tab-button">
              <FacilityDiscovery station={station} position={context} finalId={destination} stops={stops} options={options} now={sim.nowSeconds} availability={facilityAvailability} departure={activeTrain ? serviceTime(activeTrain.departure) : undefined} buffer={buffer} remainingVisitSeconds={sim.session?.currentStop?.dwellSeconds} query={query} onQuery={setQuery} category={category} onCategory={setCategory} onInspect={inspect} onMatches={setMatchedIds}/>
            </div>}
            <div ref={journeyRef}><JourneyPlanning station={station} route={remainingRoute} direct={direct.status === "available" ? {...direct, durationSeconds: direct.durationSeconds + context.prefixSeconds} : direct} stops={stops} visited={sim.session?.visitedStopIds ?? []} currentStop={sim.session?.currentStop} finalName={routeEnd ?? station.nodes.find(n => n.id === destination)?.name ?? "Your platform"} now={sim.nowSeconds} departure={activeTrain?.departure} buffer={buffer} onBuffer={setBuffer} onClock={changeClock} onDeparture={activeTrain ? value => setTrains(current => current.map(t => t.id === activeTrain.id ? {...t, departure: value} : t)) : undefined} onRemove={id => updateStops(stops.filter(s => s.id !== id))} onMove={moveStop} onClear={() => updateStops([])} onOptimize={optimizeJourney} onDwell={(id, value) => { if (Number.isFinite(value) && value >= 0 && value <= 1800) updateStops(stops.map(s => s.id === id ? {...s, dwellSeconds: value} : s)); }} availability={facilityAvailability} onAvailability={setFacilityAvailable}/></div>
            <div className="panel-footnote"><ShieldCheck size={14} />Synthetic station data. Real routing logic.</div>
          </div>
        </aside>
        <section className="map-panel" aria-label="Station plan">
          {platformNotice && <div className="platform-notice" role="status">{platformNotice}</div>}
          {activeTrain && <div className="train-control"><span><strong>{activeTrain.name}</strong> · Platform <b data-testid="active-platform">{activeTrain.platformId.split("-")[1]}</b></span><details><summary>Simulate platform change</summary><label htmlFor="simulate-platform">Demo assignment</label><select id="simulate-platform" value={activeTrain.platformId} onChange={event => changePlatform(event.target.value)}>{station.platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></details></div>}
          <div className="map-topbar"><div><span className="status-dot" /><strong>{floorLabel(floor)}</strong><span>{station.floors.find(item => item.id === floor)?.name}</span></div><button type="button" className={`facilities-toggle ${tab === "facilities" ? "active" : ""}`} onClick={() => { setTab(tab === "facilities" ? "directions" : "facilities"); setExpanded(true); }}><MapPin size={15} /><span>Facilities</span></button></div>
          {bridgeClosed && <div className="closure-banner">Bridge A walkway closed · Routes use an alternative crossing</div>}
          <StationMap station={station} floor={floor} route={sim.session?.status === "blocked" ? null : route} passenger={sim.session?.position} passengerStatus={sim.session?.status} destinationId={sim.session?.destinationId} unavailableEdgeIds={blockedIds} landmarkNodeId={guidance?.current?.nodeIds.at(-1)} showFacilities={tab === "facilities"} facilityCategory={category} selectedFacilityId={selectedFacility?.id} matchingFacilityIds={tab === "facilities" ? matchedIds : undefined} previewRoute={selectedFacility && selectedMatch?.reachable ? selectedMatch.route : undefined} onFacilitySelect={inspect} onPassengerFloor={setFloor}>
          <div className="floor-switcher" aria-label="Select station level"><span>LEVELS</span>{station.floors.map(item => <button type="button" key={item.id} aria-label={`Show ${floorLabel(item.id)}`} aria-pressed={floor === item.id} onClick={() => setFloor(item.id)}><strong>{item.id > 0 ? "+" : ""}{item.id}</strong><span>{item.name}</span>{route?.nodes.some(node => node.floor === item.id) && <i className="floor-route-dot" />}</button>)}</div>
          </StationMap>
          {route && <button type="button" className={"journey-status-strip timing-" + timing.status} onClick={showJourney}><Clock3 size={15}/><span>{activeTrain ? timing.message : "Plan useful stops"}</span><strong>{stops.length} stop{stops.length === 1 ? "" : "s"}</strong><ChevronUp size={15}/></button>}
          <SimulationControls controller={sim} route={route} station={station} options={{preference, blockedEdgeIds: blockedIds}} bridgeClosed={bridgeClosed} liftsClosed={liftsClosed} crossingOutage={crossingOutage} onCrossing={changeCrossing} onBridge={closed => changeAvailability("bridge", closed)} onLifts={closed => changeAvailability("lifts", closed)} />
          {available && <div className="next-direction" key={route.edges.map(e => e.id).join("|")}><span className="next-arrow"><Navigation size={24}/></span><div><small>{sim.session?.status === "arrived" ? "ARRIVED" : "YOUR NEXT DIRECTION"} · {floorLabel(sim.session?.position.floor ?? route.instructions[0]!.floor)}</small><strong>{guidance?.current?.text ?? route.instructions[0]?.text}</strong><p>{Math.round(guidance?.remainingDistance ?? route.distanceMeters)} m · {minutes(guidance?.remainingSeconds ?? (route.durationSeconds + (route.dwellSeconds ?? 0)))} min · {routeEnd}</p>{guidance && <p className="upcoming-direction">{Math.round(guidance.decisionDistance)} m to next decision · Then: {guidance.upcoming?.text ?? "Arrival"}</p>}</div></div>}
          {available && <div className="map-route-chip"><Navigation size={15} /><span><strong>{minutes((route.durationSeconds + (route.dwellSeconds ?? 0)))} min</strong> to {routeEnd}</span><button type="button" onClick={showDirections}>Directions<ChevronUp size={14} /></button></div>}
          {selectedFacility && <FacilityDetails facility={selectedFacility} match={selectedMatch} now={sim.nowSeconds} availability={facilityAvailability} trainActive={!!activeTrain} visited={sim.session?.visitedStopIds?.includes(selectedFacility.id)} pending={stops.some(s => s.id === selectedFacility.id) || sim.session?.currentStop?.id === selectedFacility.id} onClose={() => {setSelectedFacility(undefined); setSelectedMatch(undefined);}} onAdd={accessible => addStop(selectedFacility, accessible)} onMain={() => { setActiveTrainId(""); setPlatformNotice(""); setStops([]); setDestination(selectedFacility.nodeId); void calculate({ destination: selectedFacility.nodeId, stops: [] }); }}/>}
          <div className="station-disclaimer">Demonstration station · No live railway or passenger data</div>
        </section>
      </div>
    </main>
  );
}

