/* RailNavi offline protocol 1. Only public synthetic station resources are cached. */
const PREFIX="railnavi-v1-",META=PREFIX+"metadata",READY=new URL("/__railnavi_ready__",self.location.origin).href;
const buckets=new Set(["shell","static","geometry","topology","facilities","checkpoints","locales","tickets"]);
let saving=false;
function validManifest(m){
 return m&&m.schema===1&&/^build-[a-f0-9]{20}$/.test(m.version)&&/^station-5-[a-f0-9]{8}$/.test(m.stationVersion)&&Array.isArray(m.resources)&&m.resources.length>10&&m.resources.length<2000&&
 new Set(m.resources.map(r=>r.url)).size===m.resources.length&&m.resources.reduce((n,r)=>n+r.bytes,0)<100*1024*1024&&
 m.resources.every(r=>buckets.has(r.bucket)&&typeof r.url==="string"&&r.url.startsWith("/")&&!r.url.startsWith("//")&&!/[?#\\]/.test(r.url)&&
 (["/","/demo","/ticket","/checkpoints","/manifest.webmanifest","/icon-192.png","/icon-512.png","/icon-180.png"].includes(r.url)||/^\/_next\/static\/[a-zA-Z0-9_./%-]+$/.test(r.url)||/^\/station-data\/(geometry|topology|facilities|checkpoints|locales|tickets|version)$/.test(r.url))&&
 !r.url.includes("..")&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<30*1024*1024&&/^[a-f0-9]{64}$/.test(r.sha256));
}
async function checksum(response){const bytes=await response.clone().arrayBuffer(),digest=await crypto.subtle.digest("SHA-256",bytes);return{bytes:bytes.byteLength,hash:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")};}
async function metadata(){const cache=await caches.open(META),r=await cache.match(READY);if(!r)return null;try{const v=await r.json();return validManifest(v.manifest)&&typeof v.base==="string"&&v.base.startsWith(PREFIX)?v:null;}catch{return null;}}
async function complete(value){
 if(!value)return false;
 for(const r of value.manifest.resources){const cache=await caches.open(value.base+"-"+r.bucket),response=await cache.match(r.url);if(!response)return false;const got=await checksum(response);if(got.hash!==r.sha256||got.bytes!==r.bytes)return false;}
 return true;
}
async function status(){const value=await metadata();return{ready:await complete(value),version:value?.manifest.version,stationVersion:value?.manifest.stationVersion,savedAt:value?.savedAt};}
async function save(port){
 if(saving)throw new Error("Download already running");
 saving=true;let base;
 try{
  const response=await fetch("/offline-manifest.json",{cache:"no-store",redirect:"error"});
  if(!response.ok)throw new Error("Offline index unavailable");
  const manifest=await response.json();if(!validManifest(manifest))throw new Error("Invalid offline index");
  const previous=await metadata();base=PREFIX+manifest.version+"-"+crypto.randomUUID();
  let done=0;
  for(const resource of manifest.resources){
   const r=await fetch(resource.url,{cache:"no-store",redirect:"error",headers:{Accept:resource.bucket==="shell"&&resource.url!=="/manifest.webmanifest"?"text/html":"*/*"}});
   if(!r.ok||r.type==="opaque")throw new Error("Resource unavailable");
   const actual=await checksum(r);if(actual.hash!==resource.sha256||actual.bytes!==resource.bytes)throw new Error("Resource integrity mismatch");
   const cache=await caches.open(base+"-"+resource.bucket);await cache.put(resource.url,r);
   port.postMessage({progress:++done,total:manifest.resources.length});
  }
  const value={manifest,base,savedAt:Date.now(),previous:previous?{base:previous.base,manifest:previous.manifest}:undefined};
  if(!await complete(value))throw new Error("Download verification failed");
  const meta=await caches.open(META);await meta.put(READY,new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}}));
  // A complete current/previous pair is kept for tabs using the preceding app shell.
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==META&&!key.startsWith(base+"-")&&!(previous&&key.startsWith(previous.base+"-")))await caches.delete(key);
  return{ready:true,version:manifest.version,stationVersion:manifest.stationVersion,savedAt:value.savedAt};
 }catch(error){if(base)for(const key of await caches.keys())if(key.startsWith(base+"-"))await caches.delete(key);throw error;}
 finally{saving=false;}
}
self.addEventListener("install",()=>{/* New worker waits; activation is an explicit user action. */});
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
 if(!event.source||new URL(event.source.url).origin!==self.location.origin)return;
 if(event.data?.type==="ACTIVATE"){event.waitUntil(self.skipWaiting());return;}
 const port=event.ports[0];if(!port)return;
 event.waitUntil((async()=>{
  try{
   if(event.data?.type==="STATUS")port.postMessage({result:await status()});
   else if(event.data?.type==="SAVE")port.postMessage({result:await save(port)});
   else if(event.data?.type==="CLEAR"){
    if(saving)throw new Error("Download in progress");
    for(const key of await caches.keys())if(key.startsWith(PREFIX))await caches.delete(key);
    port.postMessage({result:{ready:false}});
   }else throw new Error("Unknown offline action");
  }catch{port.postMessage({error:"Offline operation failed"});}
 })());
});
async function cached(url){
 const value=await metadata();if(!value)return null;
 for(const snapshot of [value,value.previous].filter(Boolean)){
  const resource=snapshot.manifest.resources.find(r=>r.url===url);
  if(resource){const cache=await caches.open(snapshot.base+"-"+resource.bucket),r=await cache.match(url);if(r)return r;}
 }
 return null;
}
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname==="/sw.js"||url.pathname==="/offline-manifest.json")return;
 if(request.mode==="navigate"){
  const path=url.pathname.replace(/\/$/,"")||"/";
  if(!["/","/demo","/ticket","/checkpoints"].includes(path))return;
  event.respondWith((async()=>{try{return await fetch(request);}catch{return await cached(path)||new Response("<!doctype html><html lang='en'><meta name='viewport' content='width=device-width'><title>RailNavi offline</title><body><h1>Station not saved offline</h1><p>Connect and choose Save Station Offline first.</p><p lang='hi'>पहले इंटरनेट से जुड़कर स्टेशन ऑफ़लाइन सहेजें।</p></body></html>",{status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});}})());
 }else if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/station-data/")||/^\/icon-(180|192|512)\.png$/.test(url.pathname)||url.pathname==="/manifest.webmanifest"){
  event.respondWith((async()=>{
   if(url.pathname.startsWith("/station-data/"))try{return await fetch(request);}catch{/* Use explicitly downloaded data only. */}
   const match=await cached(url.pathname);return match||fetch(request);
  })());
 }
});
