import { describe, expect, it } from "vitest";

import { normalizeFlowEdges, normalizeFlowNodes } from "./normalize";

describe("normalizeFlowNodes", () => {
  it("returns [] for anything that is not an array", () => {
    expect(normalizeFlowNodes(null)).toEqual([]);
    expect(normalizeFlowNodes({})).toEqual([]);
  });

  it("skips non-object items and fills id and position defaults", () => {
    const nodes = normalizeFlowNodes([
      42,
      { type: "agent", label: "A" },
      { type: "notify" },
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({
      id: "node-2",
      type: "agent",
      label: "A",
      config: {},
      position: { x: 80 + 1 * 240, y: 80 },
    });
    expect(nodes[1].id).toBe("node-3");
    expect(nodes[1].label).toBe("notify");
  });

  it("keeps stored id, label, config and position untouched", () => {
    const stored = {
      id: "t",
      type: "trigger",
      label: "When a message arrives",
      config: { triggerKind: "message" },
      position: { x: 10, y: 20 },
    };
    expect(normalizeFlowNodes([stored])).toEqual([stored]);
  });

  it("reads label and config from the legacy data wrapper", () => {
    const [node] = normalizeFlowNodes([
      {
        id: "x",
        type: "agent",
        position: { x: 1, y: 2 },
        data: { label: "L", config: { a: 1 } },
      },
    ]);
    expect(node.label).toBe("L");
    expect(node.config).toEqual({ a: 1 });
  });

  it("keeps a valid engine type even when the catalog has no entry for it", () => {
    const [node] = normalizeFlowNodes([
      {
        id: "s",
        type: "switch",
        label: "Pick",
        config: {},
        position: { x: 0, y: 0 },
      },
    ]);
    expect(node.type).toBe("switch");
  });

  it("turns an unknown type into a note that keeps the label", () => {
    const [node] = normalizeFlowNodes([
      { id: "z", type: "teleport", label: "Beam up", position: { x: 5, y: 6 } },
    ]);
    expect(node.type).toBe("note");
    expect(node.label).toBe("Beam up");
    expect(node.id).toBe("z");
    expect(node.position).toEqual({ x: 5, y: 6 });
    expect(String(node.config.text)).toContain("teleport");
  });
});

describe("normalizeFlowEdges", () => {
  it("drops edges without source or target and fills missing ids", () => {
    const edges = normalizeFlowEdges([
      { source: "a" },
      { source: "a", target: "b" },
      {
        id: "keep",
        source: "b",
        target: "c",
        sourceHandle: "true",
        label: "Yes",
      },
    ]);
    expect(edges).toEqual([
      { id: "e-a-b-1", source: "a", target: "b" },
      {
        id: "keep",
        source: "b",
        target: "c",
        sourceHandle: "true",
        label: "Yes",
      },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeFlowEdges(undefined)).toEqual([]);
  });
});
