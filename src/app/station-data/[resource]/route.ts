import {demoStation as station} from "@/lib/station/demo-station";
import {STATION_VERSION} from "@/lib/station/version";
import {checkpoints} from "@/lib/positioning/checkpoints";
import {messages} from "@/lib/i18n/messages";
import {demoTickets,demoTrains} from "@/lib/tickets/demo";
export const dynamic="force-static";
const resources:Record<string,unknown>={
 geometry:{floors:station.floors,platforms:station.platforms,entrances:station.entrances,corridors:station.corridors,geometry:station.geometry},
 topology:{nodes:station.nodes,edges:station.edges,anchors:station.anchors},
 facilities:station.facilities,checkpoints,
 locales:{en:"English source messages",hi:messages},tickets:{trains:demoTrains,tickets:demoTickets},
 version:{stationVersion:STATION_VERSION},
};
export function generateStaticParams(){return Object.keys(resources).map(resource=>({resource}));}
export async function GET(_request:Request,{params}:{params:Promise<{resource:string}>}){
 const {resource}=await params;
 if(!Object.hasOwn(resources,resource))return Response.json({error:"Unknown station resource"},{status:404});
 return Response.json({schema:1,stationId:station.id,stationVersion:STATION_VERSION,data:resources[resource]},{headers:{"Cache-Control":"public, max-age=0, must-revalidate"}});
}
