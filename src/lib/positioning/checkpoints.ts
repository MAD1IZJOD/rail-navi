import type {FloorId,Station} from "../navigation/types";
import {demoStation} from "../station/demo-station";

export const QR_VERSION=1;
export const MAX_QR_LENGTH=512;
export interface Checkpoint {id:string;stationId:string;nodeId:string;floor:FloorId;label:string;landmark:string;version:1;payload:string}
export type CheckpointFailure="malformed"|"oversized"|"external"|"station"|"version"|"unknown";
export type CheckpointResult={status:"located";checkpoint:Checkpoint}|{status:"invalid";reason:CheckpointFailure};
export function checkpointPayload(stationId:string,id:string){return `railnavi://checkpoint/v1/${stationId}/${id}`;}
/** Fixed existing graph anchors only. No new walking connectivity or coordinates. */
export function buildCheckpoints(station:Station):Checkpoint[]{
 const ids=new Set<string>([
  ...station.entrances.map(e=>e.nodeId),"west-center","east-center",
  ...station.platforms.map(p=>p.nodeId),"metro-west","metro-east","west-u--2","east-u--2",
 ]);
 for(const c of ["a","b","c","d","u","v"]){
  const floor=c==="c"||c==="d"?2:c==="u"||c==="v"?-1:1;
  for(const side of ["west","east"])for(const id of [`${side}-${c}`,`${side}-${c}-${floor}`])if(station.nodes.some(n=>n.id===id))ids.add(id);
 }
 for(const n of [1,10,17,20])for(const c of ["a","b","u","v"]){
  const id=`p${n}-${c}-${c==="u"||c==="v"?-1:1}`;if(station.nodes.some(n=>n.id===id))ids.add(id);
 }
 for(const id of ["p3-c-2","p17-d-2"])if(station.nodes.some(n=>n.id===id))ids.add(id);
 return [...ids].sort().map(nodeId=>{
  const node=station.nodes.find(n=>n.id===nodeId);if(!node)throw new Error("Checkpoint anchor missing");
  const id="RN-"+nodeId.toUpperCase();
  return{id,stationId:station.id,nodeId,floor:node.floor,label:node.name,landmark:node.name,version:1,payload:checkpointPayload(station.id,id)};
 });
}
export const checkpoints=buildCheckpoints(demoStation);
export const checkpointById=(id:string)=>checkpoints.find(c=>c.id===id);
export const checkpointByNode=(id:string)=>checkpoints.find(c=>c.nodeId===id);
export function checkpointUrl(checkpoint:Checkpoint,origin:string){
 const base=new URL(origin);if(!["http:","https:"].includes(base.protocol)||base.username||base.password)throw new Error("Invalid application origin");
 const url=new URL("/demo",base.origin);url.search=new URLSearchParams({v:"1",station:checkpoint.stationId,checkpoint:checkpoint.id}).toString();return url.href;
}
export function resolveCheckpoint(input:unknown,origin:string,allowManualCode=false):CheckpointResult{
 const bad=(reason:CheckpointFailure):CheckpointResult=>({status:"invalid",reason});
 if(typeof input!=="string")return bad("malformed");
 if(input.length>MAX_QR_LENGTH)return bad("oversized");
 const raw=input.trim();if(!raw||/[\u0000-\u001f]/.test(raw))return bad("malformed");
 let id:string,stationId:string,version:string;
 if(allowManualCode&&/^RN-[A-Z0-9-]+$/.test(raw)){id=raw;stationId=demoStation.id;version="1";}
 else {
  let url:URL;try{url=new URL(raw);}catch{return bad("malformed");}
  if(url.username||url.password||url.hash)return bad("malformed");
  if(url.protocol==="railnavi:"){
   if(url.hostname!=="checkpoint"||url.search)return bad("malformed");
   const parts=url.pathname.split("/");if(parts.length!==4||!/^v\d+$/.test(parts[1]!))return bad("malformed");
   version=parts[1]!.slice(1);stationId=parts[2]!;id=parts[3]!;
   if(raw!==checkpointPayload(stationId,id).replace("/v1/","/v"+version+"/"))return bad("malformed");
  }else{
   let own:URL;try{own=new URL(origin);}catch{return bad("external");}
   if(!["http:","https:"].includes(url.protocol)||url.origin!==own.origin)return bad("external");
   if(url.pathname!=="/demo"||[...url.searchParams.keys()].length!==3||[...url.searchParams.keys()].some(k=>!["v","station","checkpoint"].includes(k)))return bad("malformed");
   version=url.searchParams.get("v")??"";stationId=url.searchParams.get("station")??"";id=url.searchParams.get("checkpoint")??"";
  }
 }
 if(version!=="1")return bad("version");
 if(stationId!==demoStation.id)return bad("station");
 const checkpoint=checkpointById(id);
 if(!checkpoint||!demoStation.nodes.some(n=>n.id===checkpoint.nodeId&&n.floor===checkpoint.floor))return bad("unknown");
 return{status:"located",checkpoint};
}
