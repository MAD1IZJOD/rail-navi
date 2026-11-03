import {findRoute} from "./engine";
import type {FloorId,GeneratedRoute,NavigationGraph,NavigationNode,RoutingOptions} from "./types";
export interface SimPosition {x:number;y:number;floor:FloorId;heading:number;nodeId?:string;edgeId?:string}
export interface ReplanRequest {destinationId:string;options:RoutingOptions;reason:string}
export interface NavigationSession {
 status:"running"|"paused"|"arrived"|"blocked"|"stopped";
 route:GeneratedRoute;edgeIndex:number;edgeSeconds:number;speed:number;
 position:SimPosition;initialStartId:string;destinationId:string;options:RoutingOptions;
 traveledMeters:number;elapsedSeconds:number;revision:number;message:string;pending?:ReplanRequest;
}
const rootId=(id:string)=>id.split("::")[0]!;
const eligible=(kind:string,accessible:boolean,options:RoutingOptions)=>
 !(options.preference==="wheelchair"&&(!accessible||kind==="stairs"||kind==="escalator"))&&!(options.preference==="avoid-stairs"&&kind==="stairs");
export function startSession(route:GeneratedRoute,speed=1):NavigationSession{
 if(route.status!=="available"||!route.nodes.length)throw new Error("A valid route is required");
 const first=route.nodes[0]!;
 return{status:route.edges.length?"running":"arrived",route,edgeIndex:0,edgeSeconds:0,speed,
 position:{x:first.x,y:first.y,floor:first.floor,heading:0,nodeId:first.id},initialStartId:first.id,
 destinationId:route.nodes.at(-1)!.id,options:{preference:route.preference},traveledMeters:0,elapsedSeconds:0,revision:0,message:"Simulation started. This is not live positioning."};
}
function atPosition(s:NavigationSession):SimPosition{
 const a=s.route.nodes[s.edgeIndex]??s.route.nodes.at(-1)!;
 const edge=s.route.edges[s.edgeIndex],b=s.route.nodes[s.edgeIndex+1]??a;
 const f=edge?Math.min(1,s.edgeSeconds/edge.durationSeconds):0;
 return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,floor:a.floor,
 heading:Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI,
 nodeId:f===0?a.id:undefined,edgeId:edge?rootId(edge.id):undefined};
}
export function advanceSession(s:NavigationSession,realSeconds:number,graph:NavigationGraph):NavigationSession{
 if(s.status!=="running"||realSeconds<=0||!Number.isFinite(realSeconds))return s;
 let next={...s},budget=realSeconds*s.speed;
 while(budget>1e-9&&next.edgeIndex<next.route.edges.length){
  const edge=next.route.edges[next.edgeIndex]!,remaining=edge.durationSeconds-next.edgeSeconds,used=Math.min(budget,remaining);
  next.traveledMeters+=edge.distanceMeters*used/edge.durationSeconds;next.elapsedSeconds+=used;
  next.edgeSeconds+=used;budget-=used;
  if(next.edgeSeconds>=edge.durationSeconds-1e-8){
   next.edgeIndex++;next.edgeSeconds=0;next.position=atPosition(next);
   if(next.pending){const request=next.pending;next=replanSession({...next,pending:undefined},graph,request);}
  }else next.position=atPosition(next);
 }
 if(next.edgeIndex>=next.route.edges.length&&next.status!=="blocked"){
  next.status="arrived";next.position=atPosition(next);next.message="You have arrived at "+next.route.nodes.at(-1)!.name+". Simulation complete.";
 }
 return next;
}
export function stepSession(s:NavigationSession,graph:NavigationGraph):NavigationSession{
 if(s.status==="arrived"||s.status==="blocked"||s.status==="stopped")return s;
 const edge=s.route.edges[s.edgeIndex];if(!edge)return s;
 const result=advanceSession({...s,status:"running",speed:1},edge.durationSeconds-s.edgeSeconds,graph);
 return{...result,speed:s.speed,status:result.status==="running"?"paused":result.status};
}
export function pauseSession(s:NavigationSession):NavigationSession{return s.status==="running"?{...s,status:"paused",message:"Simulation paused."}:s;}
export function resumeSession(s:NavigationSession):NavigationSession{return s.status==="paused"?{...s,status:"running",message:"Simulation resumed."}:s;}
export function setSimulationSpeed(s:NavigationSession,speed:number):NavigationSession{
 if(!Number.isFinite(speed)||speed<1||speed>120)throw new Error("Simulation speed must be between 1 and 120");
 return{...s,speed};
}
export function restartSession(s:NavigationSession,graph:NavigationGraph):NavigationSession{
 const route=findRoute(graph,s.initialStartId,s.destinationId,s.options);
 if(route.status!=="available")return{...s,status:"blocked",route,message:route.message};
 return{...startSession(route,s.speed),initialStartId:s.initialStartId,options:s.options,revision:s.revision+1};
}
/** Reroute from an exact interpolated walking point. No snap to a remote checkpoint.
 * An occupied vertical connector is completed to its landing before replanning.
 * If that connector fails, freeze honestly until availability is restored.
 */
