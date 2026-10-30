import type { Edge, Node } from "@xyflow/react";

import type { NodeDef } from "./node-catalog";

/**
 * Pure graph operations behind the builder's actions. They take a `NodeDef`
 * (not an id) so they are testable without the catalog and never mutate input.
 */

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

const STEP_GAP = 260;
const COPY_OFFSET = 40;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function addNodeToGraph(
  g: Graph,
  def: NodeDef,
  opts: {
    id: string;
    label: string;
    at?: { x: number; y: number };
    selectedId?: string | null;
  },
): { graph: Graph; added: Node } {
  const selected = opts.selectedId
    ? g.nodes.find((n) => n.id === opts.selectedId)
    : undefined;
  const position =
    opts.at ??
    (selected
      ? { x: selected.position.x + STEP_GAP, y: selected.position.y }
      : { x: 80 + g.nodes.length * 30, y: 80 + g.nodes.length * 30 });

  const added: Node = {
    id: opts.id,
    type: def.engine,
    position,
    data: {
      nodeId: def.id,
      label: opts.label,
      config: { ...(def.defaults ?? {}), ...(def.fixedConfig ?? {}) },
    },
  };

  // Chain from the selected step, unless the new step starts a flow (a trigger).
  const chain = selected && !opts.at && def.engine !== "trigger";
  const edges = chain
    ? [
        ...g.edges,
        {
          id: `${selected.id}-${opts.id}`,
          source: selected.id,
          target: opts.id,
        },
      ]
    : g.edges;

  return { graph: { nodes: [...g.nodes, added], edges }, added };
}

export function removeNode(g: Graph, id: string): Graph {
  return {
    nodes: g.nodes.filter((n) => n.id !== id),
    edges: g.edges.filter((e) => e.source !== id && e.target !== id),
  };
}

export function duplicateNode(
  g: Graph,
  id: string,
  newId: string,
): { graph: Graph; added: Node } | null {
  const source = g.nodes.find((n) => n.id === id);
  if (!source) return null;
  const added: Node = {
    id: newId,
    type: source.type,
    position: {
      x: source.position.x + COPY_OFFSET,
      y: source.position.y + COPY_OFFSET,
    },
    data: clone(source.data ?? {}),
  };
  return { graph: { nodes: [...g.nodes, added], edges: g.edges }, added };
}

export function connect(
  g: Graph,
  c: { source: string; target: string; sourceHandle?: string | null },
  edgeId: string,
): Graph {
  if (c.source === c.target) return g;
  const handle = c.sourceHandle ?? null;
  const exists = g.edges.some(
    (e) =>
      e.source === c.source &&
      e.target === c.target &&
      (e.sourceHandle ?? null) === handle,
  );
  if (exists) return g;
  const edge: Edge = { id: edgeId, source: c.source, target: c.target };
  if (handle) edge.sourceHandle = handle;
  return { nodes: g.nodes, edges: [...g.edges, edge] };
}
