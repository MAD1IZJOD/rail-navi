import type {AnchorHTMLAttributes} from "react";
/** Offline shells are complete documents. Avoid an RSC request when navigating between them. */
export function DocumentLink(props:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}/>;}
