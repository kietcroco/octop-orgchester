import type { Edge, Node } from "@xyflow/react";

import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "../../../api/modules/flows";

/**
 * The flow graph in the shape `flowApi.update` stores, plus a signature to tell
 * a real edit from the editor's own bookkeeping: xyflow writes measurements,
 * selection and drag state onto node objects, which must not look like a change
 * (ported idea from Orchester lib/flows/payload.ts).
 */

export interface FlowGraphPayload {
  nodes: StoredFlowNode[];
  edges: StoredFlowEdge[];
  variables: Record<string, unknown>;
}

export function buildFlowPayload(
  nodes: readonly Node[],
  edges: readonly Edge[],
  variables: Record<string, unknown>,
): FlowGraphPayload {
  return {
    nodes: nodes.map((node) => {
      const data = (node.data ?? {}) as {
        label?: string;
        config?: Record<string, unknown>;
      };
      return {
        id: node.id,
        type: node.type ?? "note",
        label: data.label ?? "",
        config: data.config ?? {},
        position: { x: node.position.x, y: node.position.y },
      };
    }),
    edges: edges.map((edge) => {
      const out: StoredFlowEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      };
      if (edge.sourceHandle) out.sourceHandle = edge.sourceHandle;
      if (typeof edge.label === "string") out.label = edge.label;
      return out;
    }),
    variables,
  };
}

/** Two payloads with the same signature store the same flow. */
export function flowSignature(payload: FlowGraphPayload): string {
  return JSON.stringify(payload);
}
