"use client";
import {useEffect,useState} from "react";
import type {FloorId,GeneratedRoute,NavigationGraph,RoutingOptions} from "@/lib/navigation/types";
import {advanceSession,deviateSession,pauseSession,replanSession,restartSession,resumeSession,setSimulationSpeed,startSession,stepSession,type NavigationSession} from "@/lib/navigation/simulator";

export function useNavigationSimulation(graph:NavigationGraph,onFloor:(floor:FloorId)=>void){
 const [session,setSession]=useState<NavigationSession|null>(null);
 const status=session?.status,positionFloor=session?.position.floor;
 useEffect(()=>{
  if(status!=="running")return;
  const timer=setInterval(()=>setSession(current=>current?advanceSession(current,.1,graph):null),100);
  return()=>clearInterval(timer);
 },[graph,status]);
 useEffect(()=>{if(positionFloor!==undefined&&status!=="stopped")onFloor(positionFloor);},[positionFloor,status,onFloor]);
 return{
  session,
  start:(route:GeneratedRoute,options:RoutingOptions)=>setSession({...startSession(route),options}),
  stop:()=>setSession(null),
  pause:()=>setSession(s=>s?pauseSession(s):null),
  resume:()=>setSession(s=>s?resumeSession(s):null),
  restart:()=>setSession(s=>s?restartSession(s,graph):null),
  step:()=>setSession(s=>s?stepSession(s,graph):null),
  speed:(speed:number)=>setSession(s=>s?setSimulationSpeed(s,speed):null),
  replan:(destinationId:string,options:RoutingOptions,reason:string)=>setSession(s=>s?replanSession(s,graph,{destinationId,options,reason}):null),
  deviate:(target:string)=>setSession(s=>s?deviateSession(s,graph,target):null),
 };
}
export type SimulationController=ReturnType<typeof useNavigationSimulation>;
