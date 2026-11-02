import {findRoute} from "../navigation/engine";
import type {GeneratedRoute, NavigationGraph, RoutePreference} from "../navigation/types";
export interface DemoTrain { id:string; number:string; name:string; origin:string; destination:string; departure:string; platformId:string; status:"on-time"|"delayed"|"cancelled" }
export interface DemoTicket { reference:string; trainId:string; passenger:string; coach:string; seat:string; status:"confirmed"|"cancelled" }
const names=["Moonrise Express","Blue Horizon","Aurora Intercity","Coastal Comet","Silver Valley","Monsoon Arrow","Skyline Voyager","Copper Coast","Orchid Express","Northern Lantern","Sunset Link","Riverlight Express","Cloudline Intercity","Amber Trail","Starling Express","Cedar Voyager","Coral Connection","Daybreak Arrow","Indigo Link","Meadow Express"];
export const demoTrains:DemoTrain[]=names.map((name,i)=>({id:`train-${i+1}`,number:`RN${2001+i}`,name,origin:["Aster Junction","Cedar Bay","Orchid City","Silver Reach"][i%4]!,destination:["Moonhaven","Coral Vale","Amber City","Skyhaven"][i%4]!,departure:`${String(16+Math.floor(i/6)).padStart(2,"0")}:${String((i%6)*10).padStart(2,"0")}`,platformId:`platform-${i===0?10:(i%12)+1}`,status:i===19?"cancelled":i===7?"delayed":"on-time"}));
export const demoTickets:DemoTicket[]=Array.from({length:30},(_,i)=>({reference:`RN-DEMO-${1001+i}`,trainId:`train-${i%20+1}`,passenger:`Demo Traveler ${String(i+1).padStart(2,"0")}`,coach:`C${i%8+1}`,seat:`${i%60+1}A`,status:i===29?"cancelled":"confirmed"}));
export const normalizeReference=(value:string)=>value.trim().toUpperCase();
export type LookupResult={status:"found";ticket:DemoTicket;train:DemoTrain}|{status:"invalid"|"missing"|"unavailable";message:string};
export function lookupTicket(reference:string,trains:readonly DemoTrain[]=demoTrains,tickets:readonly DemoTicket[]=demoTickets):LookupResult {
 const key=normalizeReference(reference);
 if(!/^RN-DEMO-\d{4}$/.test(key))return{status:"invalid",message:"Use a synthetic reference such as RN-DEMO-1001. Do not enter a real PNR."};
 const ticket=tickets.find(t=>t.reference===key);
 if(!ticket)return{status:"missing",message:"That demo booking was not found. Try RN-DEMO-1001."};
 const train=trains.find(t=>t.id===ticket.trainId);
 if(!train||train.status==="cancelled"||ticket.status==="cancelled")return{status:"unavailable",message:"This demo booking or departure is unavailable. Choose another demo train."};
 return{status:"found",ticket,train};
}
function editDistance(a:string,b:string):number {const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=row[0]!;row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j]!;row[j]=Math.min(row[j]!+1,row[j-1]!+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}return row[b.length]!;}
export function searchTrains(query:string,trains:readonly DemoTrain[]=demoTrains):DemoTrain[]{
 const q=query.trim().toLowerCase();if(!q)return [...trains];
 return trains.filter(t=>`${t.name} ${t.number} ${t.destination}`.toLowerCase().includes(q)||t.name.toLowerCase().split(" ").some(word=>editDistance(q,word)<=1));
}
export function assignPlatform(trains:readonly DemoTrain[],id:string,platformId:string,validPlatformIds:readonly string[]):DemoTrain[]{
 if(!validPlatformIds.includes(platformId)||!trains.some(t=>t.id===id))throw new Error("Unknown train or platform");
 return trains.map(t=>t.id===id?{...t,platformId}:t);
}
export function routeToTrain(graph:NavigationGraph,train:DemoTrain,start:string,platforms:readonly {id:string;nodeId:string}[],preference:RoutePreference="fastest",blockedEdgeIds:readonly string[]=[]):GeneratedRoute|null{
 const platform=platforms.find(p=>p.id===train.platformId);if(!platform||train.status==="cancelled")return null;
 return findRoute(graph,start,platform.nodeId,{preference,blockedEdgeIds});
}
