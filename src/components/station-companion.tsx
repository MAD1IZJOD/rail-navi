"use client";
import {useDeferredValue,useEffect,useMemo,useRef,useState} from "react";
import {Accessibility,ArrowDown,ArrowRight,ArrowUp,Clock3,MapPin,Plus,Search,ShieldCheck,Sparkles,X} from "lucide-react";
import type {Facility,FacilityCategory,GeneratedRoute,JourneyStop,RouteVisit,RoutingOptions,Station} from "@/lib/navigation/types";
import type {PositionContext} from "@/lib/navigation/context";
import {categoryNames,facilityAvailable} from "@/lib/facilities/catalog";
import {discoverFacilities,type FacilityMatch} from "@/lib/facilities/search";
import {assessTiming,clockLabel,serviceTime} from "@/lib/journey/time";
import {floorLabel} from "@/lib/navigation/engine";
import {FacilityIcon} from "./facility-icon";
const mins=(n:number)=>Number.isFinite(n)?Math.ceil(n/60)+" min":"Unavailable";
interface DiscoveryProps{
 station:Station;position:PositionContext;finalId:string;stops:JourneyStop[];options:RoutingOptions;now:number;availability:Record<string,boolean>;
 departure?:number;buffer:number;remainingVisitSeconds?:number;
 query:string;onQuery:(q:string)=>void;category:FacilityCategory|"all";onCategory:(category:FacilityCategory|"all")=>void;
 onInspect:(facility:Facility,match?:FacilityMatch)=>void;onMatches:(ids:string[])=>void;
}
export function FacilityDiscovery(p:DiscoveryProps){
 const [assistance,setAssistance]=useState(false);
 const latest=useRef(p);
 useEffect(()=>{latest.current=p;},[p]);
 const [snapshot,setSnapshot]=useState(()=>({position:p.position,now:p.now,options:p.options,stops:p.stops,availability:p.availability,departure:p.departure,buffer:p.buffer,remainingVisitSeconds:p.remainingVisitSeconds}));
 const query=useDeferredValue(p.query),key=p.options.preference+"|"+(p.options.blockedEdgeIds??[]).join(",")+"|"+JSON.stringify(p.stops)+"|"+JSON.stringify(p.availability)+"|"+Math.floor(p.now/60)+"|"+p.finalId+"|"+p.departure+"|"+p.buffer+"|"+p.remainingVisitSeconds;
 useEffect(()=>{const timer=setTimeout(()=>{const v=latest.current;setSnapshot({position:v.position,now:v.now,options:v.options,stops:v.stops,availability:v.availability,departure:v.departure,buffer:v.buffer,remainingVisitSeconds:v.remainingVisitSeconds});},120);return()=>clearTimeout(timer);},[key,query,p.category]);
 const found=useMemo(()=>discoverFacilities({station:p.station,...snapshot,finalId:p.finalId,query,category:p.category}),[p.station,p.finalId,p.category,query,snapshot]);
 const results=found.results.filter(r=>!assistance||["information","first-aid","accessible","lost-found","tickets","security"].includes(r.facility.category));
 const resultIds=useMemo(()=>found.results.map(r=>r.facility.id),[found.results]);
 const onMatches=p.onMatches;
 useEffect(()=>onMatches(resultIds),[onMatches,resultIds]);
 const refresh=()=>{const v=latest.current;setSnapshot({position:v.position,now:v.now,options:v.options,stops:v.stops,availability:v.availability,departure:v.departure,buffer:v.buffer,remainingVisitSeconds:v.remainingVisitSeconds});};
 return <div className={"facilities-panel companion-discovery"+(query||p.category!=="all"?" has-query":"")}>
 <div className="discovery-heading"><div className="eyebrow">YOUR STATION COMPANION</div><h2>A useful stop.<br/>{" "}A clear way there.</h2><p>Find what you need without losing your platform.</p></div>
 <div className="discovery-mode"><button type="button" aria-pressed={!assistance} onClick={()=>setAssistance(false)}>Discover</button><button type="button" aria-pressed={assistance} onClick={()=>{setAssistance(true);p.onQuery("help desk");p.onCategory("all");}}><ShieldCheck size={15}/>Passenger assistance</button></div>
 <label className="facility-search"><Search size={18}/><input aria-label="Search facilities" placeholder="Water on my way…" value={p.query} onChange={e=>{p.onQuery(e.target.value);p.onCategory("all");}}/></label>
 <div className="facility-chips">{(assistance?["information","first-aid","accessible","lost-found","tickets"]:["water","tea","food","pharmacy","washroom","charging"] as string[]).map(id=><button key={id} type="button" aria-pressed={p.category===id} onClick={()=>{p.onCategory(id as FacilityCategory);p.onQuery("");}}><FacilityIcon category={id as FacilityCategory} size={15}/>{categoryNames[id as FacilityCategory]}</button>)}</div>
 <details className="all-facility-types"><summary>All facility types{p.category!=="all"?" · "+categoryNames[p.category]:""}</summary><label className="category-label" htmlFor="facility-category">FACILITY TYPE</label>
 <select id="facility-category" className="category-select" value={p.category} onChange={e=>{p.onCategory(e.target.value as FacilityCategory|"all");p.onQuery("");}}><option value="all">All facilities</option>{Object.entries(categoryNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></details>
 {assistance&&<div className="assistance-note"><strong>Fictional station assistance</strong><p>This demo cannot provide live emergency services.</p><button type="button" className="text-button" onClick={()=>{p.onQuery("nearest help desk");p.onCategory("all");}}>Find nearest help point<ArrowRight size={15}/></button></div>}
 <div className="discovery-context"><span>{clockLabel(snapshot.now)} · Simulated time</span><button type="button" onClick={refresh}>Refresh near me</button></div>
 <p className="search-explanation">{found.message} Position sampled for this search.</p>
 {!results.length&&<div className="discovery-empty"><MapPin size={28}/><h3>{query||p.category!=="all"?"Try another category or location":"What would help your journey?"}</h3><p>Try “water on my way”, “coffee near Platform 12”, “accessible toilet” or a category above.</p></div>}
 <p className="facility-count">{results.length?results.length+" matching facilities · Best matches first":""}</p>
 <div className="facility-list">{results.slice(0,12).map(r=><button type="button" className="facility-card discovery-result" key={r.facility.id} onClick={()=>p.onInspect(r.facility,r)}><span className="facility-icon"><FacilityIcon category={r.facility.category} size={19}/></span><span><strong>{r.facility.name}</strong><small>{floorLabel(r.facility.floor)} · {r.reachable?mins(r.walkingSeconds)+" walk":"No safe route"}</small><small className={!r.open?"facility-closed":""}>{r.open?"Open in demo":"Unavailable / closed in demo"}{r.reachable?" · +"+Math.round(r.detourMeters)+" m detour":""}</small>{r.reachable&&r.open&&p.departure!==undefined&&<small className={r.timing.status==="not-recommended"?"facility-closed":"result-timing"}>{r.timing.message} · includes visit</small>}<span className="result-badges">{r.open&&r.reachable?r.badges.slice(0,2).map(b=><i key={b}>{b}</i>):null}</span></span><ArrowRight size={16}/></button>)}</div>
 {results.length>12&&<p className="search-explanation">Showing the best 12 of {results.length}. Refine by category or station location.</p>}
 </div>;
}
interface DetailProps{facility:Facility;match?:FacilityMatch;now:number;availability:Record<string,boolean>;trainActive:boolean;pending:boolean;visited?:boolean;onClose:()=>void;onAdd:(accessible?:boolean)=>void;onMain:()=>void}
export function FacilityDetails({facility:f,match:r,now,availability,trainActive,pending,visited,onClose,onAdd,onMain}:DetailProps){
 const open=availability[f.id]===false?false:r?.open??facilityAvailable(f,now,availability),reachable=r?.reachable??false;
 return <div className="facility-detail companion-detail" role="region" aria-label="Selected facility">
 <button type="button" className="detail-close icon-button" aria-label="Close facility details" onClick={onClose}><X size={18}/></button>
 <div className="detail-title"><span className="facility-icon"><FacilityIcon category={f.category} size={22}/></span><div><small>{categoryNames[f.category]} · {floorLabel(f.floor)}</small><h3>{f.name}</h3></div></div>
 <div className="detail-estimates"><span><strong>{r?mins(r.walkingSeconds):"Select a route"}</strong><small>walk · search position</small></span><span><strong>{r&&r.reachable?"+"+Math.round(r.detourMeters)+" m":"No estimate"}</strong><small>walking detour</small></span><span><strong>{mins(f.details?.visitSeconds??120)}</strong><small>estimated visit</small></span></div>
 <p className={open?"detail-open":"facility-closed"}>{open?"Open in fictional demo":"Closed or unavailable in fictional demo"} · {f.accessible?"Accessible anchor":"Restricted access"}</p>
 {r?.timing.departureIn!==null&&r?.timing.departureIn!==undefined&&<p className={r.timing.status==="not-recommended"?"facility-closed":"detail-timing"}>{r.timing.message}{r.timing.marginSeconds!==null?" · "+Math.floor(r.timing.marginSeconds/60)+" min margin after buffer":""}. Includes this visit and your final platform.</p>}
 <p>Near {f.details?.nearbyLandmark??"station signage"}</p>
 {f.details?.priceRange&&<small className="demo-price">{f.details.priceRange}</small>}
 <div className="detail-actions"><button type="button" className="button button-primary" disabled={!open||!reachable||pending||visited} onClick={()=>onAdd(r?.preference==="wheelchair")}>{visited?"Already visited on this journey":pending?"Already in your journey":trainActive?"Add stop · keep platform last":"Add to journey"}<Plus size={17}/></button>
 {["information","accessible","first-aid","lost-found","security","tickets"].includes(f.category)&&<button type="button" className="text-button" disabled={!open||!reachable||pending||visited} onClick={()=>onAdd(true)}><Accessibility size={15}/>Show accessible route · add assistance stop</button>}
 {!trainActive&&<button type="button" className="text-button" disabled={!open||!reachable} onClick={onMain}>Route here<ArrowRight size={15}/></button>}</div>
 <small className="detail-disclaimer">Fictional listing and hours. No verified live availability.</small>
 </div>;
}
interface JourneyProps{
 route:GeneratedRoute|null;direct:GeneratedRoute|null;stops:JourneyStop[];visited:string[];currentStop?:RouteVisit;finalName:string;
 now:number;departure?:string;buffer:number;onBuffer:(value:number)=>void;onClock:(seconds:number)=>void;onDeparture?:(value:string)=>void;
 onRemove:(id:string)=>void;onMove:(id:string,delta:number)=>void;onClear:()=>void;onOptimize:()=>void;onDwell:(id:string,value:number)=>void;
 availability:Record<string,boolean>;station:Station;onAvailability:(id:string,available:boolean)=>void;
}
export function JourneyPlanning(p:JourneyProps){
 const timing=assessTiming(p.now,p.departure?serviceTime(p.departure):undefined,p.route,p.buffer);
 const pending=p.stops.filter(s=>!p.visited.includes(s.id));
 return <section className="journey-planning" aria-label="Journey with optional stops">
 <div className="journey-planning-title"><div className="eyebrow">YOUR COMPLETE JOURNEY</div><h3>Useful stops. Platform last.</h3></div>
 <ol className="itinerary-list">{pending.map((s,i)=><li key={s.id}><span className="waypoint-index">{i+1}</span><div><strong>{s.name}</strong><small>{s.available===false?"Unavailable · remove or replace":"Optional visit"}</small><label>Visit minutes<input aria-label={"Visit minutes for "+s.name} type="number" min="0" max="30" value={s.dwellSeconds/60} onChange={e=>p.onDwell(s.id,Number(e.target.value)*60)}/></label></div><div className="stop-actions"><button type="button" aria-label={"Move "+s.name+" earlier"} disabled={i===0} onClick={()=>p.onMove(s.id,-1)}><ArrowUp size={14}/></button><button type="button" aria-label={"Move "+s.name+" later"} disabled={i===pending.length-1} onClick={()=>p.onMove(s.id,1)}><ArrowDown size={14}/></button><button type="button" aria-label={"Remove "+s.name} onClick={()=>p.onRemove(s.id)}><X size={15}/></button></div></li>)}
 <li className="final-destination"><span className="waypoint-index">P</span><div><strong>{p.finalName}</strong><small>Final destination · preserved when adding stops</small></div></li></ol>
 {p.currentStop&&<p className="visit-state">At {p.currentStop.name}. Continue after your visit using the navigation controls. Continuing counts {mins(p.currentStop.dwellSeconds)} of fictional dwell time.</p>}
 {p.visited.length>0&&<p className="visited-note">{p.visited.length} visited stop{p.visited.length>1?"s":""} removed from the pending itinerary.</p>}
 <div className="journey-actions"><button type="button" disabled={pending.length<2} onClick={p.onOptimize}><Sparkles size={15}/>Optimize order</button><button type="button" disabled={!pending.length} onClick={p.onClear}>Clear optional stops</button></div>
 <div className="journey-comparison"><span>Direct walk<strong>{p.direct?.status==="available"?mins(p.direct.durationSeconds):"Unavailable"}</strong></span><span>Journey walk<strong>{p.route?.status==="available"?mins(p.route.durationSeconds):"Unavailable"}</strong></span><span>Visits<strong>{mins(p.route?.dwellSeconds??0)}</strong></span></div>
 <p className="search-explanation">{p.route?.status==="available"?"+"+Math.round(p.route.detourMeters??0)+" m / "+mins(p.route.detourSeconds??0)+" additional walking.":"Remove an unreachable or unavailable stop to restore a valid route."}</p>
 <div className={"timing-panel timing-"+timing.status}><div><Clock3 size={17}/><strong>{timing.message}</strong></div><p>Fictional clock {clockLabel(p.now)}{p.departure?" · Departure "+p.departure:""}</p>{timing.departureIn!==null&&<p>{timing.departureIn>=0?"Departure in "+mins(timing.departureIn):"Departure has passed in the simulation"}</p>}{timing.arrivalSeconds!==null&&<p>Estimated platform arrival {clockLabel(timing.arrivalSeconds)}</p>}{timing.marginSeconds!==null&&<p>{Math.floor(timing.marginSeconds/60)} min margin after your {p.buffer/60} min buffer.</p>}<label>Arrival buffer<select aria-label="Arrival buffer" value={p.buffer} onChange={e=>p.onBuffer(Number(e.target.value))}>{[120,300,600].map(v=><option key={v} value={v}>{v/60} minutes</option>)}</select></label><small>Estimates do not guarantee boarding.</small>{timing.status==="not-recommended"&&pending.length>0&&<button type="button" className="text-button" onClick={p.onClear}>Use direct platform route<ArrowRight size={14}/></button>}</div>
 <details className="companion-demo"><summary>Simulation Controls — Fictional Data</summary><div>
 <label>Demo clock<input aria-label="Demo clock" type="time" value={clockLabel(p.now).slice(-5)} onChange={e=>{if(e.target.value)p.onClock(Math.floor(p.now/86400)*86400+serviceTime(e.target.value));}}/></label>
 <div className="clock-adjustments">{[-300,300,900].map(v=><button type="button" key={v} onClick={()=>p.onClock(Math.max(0,p.now+v))}>{v>0?"+":""}{v/60} min</button>)}</div>
 {p.onDeparture&&<label>Demo departure<input aria-label="Demo departure" type="time" value={p.departure} onChange={e=>{if(e.target.value)p.onDeparture?.(e.target.value);}}/></label>}
 <label>Facility availability<select aria-label="Facility availability" defaultValue="" onChange={e=>{if(e.target.value){const id=e.target.value,f=p.station.facilities.find(f=>f.id===id)!;p.onAvailability(id,!(p.availability[id]??(f.details?.availability!=="unavailable")));e.target.value="";}}}><option value="">Toggle a fictional facility</option>{p.station.facilities.map(f=><option key={f.id} value={f.id}>{f.name} · {(p.availability[f.id]??(f.details?.availability!=="unavailable"))?"available":"unavailable"}</option>)}</select></label>
 <p>Platform, bridge and lift controls remain above the map and in Demo controls.</p>
 </div></details>
 </section>;
}
export {assessTiming};
