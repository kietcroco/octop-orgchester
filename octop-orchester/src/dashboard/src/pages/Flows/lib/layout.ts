/**
 * Tidy layout: left-to-right layers, no overlaps, cycle-safe, pure.
 *
 * Same signature as Orchester lib/flows/layout.ts (which uses dagre) so dagre
 * can replace this body later without touching callers. Back edges (found by
 * DFS) are ignored for layering, so a cycle cannot loop forever.
 */

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
}
export interface LayoutEdge {
  source: string;
  target: string;
}

const DEFAULT_W = 210;
const DEFAULT_H = 64;
const COL_GAP = 96;
const ROW_GAP = 56;
const MARGIN = 40;

export function autoLayout<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  sizeOf?: (n: T) => { width: number; height: number },
): T[] {
  if (nodes.length === 0) return nodes;

  const size = (n: T) => sizeOf?.(n) ?? { width: DEFAULT_W, height: DEFAULT_H };
  const ids = new Set(nodes.map((n) => n.id));
  const out = new Map<string, string[]>();
  for (const edge of edges) {
    if (
      edge.source === edge.target ||
      !ids.has(edge.source) ||
      !ids.has(edge.target)
    )
      continue;
    const list = out.get(edge.source) ?? [];
    list.push(edge.target);
    out.set(edge.source, list);
  }

  // DFS: drop back edges, and collect a topological order from finish times.
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const forward = new Map<string, string[]>();
  const finished: string[] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) continue; // back edge
      const list = forward.get(id) ?? [];
      list.push(next);
      forward.set(id, list);
      if (!state.has(next)) visit(next);
    }
    state.set(id, 2);
    finished.push(id);
  };
  for (const n of nodes) if (!state.has(n.id)) visit(n.id);

  // Longest-path layering over the DAG (reverse finish order is topological).
  const layerOf = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const id of [...finished].reverse()) {
    for (const next of forward.get(id) ?? []) {
      layerOf.set(
        next,
        Math.max(layerOf.get(next) ?? 0, (layerOf.get(id) ?? 0) + 1),
      );
    }
  }
  const preds = new Map<string, string[]>();
  for (const [from, list] of forward) {
    for (const to of list) preds.set(to, [...(preds.get(to) ?? []), from]);
  }

  const layers: T[][] = [];
  for (const n of nodes) {
    const layer = layerOf.get(n.id) ?? 0;
    (layers[layer] ??= []).push(n);
  }

  const placed = new Map<string, { x: number; y: number }>();
  const centerY = new Map<string, number>();
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  let x = MARGIN;
  for (const layer of layers) {
    if (!layer) continue;
    // Order a column by where its predecessors sit; ties keep input order.
    const bary = (n: T) => {
      const ys = (preds.get(n.id) ?? [])
        .map((p) => centerY.get(p))
        .filter((v) => v !== undefined);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
    };
    const sorted = [...layer].sort((a, b) => {
      const ba = bary(a);
      const bb = bary(b);
      if (ba !== null && bb !== null && ba !== bb) return ba - bb;
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    });
    let y = MARGIN;
    let colWidth = 0;
    for (const n of sorted) {
      const { width, height } = size(n);
      placed.set(n.id, { x, y });
      centerY.set(n.id, y + height / 2);
      y += height + ROW_GAP;
      colWidth = Math.max(colWidth, width);
    }
    x += colWidth + COL_GAP;
  }

  return nodes.map((n) => ({ ...n, position: placed.get(n.id) ?? n.position }));
}
