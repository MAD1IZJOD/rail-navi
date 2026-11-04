import {it,expect,describe} from "vitest";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";
import {createHash,webcrypto} from "node:crypto";

const source=readFileSync(new URL("../public/sw.js",import.meta.url),"utf8");
const urls=["/","/demo","/ticket","/checkpoints","/manifest.webmanifest","/icon-192.png","/icon-512.png","/icon-180.png","/_next/static/app.js","/_next/static/app.css",...["geometry","topology","facilities","checkpoints","locales","tickets","version"].map(r=>"/station-data/"+r)];
function index(version="1"){
 return{schema:1,version:"build-"+version.repeat(20),stationVersion:"station-5-12345678",resources:urls.map(url=>{const body="public resource "+version+url;return{url,bytes:Buffer.byteLength(body),sha256:createHash("sha256").update(body).digest("hex"),bucket:url.startsWith("/station-data/")?url.endsWith("/version")?"topology":url.split("/").at(-1)!:url.startsWith("/_next/")||url.startsWith("/icon-")?"static":"shell"};})};
}
function harness(){
 const stores=new Map<string,Map<string,Response>>(),listeners=new Map<string,(event:MessageEvent)=>void>();
 let current=index(),failure="",quota=false,network=true;
 const key=(input:RequestInfo|URL)=>new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url,"https://demo.example").href;
 const caches={async open(name:string){if(!stores.has(name))stores.set(name,new Map());const items=stores.get(name)!;return{async match(input:RequestInfo|URL){return items.get(key(input))?.clone();},async put(input:RequestInfo|URL,response:Response){if(quota)throw new Error("QuotaExceededError");items.set(key(input),response.clone());}};},async keys(){return[...stores.keys()];},async delete(name:string){return stores.delete(name);}};
 const sandbox=createContext({URL,Response,Request,crypto:webcrypto,caches,Date,Uint8Array,console,self:{location:{origin:"https://demo.example"},addEventListener(type:string,handler:(event:MessageEvent)=>void){listeners.set(type,handler);},clients:{claim:async()=>{}},skipWaiting:async()=>{}},fetch:async(input:RequestInfo|URL)=>{
  if(!network)throw new Error("offline");const path=new URL(key(input)).pathname;
  if(path==="/offline-manifest.json")return Response.json(current);
  if(path===failure)return new Response("failed",{status:503});
  return new Response("public resource "+current.version.at(-1)+path);
 }});
 runInContext(source+"\nglobalThis.api={validManifest,status,save,cached};",sandbox);
 const api=sandbox.api as {validManifest:(m:unknown)=>boolean;status:()=>Promise<{ready:boolean;version?:string}>;save:(port:{postMessage:(v:unknown)=>void})=>Promise<{ready:boolean}>;cached:(path:string)=>Promise<Response|null>};
 return{api,stores,listeners,save:()=>api.save({postMessage(){}}),setFailure:(path:string)=>{failure=path;},setQuota:(v:boolean)=>{quota=v;},setNetwork:(v:boolean)=>{network=v;},setVersion:(v:string)=>{current=index(v);},index:()=>current};
}
describe("verified offline station downloads",()=>{
 it("is not ready before a complete explicit download",async()=>expect(await harness().api.status()).toEqual({ready:false,version:undefined,stationVersion:undefined,savedAt:undefined}));
 it("verifies all resources and serves the app shell without the network",async()=>{
  const h=harness();expect((await h.save()).ready).toBe(true);expect((await h.api.status()).ready).toBe(true);h.setNetwork(false);
  expect(await(await h.api.cached("/demo"))?.text()).toBe("public resource 1/demo");
  expect(await h.api.cached("/not-saved")).toBeNull();
 });
 it.each(["/station-data/topology","/_next/static/app.js","/ticket"])("cleans partial downloads when %s fails",async path=>{
  const h=harness();h.setFailure(path);await expect(h.save()).rejects.toThrow();expect((await h.api.status()).ready).toBe(false);expect([...h.stores.keys()].filter(k=>k!=="railnavi-v1-metadata")).toEqual([]);
  h.setFailure("");expect((await h.save()).ready).toBe(true);
 });
 it("does not claim readiness after quota failure",async()=>{const h=harness();h.setQuota(true);await expect(h.save()).rejects.toThrow();expect((await h.api.status()).ready).toBe(false);});
 it("rejects resource corruption before committing metadata",async()=>{const h=harness();h.index().resources[0]!.sha256="0".repeat(64);await expect(h.save()).rejects.toThrow("integrity");expect((await h.api.status()).ready).toBe(false);});
 it("rechecks cached bytes and detects browser eviction",async()=>{
  const h=harness();await h.save();for(const [name,store]of h.stores)if(name.endsWith("-geometry"))store.clear();expect((await h.api.status()).ready).toBe(false);
 });
 it("keeps the old complete download after a failed update",async()=>{
  const h=harness();await h.save();h.setVersion("2");h.setFailure("/station-data/checkpoints");await expect(h.save()).rejects.toThrow();expect(await h.api.status()).toMatchObject({ready:true,version:"build-"+"1".repeat(20)});
 });
 it("updates atomically and removes caches older than the current/previous pair",async()=>{
  const h=harness();await h.save();h.setVersion("2");await h.save();h.setVersion("3");await h.save();
  expect(await h.api.status()).toMatchObject({ready:true,version:"build-"+"3".repeat(20)});expect([...h.stores.keys()].some(k=>k.includes("build-"+"1".repeat(20)))).toBe(false);
  expect([...h.stores.keys()].some(k=>k.includes("build-"+"2".repeat(20)))).toBe(true);
 });
 it.each(["/demo","/station-data/locales","/station-data/topology","/icon-512.png","/_next/static/app.js","/_next/static/app.css"])("rejects a supposedly complete manifest missing %s",path=>{
  const h=harness(),m=h.index();m.resources=m.resources.filter(r=>r.url!==path);expect(h.api.validManifest(m)).toBe(false);
 });
 it.each(["https://evil.example/x","//evil.example/x","/../secret","/_next/static/../secret.js","/_next/static/file.js?token=x"])("rejects arbitrary cache URL %s",url=>{
  const h=harness();h.index().resources.push({...h.index().resources[0]!,url});expect(h.api.validManifest(h.index())).toBe(false);
 });
 it("rejects duplicates, wrong buckets and unsupported versions",()=>{
  const h=harness(),m=h.index();expect(h.api.validManifest(m)).toBe(true);expect(h.api.validManifest({...m,schema:2})).toBe(false);expect(h.api.validManifest({...m,resources:[...m.resources,m.resources[0]]})).toBe(false);m.resources[0]!.bucket="static";expect(h.api.validManifest(m)).toBe(false);
 });
});
