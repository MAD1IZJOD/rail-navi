import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{
 return{
  id:"/",name:"RailNavi",short_name:"RailNavi",
  description:"Indoor station navigation with QR checkpoints and offline routes. Fictional demonstration data.",
  start_url:"/demo",scope:"/",display:"standalone",orientation:"portrait-primary",
  background_color:"#0b1b32",theme_color:"#0b1b32",lang:"en",categories:["navigation","travel"],
  icons:[
   {src:"/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
   {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
   {src:"/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
  ],
 };
}
