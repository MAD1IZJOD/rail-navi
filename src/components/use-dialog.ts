"use client";
import {useEffect,useRef} from "react";

/** Trap keyboard focus inside an open modal and return it to its launcher. */
export function useDialog(open=true){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const element=ref.current;if(!element)return;
  const focusable=()=>Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(item=>item.getClientRects().length>0);
  const timer=setTimeout(()=>focusable()[0]?.focus(),0);
  const key=(event:KeyboardEvent)=>{
   if(event.key!=="Tab")return;
   const items=focusable(),first=items[0],last=items.at(-1);
   if(!first){event.preventDefault();element.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||!element.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!element.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",key);
  return()=>{clearTimeout(timer);document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus();};
 },[open]);
 return ref;
}
