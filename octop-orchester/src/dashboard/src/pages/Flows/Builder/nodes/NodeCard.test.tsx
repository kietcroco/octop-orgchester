import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider, type Node } from "@xyflow/react";

import type { NodeDef } from "../../lib/node-catalog";

const defs: Record<string, NodeDef> = {
  trigger_manual: {
    id: "trigger_manual",
    engine: "trigger",
    category: "trigger",
    icon: "Play",
    accent: "#10b981",
    fields: [],
    fixedConfig: { triggerKind: "manual" },
  },
};

vi.mock("../../lib/node-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/node-catalog")>()),
  getNodeDef: (id: string) => defs[id],
}));

import { NodeCard } from "./NodeCard";

const nodeTypes = { trigger: NodeCard, agent: NodeCard, note: NodeCard };

function renderNodes(nodes: Node[]) {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 600, height: 400 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={nodeTypes} fitView />
      </div>
    </ReactFlowProvider>,
  );
}

const node = (
  id: string,
  type: string,
  data: Record<string, unknown>,
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

describe("NodeCard", () => {
  it("shows the saved label and a source handle for a cataloged trigger, but no target handle", () => {
    const { container } = renderNodes([
      node("t", "trigger", {
        label: "When it starts",
        nodeId: "trigger_manual",
        config: {},
      }),
    ]);
    expect(screen.getByText("When it starts")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".react-flow__handle.source"),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(".react-flow__handle.target"),
    ).toHaveLength(0);
  });

  it("uses the accent colour of the catalog entry", () => {
    renderNodes([
      node("t", "trigger", {
        label: "T",
        nodeId: "trigger_manual",
        config: {},
      }),
    ]);
    const card = screen.getByTestId("node-card");
    expect(card.style.borderLeftColor).not.toBe("");
    expect(card).toHaveAttribute("data-known", "true");
  });

  it("renders a node the catalog does not know as a fallback card that can still be wired", () => {
    const { container } = renderNodes([
      node("a", "agent", {
        label: "Reply with an agent",
        nodeId: "agent",
        config: {},
      }),
    ]);
    expect(screen.getByText("Reply with an agent")).toBeInTheDocument();
    expect(screen.getByTestId("node-card")).toHaveAttribute(
      "data-known",
      "false",
    );
    expect(
      container.querySelectorAll(".react-flow__handle.target"),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(".react-flow__handle.source"),
    ).toHaveLength(1);
  });

  it("names a label-less unknown node instead of leaving it blank", () => {
    renderNodes([
      node("a", "agent", { label: "", nodeId: "agent", config: {} }),
    ]);
    expect(screen.getByText("flows.builder.unknownNode")).toBeInTheDocument();
  });

  it("shows the text of a note", () => {
    renderNodes([
      node("n", "note", {
        label: "Remember",
        nodeId: "note",
        config: { text: "Call Ana" },
      }),
    ]);
    expect(screen.getByText("Call Ana")).toBeInTheDocument();
  });
});
