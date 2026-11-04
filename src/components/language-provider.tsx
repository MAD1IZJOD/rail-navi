"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {translate,placeName,localFloor,renderInstruction,distance,duration,type Language} from "@/lib/i18n/messages";
import type {FloorId,RouteStep} from "@/lib/navigation/types";
export const LANGUAGE_KEY="railnavi-language-v1";
const defaultValue={language:"en" as Language,setLanguage:(value:Language)=>{void value;},t:(s:string)=>s,name:(s:string)=>s,floor:(f:FloorId)=>localFloor(f,"en"),instruction:(s:RouteStep|undefined)=>renderInstruction(s,"en"),distance:(n:number)=>distance(n,"en"),duration:(n:number)=>duration(n,"en")};
const Context=createContext(defaultValue);
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setCurrent]=useState<Language>("en");
 const setLanguage=useCallback((value:Language)=>{setCurrent(value);try{localStorage.setItem(LANGUAGE_KEY,value);}catch{/* UI still works without persistence. */}},[]);
 useEffect(()=>{
  const timer=setTimeout(()=>{let value:Language=navigator.language.toLowerCase().startsWith("hi")?"hi":"en";try{const saved=localStorage.getItem(LANGUAGE_KEY);if(saved==="en"||saved==="hi")value=saved;}catch{}setCurrent(value);},0);
  return()=>clearTimeout(timer);
 },[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 const value=useMemo(()=>({language,setLanguage,t:(s:string)=>translate(s,language),name:(s:string)=>placeName(s,language),floor:(f:FloorId)=>localFloor(f,language),instruction:(s:RouteStep|undefined)=>renderInstruction(s,language),distance:(n:number)=>distance(n,language),duration:(n:number)=>duration(n,language)}),[language,setLanguage]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
export function LanguageControl(){
 const {language,setLanguage,t}=useLanguage();
 return <label className="language-control"><span className="sr-only">{t("Language")}</span><select aria-label={t("Language")} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en" lang="en">English</option><option value="hi" lang="hi">हिन्दी</option></select></label>;
}

