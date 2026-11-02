import type {Station,NavigationNode,NavigationEdge,FloorId,ConnectionType,Platform,Facility} from "../navigation/types";
import {plan,crossings,gatePlans,facilityPlans,regions} from "./blueprint";

/** Compile graph topology from the physical plan. No renderer owns connectivity. */
export function buildStation():Station {
 const nodes:NavigationNode[]=[],edges:NavigationEdge[]=[],platforms:Platform[]=[],facilities:Facility[]=[];
 const byId=new Map<string,NavigationNode>();
 function add(id:string,name:string,x:number,y:number,floor:FloorId,type:NavigationNode["type"]="junction",platformId?:string){
  if(byId.has(id))throw new Error("Duplicate topology node "+id);
  const n:NavigationNode={id,name,x,y,floor,type,accessible:true,platformId};nodes.push(n);byId.set(id,n);return n;
 }
 function link(from:string,to:string,label:string,kind:ConnectionType="walk",bidirectional=true){
  const a=byId.get(from)!,b=byId.get(to)!;if(!a||!b)throw new Error("Missing connector "+from+" "+to);
  const levels=Math.abs(a.floor-b.floor);
  const distanceMeters=kind==="walk"?Math.round(Math.hypot(b.x-a.x,b.y-a.y)*5)/10:kind==="lift"?levels*8:levels*(kind==="stairs"?12:14);
  const durationSeconds=kind==="walk"?Math.round(distanceMeters/1.2*10)/10:kind==="stairs"?24*levels:kind==="escalator"?18*levels:40+levels*8;
  edges.push({id:`${from}--${to}--${kind}`,from,to,label,kind,distanceMeters,durationSeconds,accessible:kind==="walk"||kind==="lift",available:true,bidirectional});
 }
 const aliases:Record<number,string>={220:"c",230:"north",300:"a",460:"u",530:"center",620:"b",700:"d",780:"v",850:"south"};
 const sideId=(side:string,y:number)=>`${side}-${aliases[y]??"at-"+y}`;
 for(const side of ["west","east"] as const){
  const ys=[...new Set([230,530,850,...crossings.filter(c=>c[side]).map(c=>c.y),...gatePlans.filter(g=>g.side===side).map(g=>g.y),...facilityPlans.filter(f=>f.anchor.startsWith(side+"-")).map(f=>f.y)])].sort((a,b)=>a-b);
  ys.forEach(y=>add(sideId(side,y),side==="west"?"Main concourse":"Secondary concourse",plan[side],y,0,y===530?"checkpoint":"junction"));
  for(let i=1;i<ys.length;i++)link(sideId(side,ys[i-1]!),sideId(side,ys[i]!),side==="west"?"Main concourse":"Secondary concourse");
 }
 for(let n=1;n<=20;n++){
  const x=plan.platformX(n),id=`platform-${n}`;
  const accesses=crossings.filter(c=>n>=c.first&&n<=c.last);
  const points=[...accesses.map(c=>({id:c.id,y:c.y})),{id:"destination",y:530}].sort((a,b)=>a.y-b.y);
  points.forEach(p=>add(`p${n}-${p.id}`,`Platform ${n}${p.id==="destination"?" boarding area":" · "+crossings.find(c=>c.id===p.id)!.name+" sign"}`,x,p.y,0,p.id==="destination"?"platform":"landing",id));
  for(let i=1;i<points.length;i++)link(`p${n}-${points[i-1]!.id}`,`p${n}-${points[i]!.id}`,`Platform ${n} walkway`);
  platforms.push({id,number:n,name:`Platform ${n}`,floor:0,nodeId:`p${n}-destination`,accessNodeIds:accesses.map(c=>`p${n}-${c.id}`),bounds:{x:x-19,y:190,width:38,height:710}});
 }
 for(const c of crossings){
  const columns=[...(c.west?["west"]:[]),...Array.from({length:c.last-c.first+1},(_,i)=>`p${c.first+i}`),...(c.east?["east"]:[])];
  for(const column of columns){
   const ground=column==="west"||column==="east"?sideId(column,c.y):`${column}-${c.id}`;
   const a=byId.get(ground)!,other=`${column}-${c.id}-${c.floor}`;
   add(other,`${c.name} · ${column.startsWith("p")?"Platform "+column.slice(1):column==="west"?"Main terminal":"Secondary terminal"}`,a.x,a.y,c.floor,"landing");
   const label=`${c.name} · ${a.name}`;
   link(ground,other,label,"stairs");
   if(c.id!=="a"||column==="west"||column==="east")link(ground,other,label,"lift");
   if(c.floor>0)link(ground,other,label,"escalator",false);
  }
  for(let i=1;i<columns.length;i++)link(`${columns[i-1]}-${c.id}-${c.floor}`,`${columns[i]}-${c.id}-${c.floor}`,c.name);
 }
 // Outer circulation never crosses tracks at ground level.
 for(const side of ["west","east"] as const){
  link(`${side}-a-1`,`${side}-b-1`,"Elevated terminal circulation");
  link(`${side}-u--1`,`${side}-v--1`,"Lower terminal concourse");
  add(`${side}-u--2`,`${side==="west"?"Main":"East"} metro transfer lift`,plan[side],460,-2,"landing");
  link(`${side}-u--1`,`${side}-u--2`,"Metro transfer hub","lift");
  link(`${side}-u--1`,`${side}-u--2`,"Metro transfer hub","stairs");
  add(`metro-${side}`,"Metro transfer concourse",plan[side],960,-2,"checkpoint");
  link(`${side}-u--2`,`metro-${side}`,"Metro transfer corridor");
 }
 const metro=[{id:"metro-west",x:130},...facilityPlans.filter(f=>f.floor===-2).map(f=>({id:f.anchor,x:f.x})),{id:"metro-east",x:1580}].sort((a,b)=>a.x-b.x);
 for(const m of metro)if(!byId.has(m.id))add(m.id,"Fictional metro interchange",m.x,960,-2,"checkpoint");
 for(let i=1;i<metro.length;i++)link(metro[i-1]!.id,metro[i]!.id,"Metro interchange concourse");
 const entrances:Station["entrances"]=gatePlans.map(g=>{
  add(g.id,g.id.replace("gate-","Gate "),g.side==="west"?65:1645,g.y,0,"gate");
  link(g.id,sideId(g.side,g.y),g.side==="west"?"Main concourse entrance":"Secondary concourse entrance");
  return{id:g.id,name:g.id.replace("gate-","Gate "),subtitle:g.subtitle,floor:0,nodeId:g.id};
 });
 for(const f of facilityPlans){
  const nodeId="facility-"+f.id,n=add(nodeId,f.name,f.x,f.y,f.floor,"facility");n.facilityId=f.id;
  const match=f.anchor.match(/^(west|east)-at-(\d+)$/);const anchor=match?sideId(match[1]!,Number(match[2])):f.anchor;
  link(anchor,nodeId,f.name+" access");facilities.push({...f,nodeId,accessible:true});
 }
 const floors:Station["floors"]=[
  {id:2,name:"Upper bridges",description:"Bridges C & D · platform zones",elevationMeters:12},
  {id:1,name:"Foot overbridges",description:"Bridge A & Bridge B",elevationMeters:6},
  {id:0,name:"Concourse & platforms",description:"Main and secondary terminals",elevationMeters:0},
  {id:-1,name:"Lower passages",description:"Two underpasses & lower concourses",elevationMeters:-5},
  {id:-2,name:"Transit interchange",description:"Fictional metro connection",elevationMeters:-10},
 ];
 return {id:"railnavi-demo-central",name:"RailNavi Demo Central",fictional:true,metersPerUnit:.5,width:plan.width,height:plan.height,nodes,edges,platforms,facilities,entrances,floors,
  anchors:[...entrances.map(e=>({id:e.id,nodeId:e.nodeId,label:e.name+" · "+e.subtitle,source:"manual" as const})),
   {id:"main-checkpoint",nodeId:"west-center",label:"Main concourse checkpoint",source:"manual"},
   {id:"east-checkpoint",nodeId:"east-center",label:"Secondary concourse checkpoint",source:"manual"},
   {id:"bridge-a-checkpoint",nodeId:"west-a-1",label:"Bridge A · West landing (+1)",source:"manual"},
   {id:"lower-checkpoint",nodeId:"west-u--1",label:"Lower passage · West landing (−1)",source:"manual"},
   {id:"metro-checkpoint",nodeId:"metro-west",label:"Fictional metro interchange (−2)",source:"manual"}],
  corridors:regions.filter(r=>r.kind!=="track"&&r.kind!=="restricted"&&r.kind!=="platform"),
  geometry:{boundary:{x:40,y:140,width:1640,height:900},regions,platformGroups:[{name:"West · 1–6",first:1,last:6},{name:"Central · 7–12",first:7,last:12},{name:"East · 13–20",first:13,last:20}],
   landmarks:[...crossings.map(c=>({id:"sign-"+c.id,name:c.name+" sign",x:c.west?130:plan.platformX(c.first),y:c.y,floor:c.floor,nodeId:`${c.west?"west":"p"+c.first}-${c.id}-${c.floor}`,priority:100})),
   ...facilities.filter(f=>["information","security","waiting"].includes(f.category)).map(f=>({id:f.id,name:f.name,x:f.x,y:f.y,floor:f.floor,nodeId:f.nodeId,priority:f.category==="information"?80:30}))]},
 };
}
