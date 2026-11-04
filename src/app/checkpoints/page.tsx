"use client";
import {useEffect,useMemo,useState} from "react";
import {Printer,TrainFront} from "lucide-react";
import {checkpoints,checkpointUrl} from "@/lib/positioning/checkpoints";
import {qrMatrix} from "@/lib/positioning/qr";
import {useLanguage} from "@/components/language-provider";
export default function CheckpointPrintPage(){
 const {t,name,floor}=useLanguage(),[origin,setOrigin]=useState(""),[all,setAll]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setOrigin(window.location.origin),0);return()=>clearTimeout(timer);},[]);
 const selected=useMemo(()=>all?checkpoints:checkpoints.filter(c=>["gate-2","west-b","west-b-1","p17-b-1","p17-destination","metro-west"].includes(c.nodeId)),[all]);
 return <main className="checkpoint-print-page"><header><a href="/demo" className="brand"><TrainFront size={25}/>railnavi</a><a href="/demo">{t("Back to navigation")}</a></header>
 <div className="print-intro"><div className="eyebrow">{t("FICTIONAL DEMO")}</div><h1>{t("Print demo checkpoints")}</h1><p>{t("QR checkpoints identify known fixed locations; they do not provide continuous live indoor tracking.")}</p>
 <p>{t("Checkpoint links open this app. Offline links work only after saving the station on that device.")}</p>
 <div className="print-actions"><button type="button" className="button button-primary" disabled={!origin} onClick={()=>window.print()}><Printer size={18}/>{t("Print checkpoints")}</button><label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>{t("Show all checkpoints")} ({checkpoints.length})</label></div></div>
 <div className="checkpoint-print-grid">{selected.map(c=>{
  const payload=origin?checkpointUrl(c,origin):c.payload,qr=qrMatrix(payload);
  return <article className="print-checkpoint" key={c.id} data-checkpoint-id={c.id}><div className="print-brand"><TrainFront size={20}/><strong>railnavi</strong><span>{t("FICTIONAL DEMO")}</span></div>
   <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={c.id+" QR"} shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="white"/><path d={qr.path} fill="#000"/></svg>
   <h2>{name(c.label)}</h2><p>{floor(c.floor)} · RailNavi Demo Central</p><code>{c.id}</code><p>{t("Scan with RailNavi or enter the checkpoint code.")}</p>
   {origin&&<a href={payload}>{t("Open checkpoint link")}</a>}
  </article>;
 })}</div></main>;
}
