import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {join,relative,sep} from "node:path";
import {createHash} from "node:crypto";
const root=process.cwd();
async function files(directory){
 const result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())result.push(...await files(path));else if(entry.isFile())result.push(path);}return result;
}
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const resources=[];
async function add(url,file,bucket){const bytes=await readFile(file);resources.push({url,bucket,bytes:bytes.length,sha256:hash(bytes)});}
for(const route of ["/","/demo","/ticket","/checkpoints"])await add(route,join(root,".next/server/app",route==="/"?"index.html":route.slice(1)+".html"),"shell");
for(const file of (await files(join(root,".next/static"))).sort())await add("/_next/static/"+relative(join(root,".next/static"),file).split(sep).join("/"),file,"static");
for(const resource of ["geometry","topology","facilities","checkpoints","locales","tickets","version"])await add("/station-data/"+resource,join(root,".next/server/app/station-data",resource+".body"),resource==="version"?"topology":resource);
await add("/manifest.webmanifest",join(root,".next/server/app/manifest.webmanifest.body"),"shell");
for(const icon of ["icon-192.png","icon-512.png","icon-180.png"])await add("/"+icon,join(root,"public",icon),"static");
const versionBody=JSON.parse(await readFile(join(root,".next/server/app/station-data/version.body"),"utf8"));
const index={schema:1,version:"build-"+hash(JSON.stringify(resources)).slice(0,20),stationVersion:versionBody.stationVersion,resources};
await mkdir(join(root,"public"),{recursive:true});
await writeFile(join(root,"public/offline-manifest.json"),JSON.stringify(index));
console.log("Offline index ready:",index.version,resources.length,"verified resources;",resources.reduce((n,r)=>n+r.bytes,0),"bytes");
