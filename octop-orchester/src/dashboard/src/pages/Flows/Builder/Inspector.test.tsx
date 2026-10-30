import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";

import type { NodeDef } from "../lib/node-catalog";

const catalog: Record<string, NodeDef> = {
  agent: {
    id: "agent",
    engine: "agent",
    category: "ai",
    icon: "Bot",
    accent: "#8b5cf6",
    fields: [],
  },
};

vi.mock("../lib/node-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/node-catalog")>()),
  getNodeDef: (id: string) => catalog[id],
}));

import { Inspector } from "./Inspector";

const node = (nodeId: string, type = "agent"): Node => ({
  id: "n1",
  type,
  position: { x: 3, y: 4 },
  data: { nodeId, label: "My step", config: { keep: "me" } },
});

const nameInput = () =>
  screen.getByLabelText("flows.builder.nodeName") as HTMLInputElement;

beforeEach(() => vi.clearAllMocks());

describe("Inspector", () => {
  it("asks for a selection when there is none", () => {
    render(<Inspector node={null} onChange={vi.fn()} onDelete={vi.fn()} />);
    expect(
      screen.getByText("flows.builder.inspectorEmpty"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("flows.builder.nodeName"),
    ).not.toBeInTheDocument();
  });

  it("describes a cataloged node with its title, summary and name", () => {
    render(
      <Inspector node={node("agent")} onChange={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("flows.nodes.agent.title")).toBeInTheDocument();
    expect(screen.getByText("flows.nodes.agent.summary")).toBeInTheDocument();
    expect(nameInput().value).toBe("My step");
  });

  it("renames the step without touching the rest of the node", () => {
    const onChange = vi.fn();
    render(
      <Inspector node={node("agent")} onChange={onChange} onDelete={vi.fn()} />,
    );
    fireEvent.change(nameInput(), { target: { value: "Renamed" } });

    const updated = onChange.mock.calls[0][0] as Node;
    expect(updated.id).toBe("n1");
    expect(updated.position).toEqual({ x: 3, y: 4 });
    expect(updated.data).toEqual({
      nodeId: "agent",
      label: "Renamed",
      config: { keep: "me" },
    });
  });

  it("deletes the step", () => {
    const onDelete = vi.fn();
    render(
      <Inspector node={node("agent")} onChange={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByLabelText("flows.builder.deleteNode"));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });

  it("says a node without settings has none yet", () => {
    render(
      <Inspector node={node("agent")} onChange={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("flows.builder.noSettingsYet")).toBeInTheDocument();
  });

  it("renders the node's own settings form when one is provided", () => {
    const renderFields = vi.fn(() => <div>agent-form</div>);
    render(
      <Inspector
        node={node("agent")}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        renderFields={renderFields}
      />,
    );
    expect(screen.getByText("agent-form")).toBeInTheDocument();
    expect(
      screen.queryByText("flows.builder.noSettingsYet"),
    ).not.toBeInTheDocument();
    expect(renderFields).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1" }),
      expect.any(Function),
    );
  });

  it("still lets you rename and delete a node the catalog does not know", () => {
    const onChange = vi.fn();
    const onDelete = vi.fn();
    const renderFields = vi.fn(() => <div>never</div>);
    render(
      <Inspector
        node={node("mystery", "notify")}
        onChange={onChange}
        onDelete={onDelete}
        renderFields={renderFields}
      />,
    );

    expect(screen.getByText("notify")).toBeInTheDocument();
    expect(nameInput().value).toBe("My step");
    expect(renderFields).not.toHaveBeenCalled();
    expect(screen.queryByText("never")).not.toBeInTheDocument();

    fireEvent.change(nameInput(), { target: { value: "X" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("flows.builder.deleteNode"));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });
});
