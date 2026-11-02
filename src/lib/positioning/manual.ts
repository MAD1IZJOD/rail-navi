import type { FloorId, LocationAnchor, Station } from "../navigation/types";

export interface PositionFix {
  nodeId: string;
  floor: FloorId;
  anchor: LocationAnchor;
  source: LocationAnchor["source"];
  accuracy: "selected-checkpoint";
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
    const anchor = station.anchors.find(item => item.id === anchorId && item.source === "manual");
    const node = anchor && station.nodes.find(item => item.id === anchor.nodeId);
    if (!anchor || !node) return { status: "unknown", message: "Select a known entrance or checkpoint." };
    return {
      status: "located",
      position: { nodeId: node.id, floor: node.floor, anchor, source: "manual", accuracy: "selected-checkpoint" },
    };
  },
};