export function replanSession(s:NavigationSession,graph:NavigationGraph,request:ReplanRequest):NavigationSession{
 const occupied=s.route.edges[s.edgeIndex],root=occupied&&graph.edges.find(e=>e.id===rootId(occupied.id));
 const blocked=new Set(request.options.blockedEdgeIds??[]);
 if(occupied&&occupied.kind!=="walk"&&s.edgeSeconds>0){
  const available=root?.available&&!blocked.has(root.id)&&eligible(root.kind,root.accessible,request.options);
  return{...s,destinationId:request.destinationId,options:request.options,pending:request,
   status:available?(s.status==="blocked"?"paused":s.status):"blocked",
   message:available?"Finishing the current connector before rerouting at its landing.":"The occupied connector is unavailable. Simulation stopped in place; restore it to continue."};
 }
 let start=s.position.nodeId,augmented:NavigationGraph=graph;
 if(!start||!graph.nodes.some(n=>n.id===start)){
  if(!root||root.kind!=="walk")return{...s,status:"blocked",message:"No verified graph position is available."};
  const a=graph.nodes.find(n=>n.id===root.from)!,b=graph.nodes.find(n=>n.id===root.to)!;
  const lengthSquared=(b.x-a.x)**2+(b.y-a.y)**2;
  const f=Math.max(0,Math.min(1,((s.position.x-a.x)*(b.x-a.x)+(s.position.y-a.y)*(b.y-a.y))/lengthSquared));
  const virtual:NavigationNode={id:"__passenger__",name:"Current simulated position",x:s.position.x,y:s.position.y,floor:s.position.floor,type:"checkpoint",accessible:root.accessible};
  start=virtual.id;
  const extra=[];
  if(root.available&&!blocked.has(root.id)&&1-f>1e-8)extra.push({...root,id:root.id+"::forward",from:start,to:root.to,distanceMeters:root.distanceMeters*(1-f),durationSeconds:root.durationSeconds*(1-f),bidirectional:false});
  // Egress only along the part already traversed; never crosses a closed section.
  if(root.bidirectional&&f>1e-8)extra.push({...root,id:root.id+"::back",from:start,to:root.from,distanceMeters:root.distanceMeters*f,durationSeconds:root.durationSeconds*f,bidirectional:false,available:true});
  augmented={nodes:[...graph.nodes,virtual],edges:[...graph.edges,...extra]};
 }
 const filtered={...augmented,edges:augmented.edges.map(e=>({...e,available:e.available&&(!blocked.has(rootId(e.id))||e.id.endsWith("::back"))}))};
 const route=findRoute(filtered,start,request.destinationId,{...request.options,blockedEdgeIds:[]});
 const next={...s,route,destinationId:request.destinationId,options:request.options,edgeIndex:0,edgeSeconds:0,revision:s.revision+1,pending:undefined,message:request.reason};
 if(route.status!=="available")return{...next,status:"blocked",message:request.reason+" No safe route is available. Contact the Main information desk in this fictional demo."};
 return{...next,status:route.edges.length?(s.status==="running"?"running":"paused"):"arrived",position:{...s.position,nodeId:start}};
}
export function deviationChoices(s:NavigationSession,graph:NavigationGraph):string[]{
 const node=s.position.nodeId;if(!node||!graph.nodes.some(n=>n.id===node)||s.edgeSeconds>0)return[];
 const expected=s.route.nodes[s.edgeIndex+1]?.id,blocked=new Set(s.options.blockedEdgeIds??[]);
 return [...new Set(graph.edges.filter(e=>e.available&&!blocked.has(e.id)&&eligible(e.kind,e.accessible,s.options)&&
  (e.from===node||(e.bidirectional&&e.to===node))).map(e=>e.from===node?e.to:e.from).filter(id=>id!==expected))];
}
export function deviateSession(s:NavigationSession,graph:NavigationGraph,targetId:string):NavigationSession{
 if(!deviationChoices(s,graph).includes(targetId))return{...s,message:"Choose a valid alternate connection at the current decision point."};
 const detour=findRoute(graph,s.position.nodeId!,targetId,s.options);
 // The operator selects an actual adjacent connection; traverse it before detecting deviation.
 if(detour.status!=="available")return s;
 return{...s,route:detour,edgeIndex:0,edgeSeconds:0,status:"running",
  pending:{destinationId:s.destinationId,options:s.options,reason:"Wrong turn detected at a valid junction. Route recalculated from your simulated position."},
  message:"Taking an alternate permitted path. Rerouting at the next decision point."};
}
export function sessionGuidance(s:NavigationSession){
 const edge=s.route.edges[s.edgeIndex],fraction=edge?s.edgeSeconds/edge.durationSeconds:0;
 const remainingDistance=s.route.edges.slice(s.edgeIndex).reduce((v,e)=>v+e.distanceMeters,0)-(edge?.distanceMeters??0)*fraction;
 const remainingSeconds=s.route.edges.slice(s.edgeIndex).reduce((v,e)=>v+e.durationSeconds,0)-(edge?.durationSeconds??0)*fraction;
 const index=edge?s.route.instructions.findIndex(step=>step.edgeIds.includes(edge.id)):s.route.instructions.length-1;
 const current=s.route.instructions[index],upcoming=s.route.instructions[index+1];
 const decisionDistance=current?s.route.edges.slice(s.edgeIndex).filter(e=>current.edgeIds.includes(e.id)).reduce((v,e)=>v+e.distanceMeters,0)-(edge?.distanceMeters??0)*fraction:0;
 return{current,upcoming,remainingDistance:Math.max(0,remainingDistance),remainingSeconds:Math.max(0,remainingSeconds),decisionDistance:Math.max(0,decisionDistance),
 progress:s.route.distanceMeters?1-Math.max(0,remainingDistance)/s.route.distanceMeters:1};
}
