"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type PointerEvent as PointerInput} from "react";
import {Expand,Layers3,LocateFixed,Minus,Plus,Route as RouteIcon} from "lucide-react";
import type {Facility,FacilityCategory,FloorId,GeneratedRoute,Point,Station} from "@/lib/navigation/types";
import type {SimPosition} from "@/lib/navigation/simulator";
import {constrainCamera,fitPoints,mapPalette,placeLabels,type Camera,type MapLabel} from "@/lib/station/cartography";
import {FacilityIcon} from "./facility-icon";
interface Props {
 station:Station;floor:FloorId;route?:GeneratedRoute|null;preview?:boolean;
 showFacilities?:boolean;facilityCategory?:FacilityCategory|"all";selectedFacilityId?:string;
 onFacilitySelect?:(facility:Facility)=>void;passenger?:SimPosition;passengerStatus?:string;
 destinationId?:string;onPassengerFloor?:(floor:FloorId)=>void;
}
const defaults={architecture:true,tracks:true,platforms:true,passages:true,connectors:true,facilities:true,labels:true,route:true,passenger:true,endpoints:true};
const layerNames:Record<keyof typeof defaults,string>={architecture:"Station architecture",tracks:"Tracks (restricted)",platforms:"Platforms",passages:"Bridges & passages",connectors:"Stairs, escalators & lifts",facilities:"Facility markers",labels:"Map labels",route:"Active route",passenger:"Passenger marker",endpoints:"Start & destination"};
export function StationMap({station,floor,route,preview=false,showFacilities=false,facilityCategory="all",selectedFacilityId,onFacilitySelect,passenger,passengerStatus,destinationId,onPassengerFloor}:Props){
 const [view,setView]=useState<Camera>({x:0,y:0,width:station.width,height:station.height});
 const [viewport,setViewport]=useState<Point>({x:1000,y:650});
 const [layers,setLayers]=useState(defaults),[follow,setFollow]=useState(true);
 const svg=useRef<SVGSVGElement>(null),pointers=useRef(new Map<number,Point>()),frame=useRef(0);
 const positionRef=useRef(passenger),routeRef=useRef(route);
 const hasPassenger=!!passenger;
 const zoom=station.width/view.width,scale=Math.min(viewport.x/view.width,viewport.y/view.height);
 const nodes=useMemo(()=>new Map(station.nodes.map(n=>[n.id,n])),[station]);
 const destination=nodes.get(destinationId??"")??route?.nodes.at(-1),start=route?.nodes[0];
 useEffect(()=>{positionRef.current=passenger;},[passenger]);
 useEffect(()=>{routeRef.current=route;},[route]);
 useEffect(()=>{
  if(!svg.current)return;
  const observer=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(r)setViewport({x:r.width,y:r.height});});
  observer.observe(svg.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const moveCamera=useCallback((target:Camera)=>{
  cancelAnimationFrame(frame.current);
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setView(target);return;}
  setView(current=>{
   const started=performance.now();
   const animate=(now:number)=>{
    const t=Math.min(1,(now-started)/320),e=1-(1-t)**3;
    setView({x:current.x+(target.x-current.x)*e,y:current.y+(target.y-current.y)*e,width:current.width+(target.width-current.width)*e,height:current.height+(target.height-current.height)*e});
    if(t<1)frame.current=requestAnimationFrame(animate);
   };frame.current=requestAnimationFrame(animate);return current;
  });
 },[]);
 useEffect(()=>{
  if(!hasPassenger)return;
  const task=requestAnimationFrame(()=>{
   setFollow(true);
   moveCamera(fitPoints(routeRef.current?.nodes??[],station.width,station.height,100));
  });
  return()=>cancelAnimationFrame(task);
 },[hasPassenger,moveCamera,station.width,station.height]);
 useEffect(()=>{
  if(!hasPassenger||!follow||passengerStatus!=="running")return;
  const timer=setInterval(()=>{
   const p=positionRef.current;if(!p)return;
   setView(v=>{
    if(p.x>v.x+v.width*.25&&p.x<v.x+v.width*.75&&p.y>v.y+v.height*.25&&p.y<v.y+v.height*.75)return v;
    return constrainCamera({...v,x:v.x+(p.x-v.width/2-v.x)*.5,y:v.y+(p.y-v.height/2-v.y)*.5},station.width,station.height);
   });
  },100);
  return()=>clearInterval(timer);
 },[hasPassenger,follow,passengerStatus,station.width,station.height]);
 const zoomAt=useCallback((factor:number,client?:Point)=>{
  cancelAnimationFrame(frame.current);setFollow(false);
  const matrix=svg.current?.getScreenCTM();
  const world=client&&matrix?new DOMPoint(client.x,client.y).matrixTransform(matrix.inverse()):undefined;
  setView(v=>{
   const width=Math.min(station.width,Math.max(station.width/5,v.width/factor)),ratio=width/v.width;
   const anchor=world??{x:v.x+v.width/2,y:v.y+v.height/2};
   return constrainCamera({x:anchor.x-(anchor.x-v.x)*ratio,y:anchor.y-(anchor.y-v.y)*ratio,width,height:width*station.height/station.width},station.width,station.height);
  });
 },[station.width,station.height]);
 useEffect(()=>{
  const element=svg.current;if(!element||preview)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();zoomAt(event.deltaY<0?1.12:1/1.12,{x:event.clientX,y:event.clientY});};
  element.addEventListener("wheel",wheel,{passive:false});return()=>element.removeEventListener("wheel",wheel);
 },[preview,zoomAt]);
 useEffect(()=>{
  const element=svg.current;if(!element||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const animations=[element.animate([{opacity:.55},{opacity:1}],{duration:180})];
  element.querySelectorAll<SVGGeometryElement>('[data-testid="route-segment"] line:last-child').forEach(line=>{
   const length=line.getTotalLength();animations.push(line.animate([{strokeDasharray:String(length),strokeDashoffset:length},{strokeDasharray:String(length),strokeDashoffset:0}],{duration:450,easing:"ease-out"}));
  });
  return()=>animations.forEach(a=>a.cancel());
 },[floor,route]);
 function down(e:PointerInput<SVGSVGElement>){
  if(preview||(e.target as Element).closest("[data-map-item]"))return;
  cancelAnimationFrame(frame.current);setFollow(false);
  pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);
 }
 function drag(e:PointerInput<SVGSVGElement>){
  const previous=pointers.current.get(e.pointerId);if(!previous)return;
  const before=[...pointers.current.values()];pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=[...pointers.current.values()];
  if(before.length===2&&after.length===2){
   const distance=(p:Point[])=>Math.hypot(p[0]!.x-p[1]!.x,p[0]!.y-p[1]!.y);
   if(distance(before)>2)zoomAt(distance(after)/distance(before),{x:(after[0]!.x+after[1]!.x)/2,y:(after[0]!.y+after[1]!.y)/2});
  }else{
   const rect=e.currentTarget.getBoundingClientRect();
   setView(v=>{const k=Math.min(rect.width/v.width,rect.height/v.height);return constrainCamera({...v,x:v.x-(e.clientX-previous.x)/k,y:v.y-(e.clientY-previous.y)/k},station.width,station.height);});
  }
 }
 const release=(e:PointerInput<SVGSVGElement>)=>pointers.current.delete(e.pointerId);
 const geometry=station.geometry;
 const architecture=useMemo(()=>(
  <g data-layer="architecture">
   {layers.architecture&&<rect {...(geometry?.boundary??{x:40,y:140,width:station.width-80,height:station.height-180})} rx="28" fill="#E9EEF5" stroke="#CFD9E6" strokeWidth="2"/>}
   {layers.tracks&&geometry?.regions.filter(r=>r.kind==="track").map(r=><g key={r.id} opacity={floor===0?1:.28}><rect x={r.x} y={r.y} width={r.width} height={r.height} fill={mapPalette.track}/>{zoom>2&&<path d={`M${r.x+4} ${r.y}v${r.height}M${r.x+8} ${r.y}v${r.height}`} stroke="#A7B5C6" strokeWidth="1"/>}</g>)}
   {layers.platforms&&station.platforms.map(p=><g key={p.id} opacity={floor===0?1:.42}><rect {...p.bounds} rx="6" fill={destination?.platformId===p.id?"#D9E8FF":"#FFF"} stroke={destination?.platformId===p.id?"#2563EB":"#C4D1DF"} strokeWidth={destination?.platformId===p.id?3:1.5}/>{floor===0&&zoom>1.5&&<path d={`M${p.bounds.x+4} ${p.bounds.y+8}v${p.bounds.height-16}M${p.bounds.x+p.bounds.width-4} ${p.bounds.y+8}v${p.bounds.height-16}`} stroke="#B6A572" strokeWidth="1" strokeDasharray="3 5"/>}</g>)}
   {layers.passages&&station.corridors.filter(r=>r.floor===floor).map((r,i)=><rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} rx="8" fill={floor===0?"#FCFDFF":floor===-2?"#E6F4F1":"#DBE8F7"} stroke="#B5C8DE" strokeWidth="2"/>)}
  </g>
 ),[geometry,station,zoom,floor,layers.architecture,layers.tracks,layers.platforms,layers.passages,destination?.platformId]);
 const landings=useMemo(()=>{
  const map=new Map<string,Set<string>>();
  for(const e of station.edges.filter(e=>e.kind!=="walk"))for(const id of [e.from,e.to]){
   const n=nodes.get(id)!;if(n.floor!==floor)continue;
   const kinds=map.get(id)??new Set();kinds.add(e.kind);map.set(id,kinds);
  }
  return [...map].filter(([id])=>zoom>1.45||!nodes.get(id)!.id.startsWith("p"));
 },[station,nodes,floor,zoom]);
 const candidates:MapLabel[]=useMemo(()=>[
  ...station.platforms.map(p=>({id:p.id,text:String(p.number),x:p.bounds.x+p.bounds.width/2,y:p.bounds.y+45,priority:destination?.platformId===p.id?990:600,kind:"platform" as const})),
  ...station.entrances.flatMap(e=>{const n=nodes.get(e.nodeId)!;return floor===0?[{id:e.id,text:e.name,x:n.x,y:n.y-30,priority:850,kind:"gate" as const}]:[];}),
  ...station.corridors.filter(r=>r.floor===floor&&r.width>200).map((r,i)=>({id:"region-"+i,text:r.name,x:r.x+r.width/2,y:r.y-35,priority:800,kind:"region" as const})),
  ...(zoom>2.1?(geometry?.landmarks??[]).filter(l=>l.floor===floor).map(l=>({...l,text:l.name,kind:"landmark" as const})):[]),
  ...(floor===0&&zoom<1.6?(geometry?.platformGroups??[]).map((g,i)=>({id:"zone-"+i,text:g.name,x:(station.platforms[g.first-1]!.bounds.x+station.platforms[g.last-1]!.bounds.x)/2,y:155,priority:900,kind:"region" as const})):[]),
 ],[station,nodes,floor,geometry,zoom,destination?.platformId]);
 const labels=useMemo(()=>placeLabels(candidates,view,viewport,12),[candidates,view,viewport]);
 const facilities=useMemo(()=>{
  const all=station.facilities.filter(f=>f.floor===floor&&(facilityCategory==="all"||f.category===facilityCategory)&&
   (f.id===selectedFacilityId||showFacilities||zoom>2.7||(zoom>1.7&&["information","accessible","security"].includes(f.category))));
  const selected=placeLabels(all.map(f=>({id:f.id,text:"●",x:f.x,y:f.y,priority:f.id===selectedFacilityId?2000:f.category==="information"?500:100,kind:"facility"})),view,viewport,16);
  return selected.map(l=>all.find(f=>f.id===l.id)!);
 },[station,floor,facilityCategory,selectedFacilityId,showFacilities,zoom,view,viewport]);
 const segments=useMemo(()=>route?.status==="available"?route.edges.flatMap((edge,i)=>{
  const a=route.nodes[i]!,b=route.nodes[i+1]!;return a.floor===floor&&b.floor===floor?[{edge,a,b}]:[];
 }):[],[route,floor]);
 const transitions=route?.floorChanges.filter(c=>c.fromFloor===floor||c.toFloor===floor)??[];
 const font=12/scale;
 return <div className={`station-map ${preview?"map-preview":""}`}>
 <svg ref={svg} className="map-svg cartographic-map" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" aria-label={`Interactive station map, Level ${floor}, ${Math.round(zoom*100)} percent zoom`} tabIndex={preview?-1:0}
 onPointerDown={down} onPointerMove={drag} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
 onKeyDown={e=>{if(e.target!==e.currentTarget||preview)return;if(["+","=","-"].includes(e.key)){e.preventDefault();zoomAt(e.key==="-"?1/1.25:1.25);}
 const d:Record<string,Point>={ArrowLeft:{x:-40,y:0},ArrowRight:{x:40,y:0},ArrowUp:{x:0,y:-40},ArrowDown:{x:0,y:40}};if(d[e.key]){e.preventDefault();setFollow(false);const p=d[e.key]!;setView(v=>constrainCamera({...v,x:v.x+p.x,y:v.y+p.y},station.width,station.height));}}}>
 <rect x="-1000" y="-1000" width={station.width+2000} height={station.height+2000} fill={mapPalette.canvas}/>
 {architecture}
 {layers.connectors&&<g data-layer="vertical-connectors">{landings.map(([id,kinds])=>{const p=nodes.get(id)!;return <g key={id} transform={`translate(${p.x} ${p.y})`}><title>{`${p.name}: ${[...kinds].join(", ")}`}</title><rect x="-16" y="-11" width="32" height="22" rx="5" fill="#F6F9FD" stroke="#97AFCA"/><text y="3" textAnchor="middle" className="vertical-bay-label">{[kinds.has("stairs")?"S":"",kinds.has("escalator")?"E":"",kinds.has("lift")?"L":""].filter(Boolean).join("·")}</text></g>;})}</g>}
 {layers.labels&&<g data-layer="labels" pointerEvents="none">{labels.map(l=><g key={l.id} data-testid="map-label" data-priority={l.priority} transform={`translate(${l.x} ${l.y})`}>
 {l.kind==="platform"&&<rect x={-Math.max(22,l.text.length*9)/scale/2} y={-11/scale} width={Math.max(22,l.text.length*9)/scale} height={22/scale} rx={5/scale} fill={destination?.platformId===l.id?"#2563EB":"#10213B"}/>}
 <text textAnchor="middle" dominantBaseline="central" style={{fontSize:font,fontWeight:l.kind==="platform"?750:600,fill:l.kind==="platform"?"white":l.kind==="region"?"#486380":"#405B77"}}>{l.text}</text></g>)}</g>}
 {layers.route&&<g data-layer="active-route">{segments.map(({edge,a,b})=><g key={edge.id} data-testid="route-segment" data-edge-id={edge.id} pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="white" strokeWidth="12" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563EB" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></g>)}
 {transitions.map(c=>{const p=nodes.get(c.fromFloor===floor?c.fromNodeId:c.toNodeId)??route?.nodes.find(n=>n.id===c.fromNodeId);if(!p)return null;return <g key={c.edgeId} data-testid="floor-transition" transform={`translate(${p.x} ${p.y})`} pointerEvents="none"><circle r={12/scale} fill="white" stroke="#2563EB" strokeWidth="2" vectorEffect="non-scaling-stroke"/><text textAnchor="middle" y={4/scale} style={{fontSize:11/scale,fontWeight:750,fill:"#1F5BCB"}}>{c.kind==="lift"?"L":c.kind==="stairs"?"S":"E"}</text></g>;})}</g>}
 {layers.facilities&&<g data-layer="facilities">{facilities.map(f=><g key={f.id} data-map-item role="button" tabIndex={preview?-1:0} aria-label={f.name} className="facility-pin" transform={`translate(${f.x} ${f.y})`} onClick={()=>onFacilitySelect?.(f)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onFacilitySelect?.(f);}}}>
 <title>{f.name}</title><circle r={12/scale} fill={f.id===selectedFacilityId?"#10213B":"#FFF"} stroke="#8AA8C8" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><FacilityIcon category={f.category} x={-7/scale} y={-7/scale} width={14/scale} height={14/scale} color={f.id===selectedFacilityId?"white":"#3F658E"}/></g>)}</g>}
 {layers.endpoints&&[{p:start,letter:"A",color:"#10213B",test:"start-marker"},{p:destination,letter:destination?.platformId?destination.platformId.split("-")[1]!:"B",color:"#2563EB",test:"destination-marker"}].map(({p,letter,color,test})=>p?.floor===floor?<g key={test} data-testid={test} transform={`translate(${p.x} ${p.y})`} pointerEvents="none"><circle r={15/scale} fill="white"/><circle r={12/scale} fill={color}/><text textAnchor="middle" y={4/scale} style={{fill:"white",fontSize:11/scale,fontWeight:800}}>{letter}</text></g>:null)}
 {layers.passenger&&passenger?.floor===floor&&<g data-testid="passenger-marker" data-x={passenger.x} data-y={passenger.y} data-floor={passenger.floor} className="passenger-position" transform={`translate(${passenger.x} ${passenger.y})`} pointerEvents="none">
 <title>Simulated passenger position. Not live positioning.</title><circle r={21/scale} fill="#2563EB" opacity=".13"/><circle r={13/scale} fill="white" stroke="#10213B" strokeWidth="2" vectorEffect="non-scaling-stroke"/><path d={`M0 ${-10/scale}L${7/scale} ${8/scale}L0 ${4/scale}L${-7/scale} ${8/scale}Z`} transform={`rotate(${passenger.heading})`} fill={passengerStatus==="arrived"?"#19BFA9":"#10213B"}/></g>}
 </svg>
 {!preview&&<>
 <details className="map-layer-control"><summary aria-label="Map layers"><Layers3 size={17}/><span>Layers</span></summary><fieldset><legend>Map layers</legend>{(Object.keys(defaults) as (keyof typeof defaults)[]).map(key=><label key={key}><input type="checkbox" checked={layers[key]} onChange={e=>setLayers(current=>({...current,[key]:e.target.checked}))}/>{layerNames[key]}</label>)}</fieldset></details>
 <div className="map-tools" aria-label="Map controls"><button className="icon-button" aria-label="Zoom in" disabled={zoom>=4.99} onClick={()=>zoomAt(1.3)}><Plus size={19}/></button><span className="zoom-label">{Math.round(zoom*100)}%</span><button className="icon-button" aria-label="Zoom out" disabled={zoom<=1} onClick={()=>zoomAt(1/1.3)}><Minus size={19}/></button>
 <button className="icon-button" aria-label="Reset map view" onClick={()=>{setFollow(false);moveCamera({x:0,y:0,width:station.width,height:station.height});}}><Expand size={18}/></button>
 <button className="icon-button" aria-label="Fit to route" disabled={!route?.nodes.length} onClick={()=>{setFollow(false);moveCamera(fitPoints(route?.nodes??[],station.width,station.height));}}><RouteIcon size={18}/></button>
 {passenger&&<button className={`icon-button ${follow?"following":""}`} aria-label="Center on passenger" aria-pressed={follow} onClick={()=>{setFollow(true);onPassengerFloor?.(passenger.floor);const width=station.width/2.8;moveCamera(constrainCamera({x:passenger.x-width/2,y:passenger.y-width*station.height/station.width/2,width,height:width*station.height/station.width},station.width,station.height));}}><LocateFixed size={19}/></button>}
 </div>
 <div className="map-legend"><span><i className="legend-route"/>Route</span><span>S Stairs · E Escalator · L Lift</span></div>
 <div className="map-hint">{hasPassenger?(follow?"Following simulated passenger":"Explore mode · Recenter to follow"):"Drag to pan · Pinch or scroll to zoom"}</div>
 </>}
 </div>;
}

