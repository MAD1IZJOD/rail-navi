import {findRoute} from "../navigation/engine";
import type {GeneratedRoute,JourneyStop,NavigationGraph,RoutingOptions} from "../navigation/types";
export const MAX_OPTIONAL_STOPS=4;
function empty(options:RoutingOptions,status:"invalid"|"unreachable",message:string):GeneratedRoute{
 return{status,message,preference:options.preference,nodes:[],edges:[],distanceMeters:0,durationSeconds:0,floorChanges:[],instructions:[],stopVisits:[]};
}
export function planJourney(graph:NavigationGraph,startId:string,finalId:string,stops:readonly JourneyStop[],options:RoutingOptions):GeneratedRoute{
 if(stops.length>MAX_OPTIONAL_STOPS)return empty(options,"invalid","Choose at most four optional stops.");
 if(new Set(stops.map(s=>s.id)).size!==stops.length||new Set(stops.map(s=>s.nodeId)).size!==stops.length||stops.some(s=>s.nodeId===finalId||!Number.isFinite(s.dwellSeconds)||s.dwellSeconds<0))return empty(options,"invalid","Stops must be unique, have valid visit durations, and keep the final destination separate.");
 const unavailable=stops.find(s=>s.available===false);
 if(unavailable)return empty(options,"unreachable",unavailable.name+" is unavailable in this fictional demo. Remove it or choose an alternative.");
 const direct=findRoute(graph,startId,finalId,options);
 const result:GeneratedRoute={...direct,nodes:[],edges:[],instructions:[],floorChanges:[],distanceMeters:0,durationSeconds:0,stopVisits:[],finalDestinationId:finalId,dwellSeconds:stops.reduce((n,s)=>n+s.dwellSeconds,0)};
 let from=startId;
 for(const [i,target] of [...stops.map(s=>s.nodeId),finalId].entries()){
  const leg=findRoute(graph,from,target,options);
  if(leg.status!=="available")return empty(options,leg.status,"Cannot reach "+(stops[i]?.name??"the final destination")+". "+leg.message);
  result.nodes.push(...(i?leg.nodes.slice(1):leg.nodes));result.edges.push(...leg.edges);result.instructions.push(...leg.instructions);
  result.floorChanges.push(...leg.floorChanges);result.distanceMeters+=leg.distanceMeters;result.durationSeconds+=leg.durationSeconds;
  if(stops[i])result.stopVisits!.push({...stops[i]!,edgeIndex:result.edges.length});
  from=target;
 }
 result.status="available";result.message=stops.length?"Journey ready with "+stops.length+" optional stops.":"Direct route ready.";
 result.detourMeters=direct.status==="available"?Math.max(0,result.distanceMeters-direct.distanceMeters):0;
 result.detourSeconds=direct.status==="available"?Math.max(0,result.durationSeconds-direct.durationSeconds):0;
 return result;
}
/** Exact dynamic programming for at most four selected stops: O(2^k k²) oracle costs.
 * Directed pair costs are never assumed symmetric. Candidate facility selection is separate.
 */
export function optimizeStops(graph:NavigationGraph,start:string,final:string,stops:readonly JourneyStop[],options:RoutingOptions):{stops:JourneyStop[];route:GeneratedRoute}{
 if(stops.length>MAX_OPTIONAL_STOPS||stops.some(s=>s.available===false))return{stops:[...stops],route:planJourney(graph,start,final,stops,options)};
 const cache=new Map<string,number>();
 const cost=(a:string,b:string)=>{const key=a+"|"+b;if(cache.has(key))return cache.get(key)!;const r=findRoute(graph,a,b,options),v=r.status!=="available"?Infinity:options.preference==="shortest"?r.distanceMeters:r.durationSeconds;cache.set(key,v);return v;};
 const count=stops.length,states=new Map<string,{cost:number;order:number[]}>();
 for(let i=0;i<count;i++)states.set((1<<i)+":"+i,{cost:cost(start,stops[i]!.nodeId),order:[i]});
 for(let mask=1;mask<(1<<count);mask++)for(let last=0;last<count;last++){
  const state=states.get(mask+":"+last);if(!state)continue;
  for(let next=0;next<count;next++)if(!(mask&(1<<next))){
   const key=(mask|(1<<next))+":"+next,value=state.cost+cost(stops[last]!.nodeId,stops[next]!.nodeId);
   if(value<(states.get(key)?.cost??Infinity))states.set(key,{cost:value,order:[...state.order,next]});
  }
 }
 let best: number[]|undefined,bestCost=Infinity;
 for(let last=0;last<count;last++){const state=states.get(((1<<count)-1)+":"+last);if(state){const value=state.cost+cost(stops[last]!.nodeId,final);if(value<bestCost){bestCost=value;best=state.order;}}}
 const ordered=best?best.map(i=>stops[i]!):[...stops];
 return{stops:ordered,route:planJourney(graph,start,final,ordered,options)};
}
export function insertBestStop(graph:NavigationGraph,start:string,final:string,current:readonly JourneyStop[],stop:JourneyStop,options:RoutingOptions){
 let best={stops:[...current,stop],route:planJourney(graph,start,final,[...current,stop],options)},score=Infinity;
 for(let i=0;i<=current.length;i++){
  const stops=[...current.slice(0,i),stop,...current.slice(i)],route=planJourney(graph,start,final,stops,options);
  const value=route.status==="available"?(options.preference==="shortest"?route.distanceMeters:route.durationSeconds):Infinity;
  if(value<score){score=value;best={stops,route};}
 }
 return best;
}
