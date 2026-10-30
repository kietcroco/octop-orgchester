import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react";

const { groups, theme } = vi.hoisted(() => ({
  groups: { current: [] as unknown[] },
  theme: { mode: "light" },
}));

vi.mock("../lib/node-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/node-catalog")>()),
  listNodesByCategory: () => groups.current,
  getNodeDef: () => undefined,
}));
vi.mock("../../../context/ThemeContext", () => ({ useTheme: () => theme }));

import { Canvas, type CanvasProps } from "./Canvas";

const node = (id: string, label: string): Node => ({
  id,
  type: "agent",
  position: { x: 0, y: 0 },
  data: { label, nodeId: "agent", config: {} },
});

function setup(overrides: Partial<CanvasProps> = {}) {
  const props: CanvasProps = {
    nodes: [],
    edges: [] as Edge[],
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    onSelect: vi.fn(),
    onAddNode: vi.fn(),
    onApplyTemplate: vi.fn(),
    ...overrides,
  };
  render(
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>,
  );
  return props;
}

beforeEach(() => {
  groups.current = [];
  theme.mode = "light";
});

describe("Canvas", () => {
  it("draws the nodes it is given and hides the empty guide", () => {
    setup({ nodes: [node("a", "First"), node("b", "Second")] });
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-canvas-guide")).not.toBeInTheDocument();
  });

  it("offers the templates on an empty canvas and applies the chosen one", () => {
    const props = setup();
    expect(screen.getByTestId("empty-canvas-guide")).toBeInTheDocument();
    expect(screen.getByText("flows.templates.alert.name")).toBeInTheDocument();

    fireEvent.click(screen.getByText("flows.templates.faq.name"));
    expect(props.onApplyTemplate).toHaveBeenCalledTimes(1);
    expect(props.onApplyTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "flows.templates.faq.name" }),
    );
  });

  it("hides the trigger starters while the catalog has no triggers", () => {
    setup();
    expect(
      screen.queryByText("flows.builder.startersTitle"),
    ).not.toBeInTheDocument();
  });

  it("offers a starter for each cataloged trigger", () => {
    groups.current = [
      {
        category: "trigger",
        nodes: [
          {
            id: "trigger_manual",
            engine: "trigger",
            category: "trigger",
            icon: "Play",
            accent: "#0f0",
            fields: [],
          },
        ],
      },
    ];
    const props = setup();
    fireEvent.click(screen.getByText("flows.nodes.trigger_manual.title"));
    expect(props.onAddNode).toHaveBeenCalledWith("trigger_manual");
  });

  it("adds the dropped palette node at the drop position", () => {
    const props = setup();
    fireEvent.drop(screen.getByTestId("builder-canvas-drop"), {
      clientX: 120,
      clientY: 80,
      dataTransfer: {
        getData: (type: string) =>
          type === "application/flow-node" ? "agent" : "",
      },
    });
    expect(props.onAddNode).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it("ignores a drop that carries no palette node", () => {
    const props = setup();
    fireEvent.drop(screen.getByTestId("builder-canvas-drop"), {
      dataTransfer: { getData: () => "" },
    });
    expect(props.onAddNode).not.toHaveBeenCalled();
  });

  it("follows the app theme", () => {
    theme.mode = "dark";
    setup({ nodes: [node("a", "A")] });
    expect(document.querySelector(".react-flow.dark")).not.toBeNull();
  });
});
