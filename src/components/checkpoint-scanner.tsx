"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Camera,MapPin,QrCode,X} from "lucide-react";
import {checkpoints,resolveCheckpoint,type Checkpoint} from "@/lib/positioning/checkpoints";
import {useLanguage} from "./language-provider";
export function CheckpointScanner({onClose,onConfirm,initial}:{onClose:()=>void;onConfirm:(checkpoint:Checkpoint,source:"qr"|"manual")=>void;initial?:Checkpoint}){
 const {t,name,floor}=useLanguage();
 const [input,setInput]=useState(""),[selected,setSelected]=useState(""),[candidate,setCandidate]=useState<Checkpoint|undefined>(initial),[source,setSource]=useState<"qr"|"manual">("qr"),[error,setError]=useState(""),[scanning,setScanning]=useState(false);
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),controls=useRef<{stop:()=>void}|null>(null),generation=useRef(0),seen=useRef("");
 const stop=useCallback(()=>{generation.current++;controls.current?.stop();controls.current=null;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;},[]);
 useEffect(()=>{const hide=()=>{if(document.hidden){stop();setScanning(false);}};document.addEventListener("visibilitychange",hide);return()=>{stop();document.removeEventListener("visibilitychange",hide);};},[stop]);
 const accept=useCallback((value:string,method:"qr"|"manual")=>{
  const result=resolveCheckpoint(value,window.location.origin,method==="manual");
  if(result.status!=="located"){setError(result.reason);return false;}
  stop();setScanning(false);setError("");setCandidate(result.checkpoint);setSource(method);return true;
 },[stop]);
 async function camera(){
  stop();const token=generation.current;setCandidate(undefined);setError("");setScanning(true);
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error("Camera unsupported");
   const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
   if(token!==generation.current){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;
   const {BrowserQRCodeReader}=await import("@zxing/browser");
   if(token!==generation.current){media.getTracks().forEach(track=>track.stop());return;}
   const reader=new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:250,delayBetweenScanSuccess:500});
   const active=await reader.decodeFromStream(media,video.current!,result=>{
    if(!result||token!==generation.current)return;const raw=result.getText();if(seen.current===raw)return;seen.current=raw;accept(raw,"qr");
   });
   if(token!==generation.current)active.stop();else controls.current=active;
  }catch{if(token===generation.current){stop();setScanning(false);setError("Camera unavailable or permission denied. Use a checkpoint code or select a location below.");}}
 }
 async function image(file:File|undefined){
  if(!file)return;stop();setScanning(false);setError("");if(file.size>5*1024*1024){setError("oversized");return;}
  const token=generation.current,url=URL.createObjectURL(file);
  try{const {BrowserQRCodeReader}=await import("@zxing/browser");const result=await new BrowserQRCodeReader().decodeFromImageUrl(url);if(token===generation.current)accept(result.getText(),"qr");}
  catch{if(token===generation.current)setError("malformed");}finally{URL.revokeObjectURL(url);}
 }
 return <div className="scanner-backdrop"><section className="checkpoint-sheet" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
  <button autoFocus type="button" className="utility-close" aria-label={t("Close scanner")} onClick={onClose}><X size={22}/></button>
  <div className="eyebrow">RAILNAVI · QR</div><h2 id="scanner-title">{t(candidate?"Confirm location":"Scan checkpoint")}</h2>
  <p>{t("QR checkpoints identify known fixed locations; they do not provide continuous live indoor tracking.")}</p>
  {!candidate?<><div className={"camera-stage "+(scanning?"camera-active":"")}><video ref={video} muted playsInline aria-label={t("Scanning…")}/>{!scanning&&<QrCode size={64}/>}<div className="scan-region" aria-hidden="true"/>{scanning&&<span role="status">{t("Scanning…")}</span>}</div>
   <p className="camera-explanation">{t("Camera permission is requested only when you open the camera. Images stay on this device.")}</p>
   <div className="scanner-actions"><button type="button" className="button button-primary" onClick={()=>{if(scanning){stop();setScanning(false);}else void camera();}}><Camera size={18}/>{t(scanning?"Stop camera":"Open camera")}</button><label className="image-decode">{t("Decode QR image")}<input type="file" accept="image/*" aria-label={t("Decode QR image")} onChange={e=>void image(e.target.files?.[0])}/></label></div>
   <form onSubmit={e=>{e.preventDefault();accept(input,"manual");}}><label htmlFor="checkpoint-input">{t("Checkpoint code or QR link")}</label><div className="checkpoint-entry"><input id="checkpoint-input" autoComplete="off" spellCheck={false} maxLength={512} placeholder="RN-GATE-2" value={input} onChange={e=>setInput(e.target.value)}/><button type="submit">{t("Check code")}</button></div></form>
   <label htmlFor="checkpoint-select">{t("Choose checkpoint")}</label><select id="checkpoint-select" value={selected} onChange={e=>{setSelected(e.target.value);if(e.target.value)accept(e.target.value,"manual");}}><option value="">—</option>{checkpoints.map(c=><option key={c.id} value={c.id}>{name(c.label)} · {floor(c.floor)} · {c.id}</option>)}</select>
  </>:<div className="checkpoint-confirmation"><MapPin size={35}/><small>{t(source==="qr"?"QR checkpoint":"Manual checkpoint")}</small><h3>{name(candidate.label)}</h3><p>{floor(candidate.floor)} · {candidate.id}</p><p>{t("Simulation stops when you confirm a checkpoint. Your platform and pending stops are preserved.")}</p><button type="button" className="button button-primary" onClick={()=>{stop();onConfirm(candidate,source);}}>{t("Use this location")}</button><button type="button" className="text-button" onClick={()=>{setCandidate(undefined);seen.current="";}}>{t("Scan checkpoint")}</button></div>}
  {error&&<p role="alert" className="checkpoint-error">{t(error)}</p>}
 </section></div>;
}
