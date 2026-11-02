"use client";
import {Pause,Play,RotateCcw,SkipForward,Square,MapPin} from "lucide-react";
import type {GeneratedRoute,RoutingOptions,Station} from "@/lib/navigation/types";
import {deviationChoices,sessionGuidance} from "@/lib/navigation/simulator";
import type {SimulationController} from "./use-navigation-simulation";
interface Props{controller:SimulationController;route:GeneratedRoute|null;station:Station;options:RoutingOptions;onBridge:(closed:boolean)=>void;onLifts:(closed:boolean)=>void;bridgeClosed:boolean;liftsClosed:boolean}
export function SimulationControls({controller:c,route,station,options,onBridge,onLifts,bridgeClosed,liftsClosed}:Props){
 const s=c.session,g=s&&sessionGuidance(s);
 if(!s)return route?.status==="available"?<div className="simulation-launch"><button className="button button-primary" onClick={()=>c.start(route,options)}><Play size={17}/>Start simulated navigation</button><small>Deterministic demo · Not indoor positioning</small></div>:null;
 const choices=deviationChoices(s,station);
 return <section className="simulation-console" aria-label="Navigation simulation">
 <div className="simulation-primary"><span className="simulation-label"><MapPin size={14}/>SIMULATION · <b data-testid="simulation-status">{s.status}</b></span>
 {s.status==="running"?<button onClick={c.pause}><Pause size={16}/>Pause</button>:s.status==="paused"?<button onClick={c.resume}><Play size={16}/>Resume</button>:null}
 <button onClick={c.step} disabled={s.status==="arrived"||s.status==="blocked"} aria-label="Next decision point"><SkipForward size={17}/><span>Next point</span></button>
 <button onClick={c.stop} aria-label="Stop navigation"><Square size={16}/></button></div>
 <p className="simulation-feedback" role="status">{s.message}</p>
 {g&&<div className="simulation-progress"><progress aria-label="Route progress" max="1" value={g.progress}/><span>{Math.round(g.remainingDistance)} m remaining · {Math.ceil(g.remainingSeconds/60)} min</span></div>}
 <details className="advanced-simulation"><summary>Demo controls</summary><div>
 <label>Simulation speed<select aria-label="Simulation speed" value={s.speed} onChange={e=>c.speed(Number(e.target.value))}>{[1,5,20,60,120].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
 <button onClick={c.restart}><RotateCcw size={15}/>Restart journey</button>
 <label className="check-control"><input type="checkbox" checked={bridgeClosed} onChange={e=>onBridge(e.target.checked)}/>Close Bridge A</label>
 <label className="check-control"><input type="checkbox" checked={liftsClosed} onChange={e=>onLifts(e.target.checked)}/>Simulate all lifts unavailable</label>
 <label>Wrong turn at a decision point<select aria-label="Alternative connection" defaultValue="" disabled={!choices.length} onChange={e=>{if(e.target.value)c.deviate(e.target.value);e.target.value="";}}><option value="">Choose a permitted alternative</option>{choices.map(id=><option key={id} value={id}>{station.nodes.find(n=>n.id===id)?.name}</option>)}</select></label>
 <p>Wrong turns traverse a valid connection before rerouting. If a connector is occupied, changes wait for its landing. An occupied lift failure stops movement in place.</p>
 </div></details>
 </section>;
}
