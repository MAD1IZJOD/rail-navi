"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {Download,Menu,Wifi,WifiOff,X,Smartphone,RefreshCw} from "lucide-react";
import {useLanguage,LanguageControl,LANGUAGE_KEY} from "./language-provider";
import {useDialog} from "./use-dialog";
import {JOURNEY_KEY} from "@/lib/journey/recovery";
interface DownloadState{ready:boolean;version?:string;stationVersion?:string;savedAt?:number}
interface InstallEvent extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>}
const PwaContext=createContext({offline:false,download:{ready:false} as DownloadState});
export const usePwa=()=>useContext(PwaContext);
function rpc(worker:ServiceWorker,type:string,onProgress?:(done:number,total:number)=>void):Promise<DownloadState>{
 return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error("Offline timeout"));},180000);
 channel.port1.onmessage=event=>{if(event.data.progress){onProgress?.(event.data.progress,event.data.total);return;}clearTimeout(timer);channel.port1.close();if(event.data.error)reject(new Error("Offline operation failed"));else resolve(event.data.result);};
 worker.postMessage({type},[channel.port2]);});
}
export function PwaProvider({children}:{children:ReactNode}){
 const {t,setLanguage}=useLanguage();
 const [open,setOpen]=useState(false),[offline,setOffline]=useState(false),[supported,setSupported]=useState(false),[checking,setChecking]=useState(true),[saving,setSaving]=useState(false);
 const [download,setDownload]=useState<DownloadState>({ready:false}),[progress,setProgress]=useState(0),[error,setError]=useState(""),[update,setUpdate]=useState(false),[appUpdate,setAppUpdate]=useState(false);
 const [installed,setInstalled]=useState(false),[canInstall,setCanInstall]=useState(false),[ios,setIos]=useState(false),[notice,setNotice]=useState("");
 const dialog=useDialog(open);
 const registration=useRef<ServiceWorkerRegistration|null>(null),installEvent=useRef<InstallEvent|null>(null);
 const refresh=useCallback(async()=>{
  const active=registration.current?.active;if(!active)return;
  try{const state=await rpc(active,"STATUS");setDownload(state);if(navigator.onLine){const res=await fetch("/offline-manifest.json",{cache:"no-store"});if(res.ok){const index=await res.json();setUpdate(!!state.ready&&index.version!==state.version);}}}catch{setError("Offline download failed. Try again with a connection and available storage.");}finally{setChecking(false);}
 },[]);
 useEffect(()=>{
  let alive=true;
  const network=()=>{setOffline(!navigator.onLine);if(navigator.onLine)void refresh();};
  const timer=setTimeout(()=>{network();setIos(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);setInstalled(window.matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);},0);
  const prompt=(event:Event)=>{event.preventDefault();installEvent.current=event as InstallEvent;setCanInstall(true);};
  const confirm=()=>{setInstalled(true);setCanInstall(false);installEvent.current=null;};
  const controller=()=>{void refresh();};
  window.addEventListener("online",network);window.addEventListener("offline",network);window.addEventListener("beforeinstallprompt",prompt);window.addEventListener("appinstalled",confirm);
  if("serviceWorker" in navigator&&window.isSecureContext&&process.env.NODE_ENV==="production"){
   void navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(async reg=>{
    await navigator.serviceWorker.ready;if(!alive)return;registration.current=reg;setSupported(true);setAppUpdate(!!reg.waiting);
    reg.addEventListener("updatefound",()=>reg.installing?.addEventListener("statechange",()=>{if(reg.waiting)setAppUpdate(true);}));
    await refresh();
   }).catch(()=>{if(alive){setChecking(false);setError("Offline downloads require a production build and a secure connection.");}});
   navigator.serviceWorker.addEventListener("controllerchange",controller);
  }else setTimeout(()=>setChecking(false),0);
  return()=>{alive=false;clearTimeout(timer);window.removeEventListener("online",network);window.removeEventListener("offline",network);window.removeEventListener("beforeinstallprompt",prompt);window.removeEventListener("appinstalled",confirm);if("serviceWorker" in navigator)navigator.serviceWorker.removeEventListener("controllerchange",controller);};
 },[refresh]);
 async function save(){
  const worker=registration.current?.active;if(!worker)return;
  setSaving(true);setError("");setProgress(0);
  try{try{void navigator.storage?.persist?.().catch(()=>{});}catch{}const state=await rpc(worker,"SAVE",(done,total)=>setProgress(Math.round(done/total*100)));setDownload(state);setUpdate(false);setNotice("Download complete");}
  catch{setError("Offline download failed. Try again with a connection and available storage.");await refresh();}
  finally{setSaving(false);}
 }
 async function install(){
  const event=installEvent.current;if(!event)return;
  await event.prompt();const choice=await event.userChoice;setCanInstall(false);installEvent.current=null;
  if(choice.outcome==="dismissed")setNotice("Installation was not confirmed.");
 }
 async function clear(){
  if(saving)return;setError("");
  try{if(registration.current?.active)await rpc(registration.current.active,"CLEAR");localStorage.removeItem(JOURNEY_KEY);localStorage.removeItem(LANGUAGE_KEY);setLanguage("en");localStorage.removeItem(LANGUAGE_KEY);setDownload({ready:false});setUpdate(false);setNotice("Saved RailNavi data cleared.");window.dispatchEvent(new Event("railnavi:clear"));}
  catch{setError("Offline download failed. Try again with a connection and available storage.");}
 }
 return <PwaContext.Provider value={{offline,download}}>
  <div className="app-utility"><LanguageControl/><button type="button" aria-label={t("Station & app")} onClick={()=>setOpen(true)}><Menu size={19}/><span>{t("Station & app")}</span>{download.ready&&<i aria-label={t("Available offline")}/>}</button></div>
  {children}
  {offline&&<div className="offline-ribbon" role="status"><WifiOff size={14}/>{t("Offline")} · {t("Fictional local assignments · Offline information is not live railway information.")}</div>}
  {open&&<div className="utility-backdrop" onClick={()=>setOpen(false)}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="station-app-title" className="utility-sheet" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);}}>
   <button autoFocus type="button" className="utility-close" aria-label={t("Close")} onClick={()=>setOpen(false)}><X size={21}/></button>
   <div className="eyebrow">RAILNAVI</div><h2 id="station-app-title">{t("Station & app")}</h2>
   <p className="network-status">{offline?<WifiOff size={17}/>:<Wifi size={17}/>} {t(offline?"Offline":"Online")}</p>
   <section className="offline-card"><Download size={25}/><h3>{t(checking?"Checking download…":download.ready?"Available offline":"Save Station Offline")}</h3>
    <p>{t("Fictional local assignments · Offline information is not live railway information.")}</p>
    {download.ready&&<p data-testid="offline-version">{t("Saved version")}: <b>{download.version}</b></p>}
    {download.savedAt&&<small>{new Date(download.savedAt).toLocaleString()}</small>}
    {update&&<p>{t("Update available")}</p>}
    <button type="button" className="button button-primary" disabled={!supported||saving||offline} onClick={()=>void save()}>{saving?t("Saving station…")+" "+progress+"%":t(update?"Download update":"Save Station Offline")}</button>
    {saving&&<progress max="100" value={progress} aria-label={t("Saving station…")}/>}
    <small>{t("Offline resources can be removed by your browser. Recheck the download before relying on it.")}</small>
    {!supported&&!checking&&<p>{t("Offline downloads require a production build and a secure connection.")}</p>}
   </section>
   <section className="install-card"><Smartphone size={24}/><h3>{t(installed?"Installed":"Install RailNavi")}</h3>
    {canInstall&&!installed&&<button type="button" className="button" onClick={()=>void install()}>{t("Install RailNavi")}</button>}
    {!installed&&<p>{t(ios?"iPhone / iPad: open in Safari, tap Share, then Add to Home Screen.":"Android / desktop: use your browser menu and choose Install app or Add to Home screen when available.")}</p>}
   </section>
   {appUpdate&&<button type="button" disabled={saving} className="text-button" onClick={()=>{const waiting=registration.current?.waiting;if(!waiting)return;navigator.serviceWorker.addEventListener("controllerchange",()=>window.location.reload(),{once:true});waiting.postMessage({type:"ACTIVATE"});}}><RefreshCw size={16}/>{t("Reload to update app")}</button>}
   <a href="/checkpoints" className="text-button">{t("Print demo checkpoints")}</a>
   <button type="button" className="clear-data" disabled={saving} onClick={()=>void clear()}>{t("Clear saved RailNavi data")}</button>
   {notice&&<p role="status">{t(notice)}</p>}{error&&<p role="alert">{t(error)}</p>}
  </section></div>}
 </PwaContext.Provider>;
}
