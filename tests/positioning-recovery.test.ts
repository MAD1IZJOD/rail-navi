import {describe,it,expect} from "vitest";
import {BarcodeFormat,QRCodeReader,QRCodeWriter,RGBLuminanceSource,BinaryBitmap,HybridBinarizer} from "@zxing/library";
import {checkpoints,checkpointUrl,resolveCheckpoint} from "../src/lib/positioning/checkpoints";
import {qrMatrix} from "../src/lib/positioning/qr";
import {manualPositioningProvider,qrPositioningProvider,simulationPositioningProvider} from "../src/lib/positioning/manual";
import {demoStation as station} from "../src/lib/station/demo-station";
import {STATION_VERSION} from "../src/lib/station/version";
import {findRoute} from "../src/lib/navigation/engine";
import {parseJourney,writeJourney,type SavedJourney} from "../src/lib/journey/recovery";
import {duration,localFloor,renderInstruction,translate} from "../src/lib/i18n/messages";
import {interpretQuery} from "../src/lib/facilities/search";

const origin="https://demo.example",gate=checkpoints.find(c=>c.nodeId==="gate-2")!;
function saved():SavedJourney{return{schema:1,stationId:station.id,stationVersion:STATION_VERSION,language:"hi",origin:"checkpoint:"+gate.id,confirmedSource:"qr",destination:"p17-destination",trainId:"",preference:"wheelchair",stops:[],nowSeconds:71700,buffer:300,bridgeClosed:false,liftsClosed:false,crossingOutage:"",availability:{},trainChanges:{},wasSimulating:true};}
describe("fixed checkpoint network and untrusted QR inputs",()=>{
 it("covers every entrance and platform across all five floors",()=>{
  expect(checkpoints.length).toBeGreaterThanOrEqual(40);expect(new Set(checkpoints.map(c=>c.id)).size).toBe(checkpoints.length);
  expect([...new Set(checkpoints.map(c=>c.floor))].sort()).toEqual([-1,-2,0,1,2].sort());
  for(const item of [...station.entrances,...station.platforms])expect(checkpoints.some(c=>c.nodeId===item.nodeId)).toBe(true);
 });
 it.each(checkpoints)("$id has a reachable real anchor and round-trips both payloads",c=>{
  expect(station.nodes.find(n=>n.id===c.nodeId)?.floor).toBe(c.floor);
  expect(findRoute(station,"gate-2",c.nodeId).status).toBe("available");
  expect(resolveCheckpoint(c.payload,origin)).toEqual({status:"located",checkpoint:c});
  expect(resolveCheckpoint(checkpointUrl(c,origin),origin)).toEqual({status:"located",checkpoint:c});
 });
 it.each([
  null,42,{},"", " ","javascript:alert(1)","data:text/plain,anything","https://evil.example/demo?v=1&station="+station.id+"&checkpoint="+gate.id,
  "railnavi://checkpoint/v2/"+station.id+"/"+gate.id,"railnavi://checkpoint/v1/other/"+gate.id,
  "railnavi://checkpoint/v1/"+station.id+"/RN-NOT-REAL",gate.payload+"?redirect=https://evil.example",gate.payload+"#fragment",
  "railnavi://user:pass@checkpoint/v1/"+station.id+"/"+gate.id,gate.payload.replace("checkpoint/","CHECKPOINT/"),"x".repeat(513),gate.payload+"\u0000",
  checkpointUrl(gate,origin)+"&checkpoint="+gate.id,checkpointUrl(gate,origin)+"&redirect=https://evil.example",
  checkpointUrl(gate,origin).replace("/demo?","/other?"),checkpointUrl(gate,origin).replace("v=1","v=2"),
 ])("rejects unsafe or invalid input %#",value=>expect(resolveCheckpoint(value,origin).status).toBe("invalid"));
 it("accepts a manual code only through the explicit manual fallback",()=>{
  expect(resolveCheckpoint(gate.id,origin).status).toBe("invalid");expect(resolveCheckpoint(gate.id,origin,true).status).toBe("located");
 });
 it("decodes actual printed QR pixels back to the original deep link",()=>{
  const value=checkpointUrl(gate,origin),matrix=new QRCodeWriter().encode(value,BarcodeFormat.QR_CODE,360,360),pixels=new Uint8ClampedArray(360*360);
  for(let y=0;y<360;y++)for(let x=0;x<360;x++)pixels[y*360+x]=matrix.get(x,y)?0:255;
  const decoded=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,360,360))));
  expect(decoded.getText()).toBe(value);expect(qrMatrix(value).path).toContain("h1v1h-1z");
 });
 it("rejects empty and oversized QR generation",()=>{expect(()=>qrMatrix("")).toThrow();expect(()=>qrMatrix("a".repeat(513))).toThrow();});
 it("distinguishes manual, scanned, and simulated fixes",async()=>{
  for(const [provider,input,source]of [[manualPositioningProvider,"checkpoint:"+gate.id,"manual"],[qrPositioningProvider(origin),gate.payload,"qr"],[simulationPositioningProvider,gate.nodeId,"simulation"]]as const){
   const r=await provider.locate(station,input);expect(r.status).toBe("located");if(r.status==="located"){expect(r.position.source).toBe(source);expect(r.position.nodeId).toBe(gate.nodeId);}
  }
  expect((await simulationPositioningProvider.locate(station,"invented-node")).status).toBe("unknown");
  expect((await qrPositioningProvider(origin).locate(station,"https://evil.example")).status).toBe("unknown");
 });
});
describe("minimal validated journey recovery",()=>{
 it("restores only explicit confirmed state, never interpolated progress or passenger identity",()=>{
  const result=parseJourney(JSON.stringify({...saved(),passengerName:"Do not store",pnr:"Do not store",simulatedProgress:99}));
  expect(result.status).toBe("valid");if(result.status==="valid"){expect(result.journey).toEqual(saved());expect(Object.keys(result.journey)).not.toContain("pnr");}
 });
 it.each([null,undefined,""])("handles an empty store %#",raw=>expect(parseJourney(raw).status).toBe("empty"));
 it.each(["{", "[]", "null", "x".repeat(20001),42])("rejects corrupted storage %#",raw=>expect(parseJourney(raw).status).toBe("invalid"));
 it.each([
  {language:"xx"},{origin:"checkpoint:RN-GONE"},{origin:"gate-2",confirmedSource:"qr"},{destination:"not-a-node"},{trainId:"missing"},{preference:"teleport"},
  {nowSeconds:-1},{nowSeconds:Infinity},{buffer:0},{bridgeClosed:"false"},{liftsClosed:1},{wasSimulating:"yes"},{crossingOutage:"imaginary bridge"},
  {stops:[{id:"not-a-facility",dwellSeconds:20}]},{stops:[{id:station.facilities[0]!.id,dwellSeconds:-1}]},
  {availability:{missing:true}},{availability:{[station.facilities[0]!.id]:"true"}},{trainChanges:{missing:{platformId:"platform-1",departure:"20:00"}}},{offlineVersion:"../evil"},
 ])("rejects invalid persisted fields %#",patch=>expect(parseJourney(JSON.stringify({...saved(),...patch})).status).toBe("invalid"));
 it.each([{schema:0},{stationVersion:"old"},{stationId:"another-station"}])("invalidates incompatible data %#",patch=>expect(parseJourney(JSON.stringify({...saved(),...patch})).status).toBe("incompatible"));
 it("catches storage failure without claiming success",()=>{expect(writeJourney({setItem(){throw new Error("quota");}},saved())).toBe(false);});
 it("serializes a validated journey",()=>{let value="";expect(writeJourney({setItem(_key,raw){value=raw;}},saved())).toBe(true);expect(parseJourney(value).status).toBe("valid");});
});
describe("structured bilingual navigation",()=>{
 it.each(["fastest","shortest","wheelchair","avoid-stairs"]as const)("renders every %s instruction without English sentence replacement",preference=>{
  const route=findRoute(station,"gate-2","p17-destination",{preference});expect(route.status).toBe("available");
  for(const step of route.instructions){expect(step.action).toBeDefined();expect(renderInstruction({...step,text:"UNTRUSTED ENGLISH SENTENCE"},"hi")).toMatch(/[\u0900-\u097f]/);expect(renderInstruction(step,"en")).toBe(step.text);}
  if(preference==="wheelchair")expect(route.edges.some(e=>e.kind==="stairs"||e.kind==="escalator")).toBe(false);
 });
 it("formats zero duration and floors",()=>{expect(duration(0,"hi")).toBe("0 मिनट");expect(localFloor(1,"hi")).toBe("स्तर +1");expect(translate("Scan checkpoint","hi")).toBe("चेकपॉइंट स्कैन करें");});
 it.each([["रास्ते में पानी","water",true],["प्लेटफ़ॉर्म १२ के पास कॉफ़ी","tea",false],["सुलभ शौचालय","washroom",false]]as const)("interprets supported Hindi intent %s",(query,category,onWay)=>{
  const result=interpretQuery(query);expect(result.supported).toBe(true);expect(result.category).toBe(category);expect(result.onWay).toBe(onWay);
  if(query.includes("१२"))expect(result.platform).toBe(12);if(query.includes("सुलभ"))expect(result.accessible).toBe(true);
 });
});
