import type { Edge, Node } from "@xyflow/react";

import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "../../../api/modules/flows";
import { registryIdOf } from "./node-catalog";

/**
 * Stored flow -> canvas (xyflow) shape. The way back is `buildFlowPayload`.
 * Pure: no React, no xyflow runtime.
 */

export function toCanvasNodes(nodes: StoredFlowNode[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      label: node.label,
      config: node.config,
      nodeId: registryIdOf(node.type, node.config),
    },
  }));
}

export function toCanvasEdges(edges: StoredFlowEdge[]): Edge[] {
  return edges.map((edge) => {
    const out: Edge = { id: edge.id, source: edge.source, target: edge.target };
    if (edge.sourceHandle) out.sourceHandle = edge.sourceHandle;
    if (edge.label) out.label = edge.label;
    return out;
  });
}
