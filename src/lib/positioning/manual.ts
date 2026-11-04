import type { FloorId, LocationAnchor, Station } from "../navigation/types";
import {checkpointById,resolveCheckpoint} from "./checkpoints";

export interface PositionFix {
  nodeId: string;
  floor: FloorId;
  anchor: LocationAnchor;
  source: LocationAnchor["source"];
  accuracy: "selected-checkpoint" | "scanned-checkpoint" | "simulated-node";
}
export type PositionResult = { status: "located"; position: PositionFix } | { status: "unknown"; message: string };

/** Future QR/BLE providers can implement this async contract without changing routing.
 * A fix MUST resolve to a verified graph node; raw browser GPS is not an indoor fix.
 */
export interface PositioningProvider {
  id: string;
  locate(station: Station, anchorId: string): Promise<PositionResult>;
}

export const manualPositioningProvider: PositioningProvider = {
  id: "manual",
  async locate(station, anchorId) {
    const checkpoint = anchorId.startsWith("checkpoint:") ? checkpointById(anchorId.slice(11)) : undefined;
    const anchor: LocationAnchor | undefined = checkpoint?.stationId === station.id ? { id: anchorId, nodeId: checkpoint.nodeId, label: checkpoint.label, source: "manual" } : station.anchors.find(item => item.id === anchorId && item.source === "manual");
    const node = anchor && station.nodes.find(item => item.id === anchor.nodeId);
    if (!anchor || !node) return { status: "unknown", message: "Select a known entrance or checkpoint." };
    return {
      status: "located",
      position: { nodeId: node.id, floor: node.floor, anchor, source: "manual", accuracy: "selected-checkpoint" },
    };
  },
};

/** A QR fix is a single known fixed location, not a continuous position stream. */
export function qrPositioningProvider(origin:string):PositioningProvider {
 return {id:"qr",async locate(station,payload){
  const result=resolveCheckpoint(payload,origin);
  if(result.status!=="located"||result.checkpoint.stationId!==station.id)return{status:"unknown",message:"Checkpoint not accepted"};
  const c=result.checkpoint;
  return{status:"located",position:{nodeId:c.nodeId,floor:c.floor,source:"qr",accuracy:"scanned-checkpoint",anchor:{id:"checkpoint:"+c.id,nodeId:c.nodeId,label:c.label,source:"qr"}}};
 }};
}
export const simulationPositioningProvider:PositioningProvider={id:"simulation",async locate(station,nodeId){
 const n=station.nodes.find(n=>n.id===nodeId);if(!n)return{status:"unknown",message:"No verified graph position is available."};
 return{status:"located",position:{nodeId:n.id,floor:n.floor,source:"simulation",accuracy:"simulated-node",anchor:{id:n.id,nodeId:n.id,label:n.name,source:"simulation"}}};
}};
