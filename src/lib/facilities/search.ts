import {findRoute} from "../navigation/engine";
import type {Facility,FacilityCategory,GeneratedRoute,JourneyStop,RoutingOptions,Station} from "../navigation/types";
import type {PositionContext} from "../navigation/context";
import {facilityAvailable,serviceSynonyms} from "./catalog";
import {assessTiming,type JourneyTiming} from "../journey/time";
import {insertBestStop,planJourney} from "../journey/planner";
export const ON_ROUTE_METRES=30,ON_ROUTE_SECONDS=45;
const hindiTokens:Record<string,string>={"प्राथमिक उपचार":"first aid","खोया पाया":"lost found","खोया-पाया":"lost found","सहायता केंद्र":"help desk","सहायता केन्द्र":"help desk","पूछताछ":"information","मेरे रास्ते में":"on my way","रास्ते में":"on my way","ट्रेन से पहले":"before my train","के पास":"near","निकटतम":"nearest","सबसे पास":"nearest","प्लेटफ़ॉर्म":"platform","प्लेटफॉर्म":"platform","पानी":"water","कॉफ़ी":"coffee","कॉफी":"coffee","चाय":"tea","शौचालय":"toilet","सुलभ":"accessible","व्हीलचेयर":"wheelchair","दवा":"pharmacy","दवाइयाँ":"pharmacy","भोजन":"food","खाना":"food","नाश्ता":"snacks","दुकान":"shop","चार्जिंग":"charging","चार्ज":"charging","सामान":"luggage","टिकट":"tickets","प्रतीक्षालय":"waiting","स्तर":"level","द्वार":"gate","मेट्रो":"metro","मदद":"help"};
export function queryTokens(value:string){let result=value.normalize("NFC");for(const [hi,en]of Object.entries(hindiTokens))result=result.replaceAll(hi," "+en+" ");return result.replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x0966));}
export const normalizeSearch=(value:string)=>queryTokens(value).toLowerCase().normalize("NFKD").replace(/[’']/g,"").replace(/[^a-z0-9+\-\s]/g," ").replace(/\s+/g," ").trim();
export interface FacilityIntent {supported:boolean;category?:FacilityCategory;accessible:boolean;onWay:boolean;nearest:boolean;platform?:number;gate?:number;floor?:number;message:string}
export function interpretQuery(query:string,category:FacilityCategory|"all"="all"):FacilityIntent{
 const q=normalizeSearch(query),accessible=/accessible|wheelchair|step free/.test(q);
 const matches=(Object.keys(serviceSynonyms) as FacilityCategory[]).filter(c=>serviceSynonyms[c].some(word=>new RegExp("\\b"+word.replace("-","[- ]")+"\\b").test(q)));
 const action=/book me|order online|checkout|pay for|deliver to|track my/.test(q);
 const specificHelp=matches.some(c=>c==="lost-found"||c==="first-aid");
 const distinct=matches.filter(c=>c!=="accessible"&&c!=="security"&&!(specificHelp&&c==="information"));
 const ambiguous=category==="all"&&distinct.length>1;
 const chosen=action||ambiguous?undefined:category!=="all"?category:matches.find(c=>c==="lost-found"||c==="first-aid")??matches.find(c=>c!=="accessible")??matches[0];
 const platform=q.match(/platform\s*(\d+)/),gate=q.match(/gate\s*(\d+)/),floor=q.match(/level\s*([+\-]?\d+)/);
 const supported=!!chosen;
 return{supported,category:chosen,accessible,onWay:/on (my|the) (way|route)|before my train/.test(q),nearest:/nearest|closest/.test(q),platform:platform?Number(platform[1]):undefined,gate:gate?Number(gate[1]):undefined,floor:floor?Number(floor[1]):undefined,message:supported?"Matches use modeled walking routes.":ambiguous?"Choose one category at a time, then add each useful stop to your journey.":"Try a supported category such as water, coffee, pharmacy, washroom, charging or help desk."};
}
export interface FacilityMatch {facility:Facility;reachable:boolean;open:boolean;walkingMeters:number;walkingSeconds:number;detourMeters:number;detourSeconds:number;floorChanges:number;badges:string[];route:GeneratedRoute;insertion:JourneyStop[];preference:RoutingOptions["preference"];timing:JourneyTiming}
export function toJourneyStop(f:Facility,now:number,overrides:Readonly<Record<string,boolean>>={},dwellSeconds=f.details?.visitSeconds??120):JourneyStop{
 return{id:f.id,nodeId:f.nodeId,name:f.name,dwellSeconds,available:facilityAvailable(f,now,overrides)};
}
interface SearchContext {station:Station;position:PositionContext;finalId:string;stops:readonly JourneyStop[];options:RoutingOptions;now:number;availability?:Readonly<Record<string,boolean>>;query:string;category?:FacilityCategory|"all";departure?:number;buffer?:number;remainingVisitSeconds?:number}
export function discoverFacilities(ctx:SearchContext):{intent:FacilityIntent;results:FacilityMatch[];message:string}{
 const {station,position,finalId,stops,now}=ctx,intent=interpretQuery(ctx.query,ctx.category);
 const nameQuery=normalizeSearch(ctx.query);
 const nameMatches=station.facilities.filter(f=>nameQuery.length>2&&normalizeSearch(f.name).includes(nameQuery));
 if(!intent.supported&&!nameMatches.length)return{intent,results:[],message:intent.message};
 if((intent.platform&&!station.platforms.some(p=>p.number===intent.platform))||(intent.gate&&!station.entrances.some(g=>g.id==="gate-"+intent.gate))||(intent.floor!==undefined&&!station.floors.some(f=>f.id===intent.floor)))return{intent,results:[],message:"That location is not part of this fictional station."};
 const options={...ctx.options,preference:intent.accessible?"wheelchair" as const:ctx.options.preference};
 const baseline=planJourney(position.graph,position.startId,finalId,stops,options);
 const qualifier=intent.platform?station.platforms.find(p=>p.number===intent.platform)?.nodeId:intent.gate?"gate-"+intent.gate:undefined;
 const results:FacilityMatch[]=station.facilities.filter(f=>
  (!intent.category||f.category===intent.category||f.details?.services.includes(intent.category))&&
  (intent.floor===undefined||f.floor===intent.floor)&&(!intent.accessible||f.accessible)&&
  (intent.supported||nameMatches.some(n=>n.id===f.id))).map(f=>{
  const route=findRoute(position.graph,position.startId,f.nodeId,options);
  const stop={...toJourneyStop(f,now,ctx.availability),available:true};
  const insertion=stops.some(s=>s.id===f.id)?{stops:[...stops],route:baseline}:insertBestStop(position.graph,position.startId,finalId,stops,stop,options);
  const reachable=position.valid&&route.status==="available"&&insertion.route.status==="available";
  const visit=insertion.route.stopVisits?.find(v=>v.id===f.id);
  const arrivalWalking=insertion.route.edges.slice(0,visit?.edgeIndex??0).reduce((n,e)=>n+e.durationSeconds,0);
  const beforeVisit=(insertion.route.stopVisits??[]).slice(0,(insertion.route.stopVisits??[]).findIndex(v=>v.id===f.id)).reduce((n,v)=>n+v.dwellSeconds,0);
  const extra=position.prefixSeconds+(ctx.remainingVisitSeconds??0);
  const open=facilityAvailable(f,now+extra+arrivalWalking+beforeVisit,ctx.availability);
  const timing=assessTiming(now,ctx.departure,insertion.route,ctx.buffer??300,extra);
  const detourMeters=reachable?Math.max(0,insertion.route.distanceMeters-baseline.distanceMeters):Infinity;
  const detourSeconds=reachable?Math.max(0,insertion.route.durationSeconds-baseline.durationSeconds):Infinity;
  const floorChanges=route.floorChanges.length;
  const badges:string[]=[];
  if(reachable&&open&&detourMeters<=ON_ROUTE_METRES&&detourSeconds<=ON_ROUTE_SECONDS&&insertion.route.floorChanges.length<=baseline.floorChanges.length)badges.push("On your route");
  if(reachable&&route.edges.every(e=>e.accessible&&(e.kind==="walk"||e.kind==="lift")))badges.push("Accessible option");
  const near=qualifier?findRoute(station,qualifier,f.nodeId,options):undefined;
  return{facility:f,reachable,open,timing,walkingMeters:reachable?route.distanceMeters+position.prefixMeters:Infinity,walkingSeconds:reachable?route.durationSeconds+position.prefixSeconds:Infinity,detourMeters,detourSeconds,floorChanges,badges,route:insertion.route,insertion:insertion.stops,preference:options.preference,qualifierDistance:near?.status==="available"?near.distanceMeters:Infinity};
 });
 const eligible=results.filter(r=>r.open&&r.reachable);
 const nearest=Math.min(...eligible.map(r=>r.walkingMeters)),least=Math.min(...eligible.map(r=>r.detourSeconds));
 for(const r of eligible){if(r.walkingMeters===nearest)r.badges.unshift("Closest to you");if(r.detourSeconds===least)r.badges.unshift("Least detour");}
 results.sort((a,b)=>Number(b.reachable&&b.open)-Number(a.reachable&&a.open)||Number(a.timing.status==="not-recommended")-Number(b.timing.status==="not-recommended")||
  (qualifier?(a as FacilityMatch&{qualifierDistance:number}).qualifierDistance-(b as FacilityMatch&{qualifierDistance:number}).qualifierDistance:0)||
  (intent.onWay?a.detourSeconds-b.detourSeconds:a.walkingMeters-b.walkingMeters)||a.floorChanges-b.floorChanges||a.facility.id.localeCompare(b.facility.id));
 return{intent,results,message:stops.length>=4?"Four optional stops selected. Remove a stop before adding another.":results.length?"Ranked by actual station walking connections.":"No matching facilities. Try another category or location."};
}
