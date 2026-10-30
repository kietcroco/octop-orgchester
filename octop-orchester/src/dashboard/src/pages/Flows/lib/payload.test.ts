import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { FLOW_TEMPLATES } from "./templates";
import { toCanvasEdges, toCanvasNodes } from "./node-mapping";
import { buildFlowPayload, flowSignature } from "./payload";

const t = ((key: string) => key) as unknown as TFunction;

describe("toCanvasNodes / toCanvasEdges", () => {
  it("derives the registry id into data.nodeId whatever the catalog holds", () => {
    const [trigger, agent] = toCanvasNodes([
      {
        id: "t",
        type: "trigger",
        label: "T",
        config: { triggerKind: "schedule" },
        position: { x: 0, y: 0 },
      },
      {
        id: "a",
        type: "agent",
        label: "A",
        config: {},
        position: { x: 1, y: 1 },
      },
    ]);
    expect(trigger).toMatchObject({
      id: "t",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        nodeId: "trigger_schedule",
        label: "T",
        config: { triggerKind: "schedule" },
      },
    });
    expect((agent.data as { nodeId: string }).nodeId).toBe("agent");
  });

  it("only sets sourceHandle and label on edges that have them", () => {
    const [plain, rich] = toCanvasEdges([
      { id: "e1", source: "a", target: "b" },
      {
        id: "e2",
        source: "a",
        target: "c",
        sourceHandle: "true",
        label: "Yes",
      },
    ]);
    expect("sourceHandle" in plain).toBe(false);
    expect("label" in plain).toBe(false);
    expect(rich).toMatchObject({ sourceHandle: "true", label: "Yes" });
  });
});

describe("buildFlowPayload", () => {
  it.each(FLOW_TEMPLATES.map((template) => [template.id, template] as const))(
    "round-trips the %s template through the canvas shape unchanged",
    (_id, template) => {
      const { nodes, edges } = template.build(t);
      const payload = buildFlowPayload(
        toCanvasNodes(nodes),
        toCanvasEdges(edges),
        { v: 1 },
      );
      expect(payload).toEqual({ nodes, edges, variables: { v: 1 } });
    },
  );
});

describe("flowSignature", () => {
  const graph = () => {
    const { nodes, edges } = FLOW_TEMPLATES[1].build(t);
    return { nodes: toCanvasNodes(nodes), edges: toCanvasEdges(edges) };
  };

  it("is equal for equal content held in different objects", () => {
    const a = graph();
    const b = graph();
    expect(flowSignature(buildFlowPayload(a.nodes, a.edges, {}))).toBe(
      flowSignature(buildFlowPayload(b.nodes, b.edges, {})),
    );
  });

  it("changes when a node moves", () => {
    const a = graph();
    const moved = graph();
    moved.nodes[0] = { ...moved.nodes[0], position: { x: 999, y: 0 } };
    expect(flowSignature(buildFlowPayload(a.nodes, a.edges, {}))).not.toBe(
      flowSignature(buildFlowPayload(moved.nodes, moved.edges, {})),
    );
  });

  it("ignores xyflow bookkeeping such as selected and measured", () => {
    const a = graph();
    const noisy = graph();
    noisy.nodes[0] = {
      ...noisy.nodes[0],
      selected: true,
      measured: { width: 10, height: 5 },
    };
    expect(flowSignature(buildFlowPayload(a.nodes, a.edges, {}))).toBe(
      flowSignature(buildFlowPayload(noisy.nodes, noisy.edges, {})),
    );
  });
});
