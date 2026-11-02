import type {Point,Rect,Station} from "../navigation/types";
import {findRoute,validateGraph} from "../navigation/engine";

/** Exact line/rectangle clipping; coverage is checked as a union of parameter intervals. */
export function segmentInterval(a:Point,b:Point,r:Rect):[number,number]|null{
 let lo=0,hi=1;
 for(const key of ["x","y"] as const){
  const delta=b[key]-a[key],min=r[key],max=min+(key==="x"?r.width:r.height);
  if(Math.abs(delta)<1e-9){if(a[key]<min-1e-7||a[key]>max+1e-7)return null;continue;}
  const t0=(min-a[key])/delta,t1=(max-a[key])/delta;
  lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi+1e-9)return null;
 }
 return[lo,hi];
}
export function validateStation(station:Station,platformIds:readonly string[]=[]):string[]{
 const errors=validateGraph(station),geometry=station.geometry;
 if(!geometry)return[...errors,"Missing physical geometry"];
 const nodeMap=new Map(station.nodes.map(n=>[n.id,n]));
 const ids=new Set<string>();
 for(const region of geometry.regions){if(ids.has(region.id))errors.push("Duplicate region "+region.id);ids.add(region.id);}
 for(const edge of station.edges){
  const a=nodeMap.get(edge.from),b=nodeMap.get(edge.to);if(!a||!b||edge.kind!=="walk")continue;
  const regions=geometry.regions.filter(r=>r.floor===a.floor);
  for(const r of regions.filter(r=>r.kind==="track"||r.kind==="restricted")){
   const interval=segmentInterval(a,b,r);if(interval&&interval[1]-interval[0]>1e-8)errors.push("Restricted crossing "+edge.id);
  }
  const intervals=regions.filter(r=>r.kind!=="track"&&r.kind!=="restricted").flatMap(r=>{const v=segmentInterval(a,b,r);return v?[v]:[];}).sort((x,y)=>x[0]-y[0]);
  let covered=0;for(const [lo,hi] of intervals){if(lo>covered+1e-7)break;covered=Math.max(covered,hi);}
  if(covered<1-1e-7)errors.push("Walking segment outside geometry "+edge.id);
 }
 for(const p of station.platforms){
  if(!geometry.regions.some(r=>r.id===p.id&&r.kind==="platform"))errors.push("Missing platform geometry "+p.id);
  for(const preference of ["fastest","wheelchair"] as const){
   if(!station.entrances.some(g=>findRoute(station,g.nodeId,p.nodeId,{preference}).status==="available"))errors.push("Unreachable "+preference+" platform "+p.id);
  }
 }
 const facilityIds=new Set<string>();
 for(const f of station.facilities){
  if(facilityIds.has(f.id))errors.push("Duplicate facility "+f.id);facilityIds.add(f.id);
  const n=nodeMap.get(f.nodeId);if(!n||n.floor!==f.floor||n.x!==f.x||n.y!==f.y||!station.edges.some(e=>e.from===n.id||e.to===n.id))errors.push("Invalid facility anchor "+f.id);
 }
 for(const l of geometry.landmarks)if(!nodeMap.has(l.nodeId))errors.push("Missing landmark anchor "+l.id);
 for(const id of platformIds)if(!station.platforms.some(p=>p.id===id))errors.push("Unknown ticket platform "+id);
 return errors;
}
