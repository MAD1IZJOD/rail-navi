import {describe,expect,it} from "vitest";
import {categoryNames,facilityAvailable} from "../src/lib/facilities/catalog";
import {discoverFacilities,interpretQuery,normalizeSearch,ON_ROUTE_METRES,ON_ROUTE_SECONDS,toJourneyStop} from "../src/lib/facilities/search";
import {positionContext} from "../src/lib/navigation/context";
import {findRoute} from "../src/lib/navigation/engine";
import {demoStation as station,liftEdgeIds} from "../src/lib/station/demo-station";
import type {Facility,NavigationEdge,NavigationNode,Station} from "../src/lib/navigation/types";
const options={preference:"fastest" as const},now=20*3600;
const search=(query:string,extra={})=>discoverFacilities({station,position:positionContext(station,"gate-2",null,options),finalId:"p17-destination",stops:[],options,now,query,...extra});
describe("deterministic facility intent",()=>{
 it.each([
 [" water ","water"],["COFFEE near Platform 12","tea"],["pharmacy on my way","pharmacy"],["food near Gate 3","food"],
 ["accessible toilet","washroom"],["charging point on Level +1","charging"],["help desk","information"],["something to eat before my train","food"],
 ["lost and found help desk","lost-found"],["first aid help","first-aid"],["cloakroom","luggage"],["metro interchange","transit"]
 ])("interprets %s", (q,category)=>expect(interpretQuery(q).category).toBe(category));
 it("normalizes spacing, punctuation and case",()=>expect(normalizeSearch("  WATER,   On My Way! ")).toBe("water on my way"));
 it("extracts route and location qualifiers explicitly",()=>{expect(interpretQuery("coffee near Platform 12")).toMatchObject({platform:12,category:"tea"});expect(interpretQuery("food near Gate 3")).toMatchObject({gate:3});expect(interpretQuery("charging point on Level +1")).toMatchObject({floor:1});expect(interpretQuery("water on my way")).toMatchObject({onWay:true});expect(interpretQuery("accessible toilet")).toMatchObject({accessible:true});});
 it.each(["","book me a taxi online","where are my friends"])("provides suggestions for unsupported query %s",q=>{const r=search(q);expect(r.results).toEqual([]);expect(r.message).toContain("Try a supported category");});
 it("uses a selected category for an empty query",()=>expect(search("",{category:"water"}).results.length).toBeGreaterThan(0));
 it("reports invalid station qualifiers without fabricated answers",()=>{expect(search("water near Platform 99").results).toEqual([]);expect(search("water near Gate 99").message).toContain("not part");expect(search("water on Level +9").results).toEqual([]);});
});
describe("real modeled facility records and discovery",()=>{
 it("enriches all 124 existing anchors without moving them",()=>{expect(station.facilities).toHaveLength(124);expect(new Set(station.facilities.map(f=>f.id)).size).toBe(124);expect(Object.keys(categoryNames)).toHaveLength(16);expect(new Set(station.facilities.map(f=>f.category)).size).toBe(16);for(const f of station.facilities){const n=station.nodes.find(n=>n.id===f.nodeId)!;expect([f.x,f.y,f.floor]).toEqual([n.x,n.y,n.floor]);expect(f.details?.visitSeconds).toBeGreaterThanOrEqual(0);expect(f.details?.description).toContain("Fictional");}});
 it("returns reachable water with exact graph-based walking costs",()=>{const r=search("water on my way");expect(r.results.length).toBeGreaterThan(0);for(const f of r.results.filter(r=>r.reachable)){const direct=findRoute(station,"gate-2",f.facility.nodeId,options);expect(f.walkingMeters).toBeCloseTo(direct.distanceMeters);expect(f.walkingSeconds).toBeCloseTo(direct.durationSeconds);expect(f.route.nodes.at(-1)?.id).toBe("p17-destination");}});
 it("only labels on-route candidates under both explicit thresholds",()=>{for(const r of search("water on my way").results.filter(r=>r.badges.includes("On your route"))){expect(r.detourMeters).toBeLessThanOrEqual(ON_ROUTE_METRES);expect(r.detourSeconds).toBeLessThanOrEqual(ON_ROUTE_SECONDS);const baseline=findRoute(station,"gate-2","p17-destination",options);expect(r.route.floorChanges.length).toBeLessThanOrEqual(baseline.floorChanges.length);}});
 it("ranks least detour among suitable water options",()=>{const a=search("water on my way").results.filter(r=>r.reachable&&r.open);expect(a[0]?.detourSeconds).toBe(Math.min(...a.map(r=>r.detourSeconds)));});
 it("ranks the nearest available washroom by network distance",()=>{const a=search("nearest washroom").results.filter(r=>r.reachable&&r.open);expect(a[0]?.walkingMeters).toBe(Math.min(...a.map(r=>r.walkingMeters)));});
 it("uses platform and gate qualifiers for graph proximity",()=>{for(const [q,start] of [["coffee near Platform 12","p12-destination"],["food near Gate 3","gate-3"]]){const r=search(q!).results.filter(r=>r.open&&r.reachable);const ds=r.map(r=>findRoute(station,start!,r.facility.nodeId,options).distanceMeters);expect(ds[0]).toBe(Math.min(...ds));}});
 it("enforces accessible queries and availability rather than silently taking stairs",()=>{const r=search("accessible toilet").results.filter(r=>r.reachable);expect(r.length).toBeGreaterThan(0);for(const m of r){expect(m.preference).toBe("wheelchair");expect(m.route.edges.every(e=>e.accessible&&(e.kind==="walk"||e.kind==="lift"))).toBe(true);}});
 it("reports facilities unreachable after all accessible lifts close",()=>{const r=search("pharmacy",{options:{preference:"wheelchair",blockedEdgeIds:liftEdgeIds}});expect(r.results.some(r=>!r.reachable)).toBe(true);});
 it("removes unavailable facilities from suitable recommendations",()=>{const a=search("water").results[0]!;const b=search("water",{availability:{[a.facility.id]:false}});expect(b.results.find(r=>r.facility.id===a.facility.id)?.open).toBe(false);expect(b.results[0]?.facility.id).not.toBe(a.facility.id);});
 it("supports direct facility names",()=>{const f=station.facilities.find(f=>f.category==="pharmacy")!;expect(search(f.name).results.some(r=>r.facility.id===f.id)).toBe(true);});
 it("compares graph distance rather than visually close coordinates",()=>{const n=(id:string,x:number):NavigationNode=>({id,name:id,x,y:0,floor:0,type:"junction",accessible:true});const e=(from:string,to:string,d:number):NavigationEdge=>({id:from+to,from,to,distanceMeters:d,durationSeconds:d,kind:"walk",label:"Safe passage",accessible:true,available:true,bidirectional:true});const f=(id:string,x:number):Facility=>({id,nodeId:id,name:id+" water",x,y:0,floor:0,category:"water",accessible:true});const g:Station={...station,nodes:[n("start",0),n("near",1),n("far",100),n("platform",200)],edges:[e("start","near",200),e("start","far",10),e("far","platform",10),e("near","platform",200)],facilities:[f("near",1),f("far",100)]};const r=discoverFacilities({station:g,position:positionContext(g,"start",null,options),finalId:"platform",stops:[],options,now,query:"nearest water"});expect(r.results[0]?.facility.id).toBe("far");expect(r.results[0]?.walkingMeters).toBe(10);});
});
describe("fictional hours and availability",()=>{
 const f=station.facilities.find(f=>f.category==="pharmacy")!;
 it("evaluates shop hours on the fictional clock",()=>{expect(facilityAvailable(f,now)).toBe(true);expect(facilityAvailable(f,2*3600)).toBe(false);expect(facilityAvailable(f,now,{[f.id]:false})).toBe(false);});
 it("repeats hours after explicit service-day rollover",()=>expect(facilityAvailable(f,now+86400)).toBe(true));
 it("supports overnight operating windows",()=>{const night={...f,details:{...f.details!,hours:{opens:22*60,closes:6*60}}};expect(facilityAvailable(night,23*3600)).toBe(true);expect(facilityAvailable(night,3*3600)).toBe(true);expect(facilityAvailable(night,12*3600)).toBe(false);});
 it.each([-1,NaN,Infinity])("rejects invalid clock %s",n=>expect(facilityAvailable(f,n)).toBe(false));
 it("creates a pending stop with honest availability and visit duration",()=>{expect(toJourneyStop(f,now)).toMatchObject({id:f.id,nodeId:f.nodeId,dwellSeconds:180,available:true});expect(toJourneyStop(f,now,{[f.id]:false},0).available).toBe(false);});
});
