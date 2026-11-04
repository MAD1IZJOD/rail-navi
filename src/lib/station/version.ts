import type {Station} from "../navigation/types";
import {demoStation} from "./demo-station";
import {checkpoints} from "../positioning/checkpoints";
/** Recomputed from the actual model; coordinate/topology/checkpoint edits invalidate recovery. */
export function fingerprint(value:unknown):string{
 const text=JSON.stringify(value);let hash=2166136261;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return(hash>>>0).toString(16).padStart(8,"0");
}
export function stationVersion(station:Station){
 return"station-5-"+fingerprint({id:station.id,nodes:station.nodes,edges:station.edges,facilities:station.facilities,geometry:station.geometry,checkpoints});
}
export const STATION_VERSION=stationVersion(demoStation);
export const STORAGE_SCHEMA=1;
