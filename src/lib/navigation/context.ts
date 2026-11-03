import type {NavigationGraph,NavigationNode,RoutingOptions} from "./types";
import type {NavigationSession} from "./simulator";
export interface PositionContext {graph:NavigationGraph;startId:string;prefixSeconds:number;prefixMeters:number;deferred:boolean;valid:boolean}
export function positionContext(graph:NavigationGraph,startId:string,session:NavigationSession|null,options:RoutingOptions):PositionContext{
 const base={graph,startId,prefixSeconds:0,prefixMeters:0,deferred:false,valid:true};if(!session)return base;
 const p=session.position;
 if(p.nodeId&&graph.nodes.some(n=>n.id===p.nodeId))return{...base,startId:p.nodeId};
 const occupied=session.route.edges[session.edgeIndex],id=(occupied?.id??p.edgeId??"").split("::")[0]!,root=graph.edges.find(e=>e.id===id);
 if(!root)return{...base,valid:false};
 const blocked=new Set(options.blockedEdgeIds??[]);
 if(root.kind!=="walk"){
  const landing=session.route.nodes[session.edgeIndex+1];
  const eligible=root.available&&!blocked.has(root.id)&&!(options.preference==="wheelchair"&&!root.accessible)&&!(options.preference==="avoid-stairs"&&root.kind==="stairs");
  const fraction=occupied?session.edgeSeconds/occupied.durationSeconds:0;
  return{...base,startId:landing?.id??startId,prefixSeconds:(occupied?.durationSeconds??0)*(1-fraction),prefixMeters:(occupied?.distanceMeters??0)*(1-fraction),deferred:true,valid:!!landing&&eligible};
 }
 const a=graph.nodes.find(n=>n.id===root.from)!,b=graph.nodes.find(n=>n.id===root.to)!;
 const length=(b.x-a.x)**2+(b.y-a.y)**2,f=length?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/length)):0;
 const virtual:NavigationNode={id:"__passenger__",name:"Current simulated position",x:p.x,y:p.y,floor:p.floor,type:"checkpoint",accessible:root.accessible};
 const extra=[];
 if(root.available&&!blocked.has(root.id)&&1-f>1e-8)extra.push({...root,id:root.id+"::preview-forward",from:virtual.id,to:root.to,distanceMeters:root.distanceMeters*(1-f),durationSeconds:root.durationSeconds*(1-f),bidirectional:false});
 if(root.bidirectional&&f>1e-8)extra.push({...root,id:root.id+"::preview-return",from:virtual.id,to:root.from,distanceMeters:root.distanceMeters*f,durationSeconds:root.durationSeconds*f,bidirectional:false,available:true});
 return{...base,startId:virtual.id,graph:{nodes:[...graph.nodes,virtual],edges:[...graph.edges,...extra]}};
}
