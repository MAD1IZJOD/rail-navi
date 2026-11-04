"use client";
import {useState} from "react";
import {Pause,Play,RotateCcw,SkipForward,Square,MapPin} from "lucide-react";
import type {GeneratedRoute,RoutingOptions,Station} from "@/lib/navigation/types";

import {deviationChoices,sessionGuidance} from "@/lib/navigation/simulator";
import type {SimulationController} from "./use-navigation-simulation";
import {useLanguage} from "./language-provider";
import {simulationMessage} from "@/lib/i18n/simulation";
interface Props{controller:SimulationController;route:GeneratedRoute|null;station:Station;options:RoutingOptions;onBridge:(closed:boolean)=>void;onLifts:(closed:boolean)=>void;bridgeClosed:boolean;liftsClosed:boolean;crossingOutage:string;onCrossing:(name:string)=>void}
export function SimulationControls({controller:c,route,station,options,onBridge,onLifts,bridgeClosed,liftsClosed,crossingOutage,onCrossing}:Props){
 const {t,name,language,floor:displayFloor,distance,duration}=useLanguage();
 const [alternative,setAlternative]=useState("");
 const s=c.session,g=s&&sessionGuidance(s);
 if(!s)return route?.status==="available"?<div className="simulation-launch"><button className="button button-primary" onClick={()=>c.start(route,options)}><Play size={17}/>{t("Start simulated navigation")}</button><small>{t("Deterministic demo · Not indoor positioning")}</small></div>:null;
 const choices=deviationChoices(s,station);
 const routeLiftIds=new Set(route?.edges.filter(e=>e.kind==="lift").map(e=>e.id.split("::")[0]));
 const relevantLifts=station.edges.filter(e=>e.kind==="lift"&&(routeLiftIds.has(e.id)||crossingOutage==="lift:"+e.id));
 return <section className="simulation-console" data-revision={s.revision} aria-label={t("Navigation simulation")}>
 <div className="simulation-primary"><span className="simulation-label"><MapPin size={14}/>{t("SIMULATION · ")}<b data-testid="simulation-status" data-state={s.status}>{t(s.status)}</b></span>
 {s.status==="at-stop"&&<button onClick={c.continueVisit}>{t("Continue after visit")}</button>}
 {s.status==="running"?<button onClick={c.pause}><Pause size={16}/>{t("Pause")}</button>:s.status==="paused"?<button onClick={c.resume}><Play size={16}/>{t("Resume")}</button>:null}
 <button onClick={c.step} disabled={s.status==="arrived"||s.status==="blocked"||s.status==="at-stop"} aria-label={t("Next decision point")}><SkipForward size={17}/><span>{t("Next point")}</span></button>
 <button onClick={c.stop} aria-label={t("Stop navigation")}><Square size={16}/></button></div>
 <p className="simulation-feedback" role="status">{simulationMessage(s,language)}</p>
 {g&&<div className="simulation-progress"><progress aria-label={t("Route progress")} max="1" value={g.progress}/><span>{distance(g.remainingDistance)} {t("remaining")} · {duration(g.remainingSeconds)}</span></div>}
 <details className="advanced-simulation"><summary>{t("Demo controls")}</summary><div><strong>{t("Simulation Controls — Fictional Data")}</strong>
 <label>{t("Simulation speed")}<select aria-label={t("Simulation speed")} value={s.speed} onChange={e=>c.speed(Number(e.target.value))}>{[1,5,20,60,120].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
 <button onClick={c.restart}><RotateCcw size={15}/>{t("Restart journey")}</button>
 <label className="check-control"><input type="checkbox" checked={bridgeClosed} onChange={e=>onBridge(e.target.checked)}/>{t("Close Bridge A")}</label>
 <label>{t("Crossing or individual lift outage")}<select aria-label={t("Crossing outage")} value={crossingOutage} onChange={e=>onCrossing(e.target.value)}><option value="">{t("All other crossings available")}</option>{station.geometry?.regions.filter(r=>(r.kind==="bridge"||r.kind==="underpass")&&r.name!=="Foot Overbridge A").map(r=><option key={r.id} value={r.name}>{name(r.name)}</option>)}<optgroup label="Lifts on this journey">{relevantLifts.map(e=><option key={e.id} value={"lift:"+e.id}>{name(e.label)} · {displayFloor(station.nodes.find(n=>n.id===e.from)!.floor)} ↔ {displayFloor(station.nodes.find(n=>n.id===e.to)!.floor)}{t(" lift unavailable")}</option>)}</optgroup></select></label>
 <label className="check-control"><input type="checkbox" checked={liftsClosed} onChange={e=>onLifts(e.target.checked)}/>{t("Simulate all lifts unavailable")}</label>
 <label>{t("Wrong turn at a decision point")}<select aria-label={t("Alternative connection")} value={choices.includes(alternative)?alternative:""} disabled={!choices.length} onChange={e=>setAlternative(e.target.value)}><option value="">{t("Choose a permitted alternative")}</option>{choices.map(id=><option key={id} value={id}>{name(station.nodes.find(n=>n.id===id)?.name??"")}</option>)}</select></label>
 <button disabled={s.status!=="paused"||!choices.includes(alternative)} onClick={()=>{c.deviate(alternative);setAlternative("");}}>{t("Take selected path")}</button>
 <p>{t("Pause at a decision point to choose a wrong turn. Wrong turns traverse a valid connection before rerouting. If a connector is occupied, changes wait for its landing. An occupied lift failure stops movement in place.")}</p>
 </div></details>
 </section>;
}
