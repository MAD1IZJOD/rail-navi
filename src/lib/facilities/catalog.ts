import type {Facility,FacilityCategory,Station} from "../navigation/types";
export const categoryNames:Record<FacilityCategory,string>={
 water:"Drinking water",tea:"Tea & coffee",food:"Food & snacks",shop:"Convenience stores",pharmacy:"Pharmacy",washroom:"Washrooms",waiting:"Waiting rooms",tickets:"Ticketing",information:"Information desks",accessible:"Accessible assistance",security:"Station help",charging:"Charging points",luggage:"Luggage services","first-aid":"First-aid assistance","lost-found":"Lost & found",transit:"Transit interchange",
};
const synonyms:Record<FacilityCategory,string[]>={
 water:["water","drink","bottle","refill"],tea:["tea","coffee","chai","cafe"],food:["food","snack","snacks","restaurant","eat","meal","hungry","tiffin"],shop:["shop","store","convenience","essentials"],pharmacy:["pharmacy","medicine","chemist"],washroom:["washroom","toilet","restroom","bathroom","loo"],waiting:["waiting","lounge","rest","seating"],tickets:["ticket","ticketing","booking"],information:["information","help desk","enquiry","info"],accessible:["accessible","wheelchair","assistance"],security:["security","help","assistance"],charging:["charging","charge","power","battery"],luggage:["luggage","bags","baggage","cloakroom"],"first-aid":["first aid","first-aid","medical"],"lost-found":["lost","found","lost and found"],transit:["metro","transit","interchange","bus","taxi"],
};
const special:Record<string,{category:FacilityCategory;name:string}>={
 "cross-a-0":{category:"charging",name:"Foot Overbridge A · Charge & rest"},
 "p1-help":{category:"lost-found",name:"Platform 1 · Lost-and-found desk"},
 "p4-help":{category:"first-aid",name:"Platform 4 · First-aid point"},
 "p7-help":{category:"charging",name:"Platform 7 · Charge & rest"},
 "p10-help":{category:"luggage",name:"Platform 10 · Luggage assistance"},
 "p13-help":{category:"first-aid",name:"Platform 13 · First-aid point"},
 "p16-help":{category:"charging",name:"Platform 16 · Charge & rest"},
 "p19-help":{category:"lost-found",name:"Platform 19 · Lost-and-found desk"},
 "west-security":{category:"first-aid",name:"Main · First-aid assistance"},
 "east-security":{category:"luggage",name:"East · Luggage services"},
 "metro-0":{category:"transit",name:"Fictional metro interchange"},
};
const dwell:Record<FacilityCategory,number>={water:60,tea:180,food:240,shop:180,pharmacy:180,washroom:180,waiting:300,tickets:240,information:120,accessible:180,security:120,charging:300,luggage:240,"first-aid":300,"lost-found":240,transit:180};
export function enrichStation(station:Station):Station{
 const facilities:Facility[]=station.facilities.map((original,i)=>{
  const replacement=special[original.id],f={...original,...replacement};
  const retail=["tea","food","shop","pharmacy"].includes(f.category);
  const services=[f.category];
  if(f.category==="accessible"&&/washroom/i.test(f.name))services.push("washroom");
  if(f.category==="transit")services.push("information");
  return{...f,details:{
   description:`Fictional ${categoryNames[f.category].toLowerCase()} at RailNavi Demo Central. Local demo listing; no live service or stock verification.`,
   hours:retail?{opens:360,closes:f.category==="pharmacy"?1380:1320}:{opens:0,closes:1440},
   availability:(["tea","food","shop"].includes(f.category)&&i%13===0?"unavailable":"available") as "available"|"unavailable",
   visitSeconds:dwell[f.category],synonyms:synonyms[f.category],services,
   products:retail?(f.category==="tea"?["Fictional tea","Fictional coffee"]:f.category==="pharmacy"?["Fictional travel-care essentials"]:["Fictional snacks","Fictional travel essentials"]):undefined,
   priceRange:retail?"Demo ₹20–₹250 · Illustrative only":undefined,
   nearbyLandmark:f.name.includes("Platform")?f.name.split(" · ")[0]!:f.floor===-2?"Fictional metro transfer concourse":f.floor>0?f.name.split(" · ")[0]!:"Main or secondary terminal signage",
   priority:["information","first-aid","accessible","security"].includes(f.category)?90:retail?50:60,
  }};
 });
 const byNode=new Map(facilities.map(f=>[f.nodeId,f])),byId=new Map(facilities.map(f=>[f.id,f]));
 return{...station,facilities,nodes:station.nodes.map(n=>byNode.has(n.id)?{...n,name:byNode.get(n.id)!.name}:n),
  geometry:station.geometry?{...station.geometry,landmarks:station.geometry.landmarks.map(l=>byId.has(l.id)?{...l,name:byId.get(l.id)!.name}:l)}:undefined};
}
export const serviceSynonyms=synonyms;
export function facilityAvailable(f:Facility,seconds:number,overrides:Readonly<Record<string,boolean>>={}):boolean{
 if(!Number.isFinite(seconds)||seconds<0)return false;
 if((overrides[f.id]??(f.details?.availability!=="unavailable"))===false)return false;
 const {opens,closes}=f.details?.hours??{opens:0,closes:1440},minute=((seconds%86400)+86400)%86400/60;
 return closes>opens?minute>=opens&&minute<closes:minute>=opens||minute<closes;
}
