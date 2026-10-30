import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import type { NodeDef } from "./node-catalog";
import {
  addNodeToGraph,
  connect,
  duplicateNode,
  removeNode,
  type Graph,
} from "./graph";

const trigger: NodeDef = {
  id: "trigger_manual",
  engine: "trigger",
  category: "trigger",
  icon: "Play",
  accent: "#10b981",
  fields: [],
  fixedConfig: { triggerKind: "manual" },
};
const step: NodeDef = {
  id: "agent",
  engine: "agent",
  category: "ai",
  icon: "Bot",
  accent: "#8b5cf6",
  fields: [],
  defaults: { prompt: "hi" },
};

const n = (
  id: string,
  x = 0,
  y = 0,
  data: Record<string, unknown> = {},
): Node => ({
  id,
  type: "agent",
  position: { x, y },
  data,
});
const e = (source: string, target: string, sourceHandle?: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
});
const graph = (nodes: Node[], edges: Edge[] = []): Graph => ({ nodes, edges });

describe("addNodeToGraph", () => {
  it("builds the node from the definition", () => {
    const { graph: out, added } = addNodeToGraph(graph([]), step, {
      id: "n1",
      label: "Agent",
    });
    expect(added).toMatchObject({
      id: "n1",
      type: "agent",
      data: { nodeId: "agent", label: "Agent", config: { prompt: "hi" } },
    });
    expect(out.nodes).toEqual([added]);
  });

  it("merges defaults and fixedConfig into the starting config", () => {
    const { added } = addNodeToGraph(graph([]), trigger, {
      id: "t",
      label: "T",
    });
    expect((added.data as { config: unknown }).config).toEqual({
      triggerKind: "manual",
    });
  });

  it("places the node to the right of the selected one and connects them", () => {
    const g = graph([n("s", 100, 40)]);
    const { graph: out, added } = addNodeToGraph(g, step, {
      id: "n1",
      label: "A",
      selectedId: "s",
    });
    expect(added.position).toEqual({ x: 360, y: 40 });
    expect(out.edges).toEqual([{ id: "s-n1", source: "s", target: "n1" }]);
  });

  it("does not connect a new trigger to the selected node", () => {
    const g = graph([n("s", 0, 0)]);
    const { graph: out } = addNodeToGraph(g, trigger, {
      id: "t",
      label: "T",
      selectedId: "s",
    });
    expect(out.edges).toEqual([]);
  });

  it("uses the drop position and never auto-connects then", () => {
    const g = graph([n("s")]);
    const { graph: out, added } = addNodeToGraph(g, step, {
      id: "n1",
      label: "A",
      selectedId: "s",
      at: { x: 7, y: 9 },
    });
    expect(added.position).toEqual({ x: 7, y: 9 });
    expect(out.edges).toEqual([]);
  });

  it("does not mutate the input graph", () => {
    const g = graph([n("s")]);
    addNodeToGraph(g, step, { id: "n1", label: "A", selectedId: "s" });
    expect(g.nodes).toHaveLength(1);
    expect(g.edges).toHaveLength(0);
  });
});

describe("removeNode", () => {
  it("removes the node and every edge that touches it", () => {
    const g = graph(
      [n("a"), n("b"), n("c")],
      [e("a", "b"), e("b", "c"), e("a", "c")],
    );
    const out = removeNode(g, "b");
    expect(out.nodes.map((x) => x.id)).toEqual(["a", "c"]);
    expect(out.edges).toEqual([e("a", "c")]);
  });

  it("leaves the graph alone for an unknown id", () => {
    const g = graph([n("a")], [e("a", "a")]);
    expect(removeNode(g, "ghost")).toEqual(g);
  });
});

describe("duplicateNode", () => {
  it("copies the node 40px down-right with a deep-cloned data object and no edges", () => {
    const g = graph(
      [n("a", 10, 20, { label: "A", config: { k: { deep: 1 } } })],
      [e("a", "a")],
    );
    const result = duplicateNode(g, "a", "copy");
    expect(result).not.toBeNull();
    const { graph: out, added } = result!;
    expect(added.id).toBe("copy");
    expect(added.position).toEqual({ x: 50, y: 60 });
    expect(out.edges).toEqual(g.edges);

    (added.data as { config: { k: { deep: number } } }).config.k.deep = 2;
    expect(
      (g.nodes[0].data as { config: { k: { deep: number } } }).config.k.deep,
    ).toBe(1);
  });

  it("returns null for an unknown id", () => {
    expect(duplicateNode(graph([]), "nope", "x")).toBeNull();
  });
});

describe("connect", () => {
  it("adds an edge", () => {
    const out = connect(
      graph([n("a"), n("b")]),
      { source: "a", target: "b" },
      "e1",
    );
    expect(out.edges).toEqual([{ id: "e1", source: "a", target: "b" }]);
  });

  it("keeps the source handle", () => {
    const out = connect(
      graph([n("a"), n("b")]),
      { source: "a", target: "b", sourceHandle: "true" },
      "e1",
    );
    expect(out.edges[0].sourceHandle).toBe("true");
  });

  it("ignores self connections and duplicates", () => {
    const base = graph([n("a"), n("b")], [e("a", "b")]);
    expect(connect(base, { source: "a", target: "a" }, "x").edges).toHaveLength(
      1,
    );
    expect(connect(base, { source: "a", target: "b" }, "x").edges).toHaveLength(
      1,
    );
  });

  it("allows the same pair through a different handle", () => {
    const base = graph([n("a"), n("b")], [e("a", "b", "true")]);
    expect(
      connect(base, { source: "a", target: "b", sourceHandle: "false" }, "x")
        .edges,
    ).toHaveLength(2);
  });
});
