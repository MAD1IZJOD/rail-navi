"use client";
import {useDeferredValue,useEffect,useMemo,useRef,useState} from "react";
import {Accessibility,ArrowDown,ArrowRight,ArrowUp,Clock3,MapPin,Plus,Search,ShieldCheck,Sparkles,X} from "lucide-react";
import type {Facility,FacilityCategory,GeneratedRoute,JourneyStop,RouteVisit,RoutingOptions,Station} from "@/lib/navigation/types";
import type {PositionContext} from "@/lib/navigation/context";
import {categoryNames,facilityAvailable} from "@/lib/facilities/catalog";
import {discoverFacilities,type FacilityMatch} from "@/lib/facilities/search";
import {assessTiming,clockLabel,serviceTime} from "@/lib/journey/time";

import {FacilityIcon} from "./facility-icon";
import {useLanguage} from "./language-provider";

interface DiscoveryProps{
 station:Station;position:PositionContext;finalId:string;stops:JourneyStop[];options:RoutingOptions;now:number;availability:Record<string,boolean>;
 departure?:number;buffer:number;remainingVisitSeconds?:number;
 query:string;onQuery:(q:string)=>void;category:FacilityCategory|"all";onCategory:(category:FacilityCategory|"all")=>void;
 onInspect:(facility:Facility,match?:FacilityMatch)=>void;onMatches:(ids:string[])=>void;
}
export function FacilityDiscovery(p:DiscoveryProps){
 const {t,name,language,floor:displayFloor,duration:mins}=useLanguage();
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
 <div className="discovery-heading"><div className="eyebrow">{t("YOUR STATION COMPANION")}</div><h2>{t("A useful stop.")}<br/>{" "}{t("A clear way there.")}</h2><p>{t("Find what you need without losing your platform.")}</p></div>
 <div className="discovery-mode"><button type="button" aria-pressed={!assistance} onClick={()=>setAssistance(false)}>{t("Discover")}</button><button type="button" aria-pressed={assistance} onClick={()=>{setAssistance(true);p.onQuery("help desk");p.onCategory("all");}}><ShieldCheck size={15}/>{t("Passenger assistance")}</button></div>
 <label className="facility-search"><Search size={18}/><input aria-label={t("Search facilities")} placeholder={t("Water on my way…")} value={p.query} onChange={e=>{p.onQuery(e.target.value);p.onCategory("all");}}/></label>
 <div className="facility-chips">{(assistance?["information","first-aid","accessible","lost-found","tickets"]:["water","tea","food","pharmacy","washroom","charging"] as string[]).map(id=><button key={id} type="button" aria-pressed={p.category===id} onClick={()=>{p.onCategory(id as FacilityCategory);p.onQuery("");}}><FacilityIcon category={id as FacilityCategory} size={15}/>{t(categoryNames[id as FacilityCategory])}</button>)}</div>
 <details className="all-facility-types"><summary>{t("All facility types")}{p.category!=="all"?" · "+t(categoryNames[p.category]):""}</summary><label className="category-label" htmlFor="facility-category">{t("FACILITY TYPE")}</label>
 <select id="facility-category" className="category-select" value={p.category} onChange={e=>{p.onCategory(e.target.value as FacilityCategory|"all");p.onQuery("");}}><option value="all">{t("All facilities")}</option>{Object.entries(categoryNames).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></details>
 {assistance&&<div className="assistance-note"><strong>{t("Fictional station assistance")}</strong><p>{t("This demo cannot provide live emergency services.")}</p><button type="button" className="text-button" onClick={()=>{p.onQuery("nearest help desk");p.onCategory("all");}}>{t("Find nearest help point")}<ArrowRight size={15}/></button></div>}
 <div className="discovery-context"><span>{clockLabel(snapshot.now)}{t(" · Simulated time")}</span><button type="button" onClick={refresh}>{t("Refresh near me")}</button></div>
 <p className="search-explanation">{t(found.message)}{t(" Position sampled for this search.")}</p>
 {!results.length&&<div className="discovery-empty"><MapPin size={28}/><h3>{query||p.category!=="all"?t("Try another category or location"):t("What would help your journey?")}</h3><p>{t("Try “water on my way”, “coffee near Platform 12”, “accessible toilet” or a category above.")}</p></div>}
 <p className="facility-count">{results.length?results.length+" matching facilities · Best matches first":""}</p>
 <div className="facility-list">{results.slice(0,12).map(r=><button type="button" className="facility-card discovery-result" key={r.facility.id} onClick={()=>p.onInspect(r.facility,r)}><span className="facility-icon"><FacilityIcon category={r.facility.category} size={19}/></span><span><strong>{name(r.facility.name)}</strong><small>{displayFloor(r.facility.floor)} · {r.reachable?mins(r.walkingSeconds)+t(" walk"):t("No safe route")}</small><small className={!r.open?"facility-closed":""}>{r.open?t("Open in demo"):t("Unavailable / closed in demo")}{r.reachable?" · +"+Math.round(r.detourMeters)+t(" m detour"):""}</small>{r.reachable&&r.open&&p.departure!==undefined&&<small className={r.timing.status==="not-recommended"?"facility-closed":"result-timing"}>{t(r.timing.message)}{t(" · includes visit")}</small>}<span className="result-badges">{r.open&&r.reachable?r.badges.slice(0,2).map(b=><i key={b}>{t(b)}</i>):null}</span></span><ArrowRight size={16}/></button>)}</div>
 {results.length>12&&<p className="search-explanation">{t("Showing the best 12 of ")}{results.length}{t(". Refine by category or station location.")}</p>}
 </div>;
}
interface DetailProps{facility:Facility;match?:FacilityMatch;now:number;availability:Record<string,boolean>;trainActive:boolean;pending:boolean;visited?:boolean;onClose:()=>void;onAdd:(accessible?:boolean)=>void;onMain:()=>void}
export function FacilityDetails({facility:f,match:r,now,availability,trainActive,pending,visited,onClose,onAdd,onMain}:DetailProps){
 const {t,name,language,floor:displayFloor,duration:mins}=useLanguage();
 const open=availability[f.id]===false?false:r?.open??facilityAvailable(f,now,availability),reachable=r?.reachable??false;
 return <div className="facility-detail companion-detail" role="region" aria-label={t("Selected facility")}>
 <button type="button" className="detail-close icon-button" aria-label={t("Close facility details")} onClick={onClose}><X size={18}/></button>
 <div className="detail-title"><span className="facility-icon"><FacilityIcon category={f.category} size={22}/></span><div><small>{t(categoryNames[f.category])} · {displayFloor(f.floor)}</small><h3>{name(f.name)}</h3></div></div>
 <div className="detail-estimates"><span><strong>{r?mins(r.walkingSeconds):t("Select a route")}</strong><small>{t("walk · search position")}</small></span><span><strong>{r&&r.reachable?"+"+Math.round(r.detourMeters)+" m":t("No estimate")}</strong><small>{t("walking detour")}</small></span><span><strong>{mins(f.details?.visitSeconds??120)}</strong><small>{t("estimated visit")}</small></span></div>
 <p className={open?"detail-open":"facility-closed"}>{open?t("Open in fictional demo"):t("Closed or unavailable in fictional demo")} · {f.accessible?t("Accessible anchor"):t("Restricted access")}</p>
 {r?.timing.departureIn!==null&&r?.timing.departureIn!==undefined&&<p className={r.timing.status==="not-recommended"?"facility-closed":"detail-timing"}>{t(r.timing.message)}{r.timing.marginSeconds!==null?" · "+Math.floor(r.timing.marginSeconds/60)+" min margin after buffer":""}{t(". Includes this visit and your final platform.")}</p>}
 <p>{t("Near ")}{name(f.details?.nearbyLandmark??t("station signage"))}</p>
 {f.details?.priceRange&&<small className="demo-price">{t(f.details.priceRange)}</small>}
 <div className="detail-actions"><button type="button" className="button button-primary" disabled={!open||!reachable||pending||visited} onClick={()=>onAdd(r?.preference==="wheelchair")}>{visited?t("Already visited on this journey"):pending?t("Already in your journey"):trainActive?t("Add stop · keep platform last"):t("Add to journey")}<Plus size={17}/></button>
 {["information","accessible","first-aid","lost-found","security","tickets"].includes(f.category)&&<button type="button" className="text-button" disabled={!open||!reachable||pending||visited} onClick={()=>onAdd(true)}><Accessibility size={15}/>{t("Show accessible route · add assistance stop")}</button>}
 {!trainActive&&<button type="button" className="text-button" disabled={!open||!reachable} onClick={onMain}>{t("Route here")}<ArrowRight size={15}/></button>}</div>
 <small className="detail-disclaimer">{t("Fictional listing and hours. No verified live availability.")}</small>
 </div>;
}
interface JourneyProps{
 route:GeneratedRoute|null;direct:GeneratedRoute|null;stops:JourneyStop[];visited:string[];currentStop?:RouteVisit;finalName:string;
 now:number;departure?:string;buffer:number;onBuffer:(value:number)=>void;onClock:(seconds:number)=>void;onDeparture?:(value:string)=>void;
 onRemove:(id:string)=>void;onMove:(id:string,delta:number)=>void;onClear:()=>void;onOptimize:()=>void;onDwell:(id:string,value:number)=>void;
 availability:Record<string,boolean>;station:Station;onAvailability:(id:string,available:boolean)=>void;
}
export function JourneyPlanning(p:JourneyProps){
 const {t,name,language,duration:mins}=useLanguage();
 const timing=assessTiming(p.now,p.departure?serviceTime(p.departure):undefined,p.route,p.buffer);
 const pending=p.stops.filter(s=>!p.visited.includes(s.id));
 return <section className="journey-planning" aria-label={t("Journey with optional stops")}>
 <div className="journey-planning-title"><div className="eyebrow">{t("YOUR COMPLETE JOURNEY")}</div><h3>{t("Useful stops. Platform last.")}</h3></div>
 <ol className="itinerary-list">{pending.map((s,i)=><li key={s.id}><span className="waypoint-index">{i+1}</span><div><strong>{name(s.name)}</strong><small>{s.available===false?t("Unavailable · remove or replace"):t("Optional visit")}</small><label>{t("Visit minutes")}<input aria-label={language==="hi"?name(s.name)+" पर ठहरने के मिनट":"Visit minutes for "+s.name} type="number" min="0" max="30" value={s.dwellSeconds/60} onChange={e=>p.onDwell(s.id,Number(e.target.value)*60)}/></label></div><div className="stop-actions"><button type="button" aria-label={language==="hi"?name(s.name)+" को पहले रखें":"Move "+s.name+" earlier"} disabled={i===0} onClick={()=>p.onMove(s.id,-1)}><ArrowUp size={14}/></button><button type="button" aria-label={language==="hi"?name(s.name)+" को बाद में रखें":"Move "+s.name+" later"} disabled={i===pending.length-1} onClick={()=>p.onMove(s.id,1)}><ArrowDown size={14}/></button><button type="button" aria-label={language==="hi"?name(s.name)+" हटाएँ":"Remove "+s.name} onClick={()=>p.onRemove(s.id)}><X size={15}/></button></div></li>)}
 <li className="final-destination"><span className="waypoint-index">{t("P")}</span><div><strong>{name(p.finalName)}</strong><small>{t("Final destination · preserved when adding stops")}</small></div></li></ol>
 {p.currentStop&&<p className="visit-state">{t("At ")}{p.currentStop.name}{t(". Continue after your visit using the navigation controls. Continuing counts ")}{mins(p.currentStop.dwellSeconds)}{t(" of fictional dwell time.")}</p>}
 {p.visited.length>0&&<p className="visited-note">{p.visited.length}{t(" visited stop")}{p.visited.length>1?"s":""}{t(" removed from the pending itinerary.")}</p>}
 <div className="journey-actions"><button type="button" disabled={pending.length<2} onClick={p.onOptimize}><Sparkles size={15}/>{t("Optimize order")}</button><button type="button" disabled={!pending.length} onClick={p.onClear}>{t("Clear optional stops")}</button></div>
 <div className="journey-comparison"><span>{t("Direct walk")}<strong>{p.direct?.status==="available"?mins(p.direct.durationSeconds):"Unavailable"}</strong></span><span>{t("Journey walk")}<strong>{p.route?.status==="available"?mins(p.route.durationSeconds):"Unavailable"}</strong></span><span>{t("Visits")}<strong>{mins(p.route?.dwellSeconds??0)}</strong></span></div>
 <p className="search-explanation">{p.route?.status==="available"?"+"+Math.round(p.route.detourMeters??0)+" m / "+mins(p.route.detourSeconds??0)+" additional walking.":t("Remove an unreachable or unavailable stop to restore a valid route.")}</p>
 <div className={"timing-panel timing-"+timing.status}><div><Clock3 size={17}/><strong>{t(timing.message)}</strong></div><p>{t("Fictional clock ")}{clockLabel(p.now)}{p.departure?" · Departure "+p.departure:""}</p>{timing.departureIn!==null&&<p>{timing.departureIn>=0?(language==="hi"?`प्रस्थान में ${mins(timing.departureIn)} शेष हैं।`:"Departure in "+mins(timing.departureIn)):t("Departure has passed in the simulation")}</p>}{timing.arrivalSeconds!==null&&<p>{t("Estimated platform arrival ")}{clockLabel(timing.arrivalSeconds)}</p>}{timing.marginSeconds!==null&&<p>{language==="hi"?`${p.buffer/60} मिनट पहले पहुँचने के लक्ष्य के बाद ${Math.floor(timing.marginSeconds/60)} मिनट अतिरिक्त समय।`:`${Math.floor(timing.marginSeconds/60)} min margin after your ${p.buffer/60} min buffer.`}</p>}<label>{t("Arrival buffer")}<select aria-label={t("Arrival buffer")} value={p.buffer} onChange={e=>p.onBuffer(Number(e.target.value))}>{[120,300,600].map(v=><option key={v} value={v}>{v/60} {t("minutes")}</option>)}</select></label><small>{t("Estimates do not guarantee boarding.")}</small>{timing.status==="not-recommended"&&pending.length>0&&<button type="button" className="text-button" onClick={p.onClear}>{t("Use direct platform route")}<ArrowRight size={14}/></button>}</div>
 <details className="companion-demo"><summary>{t("Simulation Controls — Fictional Data")}</summary><div>
 <label>{t("Demo clock")}<input aria-label={t("Demo clock")} type="time" value={clockLabel(p.now).slice(-5)} onChange={e=>{if(e.target.value)p.onClock(Math.floor(p.now/86400)*86400+serviceTime(e.target.value));}}/></label>
 <div className="clock-adjustments">{[-300,300,900].map(v=><button type="button" key={v} onClick={()=>p.onClock(Math.max(0,p.now+v))}>{v>0?"+":""}{v/60}{t(" min")}</button>)}</div>
 {p.onDeparture&&<label>{t("Demo departure")}<input aria-label={t("Demo departure")} type="time" value={p.departure} onChange={e=>{if(e.target.value)p.onDeparture?.(e.target.value);}}/></label>}
 <label>{t("Facility availability")}<select aria-label={t("Facility availability")} defaultValue="" onChange={e=>{if(e.target.value){const id=e.target.value,f=p.station.facilities.find(f=>f.id===id)!;p.onAvailability(id,!(p.availability[id]??(f.details?.availability!=="unavailable")));e.target.value="";}}}><option value="">{t("Toggle a fictional facility")}</option>{p.station.facilities.map(f=><option key={f.id} value={f.id}>{name(f.name)} · {(p.availability[f.id]??(f.details?.availability!=="unavailable"))?t("available"):t("unavailable")}</option>)}</select></label>
 <p>{t("Platform, bridge and lift controls remain above the map and in Demo controls.")}</p>
 </div></details>
 </section>;
}
export {assessTiming};
