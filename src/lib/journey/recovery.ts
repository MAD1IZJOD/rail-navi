import {demoStation as station} from "../station/demo-station";
import {STATION_VERSION} from "../station/version";
import {checkpointById} from "../positioning/checkpoints";
import {demoTrains} from "../tickets/demo";
import type {Language} from "../i18n/messages";
import type {RoutePreference} from "../navigation/types";
export const JOURNEY_KEY="railnavi-journey-v1";
export interface SavedJourney {
 schema:1;stationId:string;stationVersion:string;language:Language;origin:string;confirmedSource:"manual"|"qr";
 destination:string;trainId:string;preference:RoutePreference;stops:{id:string;dwellSeconds:number}[];
 nowSeconds:number;buffer:number;bridgeClosed:boolean;liftsClosed:boolean;crossingOutage:string;
 availability:Record<string,boolean>;trainChanges:Record<string,{platformId:string;departure:string}>;wasSimulating:boolean;offlineVersion?:string;
}
export type RecoveryResult={status:"empty"}|{status:"invalid"|"incompatible"}|{status:"valid";journey:SavedJourney};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const number=(v:unknown,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
export function validOrigin(origin:string){
 return origin.startsWith("checkpoint:")?!!checkpointById(origin.slice(11)):station.anchors.some(a=>a.id===origin);
}
export function parseJourney(raw:unknown):RecoveryResult{
 if(raw===null||raw===undefined||raw==="")return{status:"empty"};
 if(typeof raw!=="string"||raw.length>20000)return{status:"invalid"};
 try{
  const v:unknown=JSON.parse(raw);if(!object(v))return{status:"invalid"};
  if(v.schema!==1||v.stationId!==station.id||v.stationVersion!==STATION_VERSION)return{status:"incompatible"};
  if((v.language!=="en"&&v.language!=="hi")||typeof v.origin!=="string"||!validOrigin(v.origin)||!["manual","qr"].includes(v.confirmedSource as string))return{status:"invalid"};
  if(v.confirmedSource==="qr"&&!v.origin.startsWith("checkpoint:"))return{status:"invalid"};
  if(typeof v.destination!=="string"||!station.nodes.some(n=>n.id===v.destination)||typeof v.trainId!=="string"||(v.trainId&&!demoTrains.some(t=>t.id===v.trainId&&t.status!=="cancelled")))return{status:"invalid"};
  if(!["fastest","shortest","wheelchair","avoid-stairs"].includes(v.preference as string)||!number(v.nowSeconds,31*86400)||![120,300,600].includes(v.buffer as number))return{status:"invalid"};
  if(typeof v.bridgeClosed!=="boolean"||typeof v.liftsClosed!=="boolean"||typeof v.wasSimulating!=="boolean"||typeof v.crossingOutage!=="string")return{status:"invalid"};
  if(v.crossingOutage&&!station.geometry?.regions.some(r=>(r.kind==="bridge"||r.kind==="underpass")&&r.name===v.crossingOutage)&&!station.edges.some(e=>e.kind==="lift"&&"lift:"+e.id===v.crossingOutage))return{status:"invalid"};
  if(!Array.isArray(v.stops)||v.stops.length>4)return{status:"invalid"};
  const stops:SavedJourney["stops"]=[];
  for(const s of v.stops){if(!object(s)||typeof s.id!=="string"||!station.facilities.some(f=>f.id===s.id&&f.nodeId!==v.destination)||!number(s.dwellSeconds,1800)||stops.some(x=>x.id===s.id))return{status:"invalid"};stops.push({id:s.id,dwellSeconds:s.dwellSeconds as number});}
  if(!object(v.availability)||Object.keys(v.availability).length>station.facilities.length||!object(v.trainChanges)||Object.keys(v.trainChanges).length>demoTrains.length)return{status:"invalid"};
  const availability:Record<string,boolean>={},trainChanges:SavedJourney["trainChanges"]={};
  for(const [id,available]of Object.entries(v.availability)){if(!station.facilities.some(f=>f.id===id)||typeof available!=="boolean")return{status:"invalid"};availability[id]=available;}
  for(const [id,t]of Object.entries(v.trainChanges)){if(!demoTrains.some(train=>train.id===id)||!object(t)||typeof t.platformId!=="string"||!station.platforms.some(p=>p.id===t.platformId)||typeof t.departure!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.departure))return{status:"invalid"};trainChanges[id]={platformId:t.platformId,departure:t.departure};}
  if(v.trainId){const train=demoTrains.find(t=>t.id===v.trainId)!,platformId=trainChanges[train.id]?.platformId??train.platformId;if(station.platforms.find(p=>p.id===platformId)?.nodeId!==v.destination)return{status:"invalid"};}
  if(v.offlineVersion!==undefined&&(typeof v.offlineVersion!=="string"||!/^[a-zA-Z0-9-]{1,80}$/.test(v.offlineVersion)))return{status:"invalid"};
  return{status:"valid",journey:{schema:1,stationId:station.id,stationVersion:STATION_VERSION,language:v.language,origin:v.origin,confirmedSource:v.confirmedSource as "manual"|"qr",destination:v.destination,trainId:v.trainId,preference:v.preference as RoutePreference,stops,nowSeconds:v.nowSeconds as number,buffer:v.buffer as number,bridgeClosed:v.bridgeClosed,liftsClosed:v.liftsClosed,crossingOutage:v.crossingOutage,availability,trainChanges,wasSimulating:v.wasSimulating,offlineVersion:v.offlineVersion as string|undefined}};
 }catch{return{status:"invalid"};}
}
export function writeJourney(storage:Pick<Storage,"setItem">,journey:SavedJourney):boolean{
 const raw=JSON.stringify(journey);if(parseJourney(raw).status!=="valid")return false;
 try{storage.setItem(JOURNEY_KEY,raw);return true;}catch{return false;}
}
