"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {MapPin} from "lucide-react";
import {JOURNEY_KEY,parseJourney,writeJourney,type RecoveryResult,type SavedJourney} from "@/lib/journey/recovery";
import {useDialog} from "./use-dialog";
import {useLanguage} from "./language-provider";
export function useJourneyRecovery(snapshot:SavedJourney|null,onRecover:(saved:SavedJourney)=>void,onFresh:()=>void){
 const [result,setResult]=useState<RecoveryResult>({status:"empty"}),[ready,setReady]=useState(false),[error,setError]=useState("");
 const latest=useRef({snapshot,onRecover,onFresh,ready});
 useEffect(()=>{latest.current={snapshot,onRecover,onFresh,ready};},[snapshot,onRecover,onFresh,ready]);
 useEffect(()=>{const timer=setTimeout(()=>{try{const found=parseJourney(localStorage.getItem(JOURNEY_KEY));setResult(found);if(found.status==="empty")setReady(true);}catch{setError("Storage unavailable. Your journey cannot be saved on this device.");setReady(true);}},0);return()=>clearTimeout(timer);},[]);
 const persist=useCallback(()=>{const current=latest.current;if(!current.ready||!current.snapshot)return;try{if(!writeJourney(localStorage,current.snapshot))setError("Storage unavailable. Your journey cannot be saved on this device.");}catch{setError("Storage unavailable. Your journey cannot be saved on this device.");}},[]);
 const serialized=JSON.stringify(snapshot);
 useEffect(()=>{if(!ready)return;const timer=setTimeout(persist,350);return()=>clearTimeout(timer);},[serialized,ready,persist]);
 useEffect(()=>{const timer=setInterval(persist,1500);window.addEventListener("pagehide",persist);return()=>{clearInterval(timer);window.removeEventListener("pagehide",persist);persist();};},[persist]);
 const accept=()=>{if(result.status!=="valid")return;setResult({status:"empty"});setReady(true);latest.current.onRecover(result.journey);};
 const fresh=()=>{try{localStorage.removeItem(JOURNEY_KEY);}catch{}setResult({status:"empty"});setReady(true);latest.current.onFresh();};
 return{result,ready,error,accept,fresh};
}
export function RecoveryPrompt({result,onResume,onFresh}:{result:RecoveryResult;onResume:()=>void;onFresh:()=>void}){
 const {t}=useLanguage();const dialog=useDialog(result.status!=="empty");if(result.status==="empty")return null;
 return <div className="recovery-backdrop"><section ref={dialog} tabIndex={-1} className="recovery-sheet" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><MapPin size={34}/><div className="eyebrow">RAILNAVI</div><h2 id="recovery-title">{t(result.status==="valid"?"Saved journey found":result.status==="incompatible"?"Station data changed. Confirm a location before continuing.":"Saved journey could not be restored. Choose a new location.")}</h2>
 {result.status==="valid"&&<><p>{t("Resume from your last confirmed checkpoint. No movement is inferred while the app was closed.")}</p>{result.journey.wasSimulating&&<p>{t("Previous simulation will not resume automatically.")}</p>}<button autoFocus type="button" className="button button-primary" onClick={onResume}>{t("Resume Journey")}</button></>}
 <button type="button" className="button button-secondary" onClick={onFresh}>{t("Start Fresh")}</button></section></div>;
}
