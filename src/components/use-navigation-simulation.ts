"use client";
import {useEffect,useState} from "react";
import type {FloorId,GeneratedRoute,NavigationGraph,RoutingOptions,JourneyStop} from "@/lib/navigation/types";
import {advanceSession,continueVisit,deviateSession,pauseSession,replanSession,restartSession,resumeSession,setSimulationSpeed,startSession,stepSession,type NavigationSession} from "@/lib/navigation/simulator";

export function useNavigationSimulation(graph:NavigationGraph,onFloor:(floor:FloorId)=>void,onVisit?:(id:string)=>void,onRestart?:(stops:JourneyStop[])=>void){
 const [session,setSession]=useState<NavigationSession|null>(null);
 const [clockBase,setClockBase]=useState(19*3600+55*60);
 const nowSeconds=clockBase+(session?.elapsedSeconds??0);
 const status=session?.status,positionFloor=session?.position.floor,visitId=session?.currentStop?.id;
 useEffect(()=>{if(visitId)onVisit?.(visitId);},[visitId,onVisit]);
 useEffect(()=>{
  if(status!=="running")return;
  const timer=setInterval(()=>setSession(current=>current?advanceSession(current,.1,graph):null),100);
  return()=>clearInterval(timer);
 },[graph,status]);
 useEffect(()=>{if(positionFloor!==undefined&&status!=="stopped")onFloor(positionFloor);},[positionFloor,status,onFloor]);
 return{
  session,nowSeconds,
  setClock:(seconds:number)=>{if(Number.isFinite(seconds)&&seconds>=0)setClockBase(seconds-(session?.elapsedSeconds??0));},
  continueVisit:()=>setSession(s=>s?continueVisit(s):null),
  start:(route:GeneratedRoute,options:RoutingOptions)=>setSession({...startSession(route),options}),
  stop:()=>{setClockBase(b=>b+(session?.elapsedSeconds??0));setSession(null);},
  pause:()=>setSession(s=>s?pauseSession(s):null),
  resume:()=>setSession(s=>s?resumeSession(s):null),
  restart:()=>{setClockBase(b=>b+(session?.elapsedSeconds??0));const next=session?restartSession(session,graph):null;setSession(next);onRestart?.(next?.itinerary??[]);},
  step:()=>setSession(s=>s?stepSession(s,graph):null),
  speed:(speed:number)=>setSession(s=>s?setSimulationSpeed(s,speed):null),
  replan:(destinationId:string,options:RoutingOptions,reason:string,stops?:JourneyStop[])=>setSession(s=>s?replanSession(s,graph,{destinationId,options,reason,stops}):null),
  deviate:(target:string)=>setSession(s=>s?deviateSession(s,graph,target):null),
 };
}
export type SimulationController=ReturnType<typeof useNavigationSimulation>;
