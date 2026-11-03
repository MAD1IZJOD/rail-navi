import {buildStation} from "./topology";
import {enrichStation} from "../facilities/catalog";
export const demoStation=enrichStation(buildStation());
export const bridgeAEdgeIds=demoStation.edges.filter(e=>e.kind==="walk"&&e.label==="Foot Overbridge A").map(e=>e.id);
export const liftEdgeIds=demoStation.edges.filter(e=>e.kind==="lift").map(e=>e.id);
export const stationMetrics={
 platforms:demoStation.platforms.length,floors:demoStation.floors.length,gates:demoStation.entrances.length,
 nodes:demoStation.nodes.length,edges:demoStation.edges.length,
 verticalConnections:demoStation.edges.filter(e=>e.kind!=="walk").length,
 verticalLandings:new Set(demoStation.edges.filter(e=>e.kind!=="walk").map(e=>e.from)).size,
 facilities:demoStation.facilities.length,
};

