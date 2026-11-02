import type { FloorId, StationRegion, FacilityCategory } from "../navigation/types";

export const plan = { width: 1720, height: 1100, west: 130, east: 1580, platformX: (n: number) => 240 + (n - 1) * 64 };
export const crossings: {id:string;name:string;y:number;floor:FloorId;first:number;last:number;west:boolean;east:boolean}[] = [
  {id:"a",name:"Foot Overbridge A",y:300,floor:1,first:1,last:20,west:true,east:true},
  {id:"b",name:"Foot Overbridge B",y:620,floor:1,first:1,last:20,west:true,east:true},
  {id:"c",name:"Foot Overbridge C",y:220,floor:2,first:1,last:10,west:true,east:false},
  {id:"d",name:"Foot Overbridge D",y:700,floor:2,first:11,last:20,west:false,east:true},
  {id:"u",name:"Lower passenger passage",y:460,floor:-1,first:1,last:20,west:true,east:true},
  {id:"v",name:"South passenger underpass",y:780,floor:-1,first:1,last:20,west:true,east:true},
];
export const gatePlans = [
  {id:"gate-1",side:"west",y:230,subtitle:"Station Road"},
  {id:"gate-2",side:"west",y:850,subtitle:"Bus interchange"},
  {id:"gate-3",side:"east",y:230,subtitle:"City Square"},
  {id:"gate-4",side:"east",y:850,subtitle:"Taxi forecourt"},
  {id:"gate-5",side:"west",y:410,subtitle:"College Avenue"},
  {id:"gate-6",side:"east",y:410,subtitle:"East arrivals"},
  {id:"gate-7",side:"west",y:650,subtitle:"Bus / taxi pickup"},
  {id:"gate-8",side:"east",y:650,subtitle:"Garden terminal"},
] as const;
export interface FacilityPlan {id:string;name:string;category:FacilityCategory;x:number;y:number;floor:FloorId;anchor:string}
export const facilityPlans: FacilityPlan[] = [];
for(let n=1;n<=20;n++){
 const x=plan.platformX(n);
 for(const [suffix,name,category,dx,y,anchor] of [
  ["water","Drinking water","water",-10,550,"destination"],
  ["amenity",n%2?"Chai Corner":"Washroom",n%2?"tea":"washroom",10,580,"destination"],
  ["waiting","Waiting zone","waiting",-10,500,"destination"],
  ["help","Assistance point","security",10,820,"v"],
 ] as const) facilityPlans.push({id:`p${n}-${suffix}`,name:`Platform ${n} · ${name}`,category,x:x+dx,y,floor:0,anchor:`p${n}-${anchor}`});
}
for(const side of ["west","east"] as const){
 const x=plan[side], prefix=side==="west"?"Main":"East";
 const items:[string,FacilityCategory,number][]=[
  ["Information desk","information",260],["Ticket counters","tickets",340],["Security help point","security",380],
  ["Drinking water","water",490],["Waiting room","waiting",550],["Accessible washroom","accessible",660],
  ["Food court","food",740],[side==="west"?"Station Pharmacy":"Travel Essentials",side==="west"?"pharmacy":"shop",580],
  ["Quiet lounge","waiting",810],["Family rest area","accessible",880],["Taxi assistance","security",850],["Travel kiosk","shop",440],
 ];
 items.forEach(([name,category,y],i)=>facilityPlans.push({id:`${side}-${i<8?category:category+"-"+i}`,name:`${prefix} · ${name}`,category,x:x+(i%2?28:-28),y,floor:0,anchor:`${side}-at-${y}`}));
}
for(const c of crossings){
 const numbers=[c.first+2,c.last-2];
 numbers.forEach((n,i)=>facilityPlans.push({id:`cross-${c.id}-${i}`,name:`${c.name} · ${i?"Help point":"Rest area"}`,category:i?"security":"waiting",x:plan.platformX(n),y:c.y+12,floor:c.floor,anchor:`p${n}-${c.id}-${c.floor}`}));
}
for(let i=0;i<8;i++)facilityPlans.push({id:`metro-${i}`,name:["Metro interchange","Metro information","Lower transfer lounge","Metro tickets","Interchange water","Accessible interchange rest area","Metro security","Transit shop"][i]!,category:(["information","information","waiting","tickets","water","accessible","security","shop"] as const)[i]!,x:180+i*180,y:960+(i%2?15:-15),floor:-2,anchor:`metro-${i}-anchor`});

export const regions:StationRegion[]=[
 {id:"main",name:"Main terminal",x:82,y:175,width:96,height:730,floor:0,kind:"concourse"},
 {id:"secondary",name:"Secondary terminal",x:1532,y:175,width:96,height:730,floor:0,kind:"concourse"},
 ...Array.from({length:20},(_,i)=>({id:`platform-${i+1}`,name:`Platform ${i+1}`,x:plan.platformX(i+1)-19,y:190,width:38,height:710,floor:0 as const,kind:"platform" as const})),
 ...Array.from({length:21},(_,i)=>({id:`track-${i}`,name:`Restricted track ${i+1}`,x:202+i*64,y:190,width:12,height:710,floor:0 as const,kind:"track" as const})),
 ...gatePlans.map(g=>({id:g.id,name:g.id.replace("gate-","Gate "),x:g.side==="west"?45:1580,y:g.y-20,width:g.side==="west"?85:90,height:40,floor:0 as const,kind:"entrance" as const})),
 ...crossings.map(c=>{const start=c.west?plan.west:plan.platformX(c.first),end=c.east?plan.east:plan.platformX(c.last);return{id:c.id,name:c.name,x:start-20,y:c.y-22,width:end-start+40,height:44,floor:c.floor,kind:c.floor>0?"bridge" as const:"underpass" as const};}),
 ...([-1,1] as const).flatMap(floor=>(["west","east"] as const).map(side=>({id:`${side}-circulation-${floor}`,name:`${side==="west"?"Main":"Secondary"} ${floor===-1?"lower":"elevated"} concourse`,x:plan[side]-20,y:floor===-1?438:278,width:40,height:floor===-1?364:364,floor,kind:"concourse" as const}))),
 {id:"metro-transfer",name:"Fictional metro interchange",x:110,y:920,width:1490,height:80,floor:-2,kind:"interchange"},
 ...(["west","east"] as const).map(side=>({id:`${side}-metro-access`,name:"Metro transfer corridor",x:plan[side]-20,y:438,width:40,height:522,floor:-2 as const,kind:"concourse" as const})),
];
