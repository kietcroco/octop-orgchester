import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "../../../api/modules/flows";
import { getNodeDef, registryIdOf } from "./node-catalog";
import { FLOW_NODE_TYPES } from "./node-types";

/**
 * One shape for flow graphs, whatever produced them (ported from Orchester
 * lib/flows/normalize.ts). Run on load so a hand-edited or older flow cannot
 * crash the builder.
 */

const ENGINE_TYPES = new Set<string>(FLOW_NODE_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

export function normalizeFlowNodes(raw: unknown): StoredFlowNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: StoredFlowNode[] = [];

  raw.forEach((item, index) => {
    if (!isRecord(item)) return;
    const data = isRecord(item.data) ? item.data : {};
    const type = typeof item.type === "string" ? item.type : "";
    const label = [item.label, data.label].find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim() !== "",
    );
    const id =
      typeof item.id === "string" && item.id !== ""
        ? item.id
        : `node-${index + 1}`;
    const position = isPosition(item.position)
      ? item.position
      : { x: 80 + index * 240, y: 80 };

    if (!ENGINE_TYPES.has(type)) {
      // No equivalent step: keep it visible instead of silently dropping it.
      nodes.push({
        id,
        type: "note",
        label: label ?? "",
        config: { text: `Unsupported step type "${type || "unknown"}"` },
        position,
      });
      return;
    }

    const stored = isRecord(item.config)
      ? item.config
      : isRecord(data.config)
      ? data.config
      : null;
    // A step without a config starts from what a newly added step of that kind has.
    const def = getNodeDef(registryIdOf(type, stored ?? {}));
    const config = stored ?? {
      ...(def?.defaults ?? {}),
      ...(def?.fixedConfig ?? {}),
    };
    nodes.push({ id, type, label: label ?? type, config, position });
  });

  return nodes;
}

export function normalizeFlowEdges(raw: unknown): StoredFlowEdge[] {
  if (!Array.isArray(raw)) return [];
  const edges: StoredFlowEdge[] = [];

  raw.forEach((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.source !== "string" ||
      typeof item.target !== "string"
    ) {
      return;
    }
    const edge: StoredFlowEdge = {
      id:
        typeof item.id === "string" && item.id !== ""
          ? item.id
          : `e-${item.source}-${item.target}-${index}`,
      source: item.source,
      target: item.target,
    };
    if (typeof item.sourceHandle === "string" && item.sourceHandle !== "") {
      edge.sourceHandle = item.sourceHandle;
    }
    if (typeof item.label === "string") edge.label = item.label;
    edges.push(edge);
  });

  return edges;
}
