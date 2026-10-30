import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { NodeDef } from "../lib/node-catalog";
import { NodePalette } from "./NodePalette";

const def = (id: string, category: NodeDef["category"]): NodeDef => ({
  id,
  engine: "agent",
  category,
  icon: "Bot",
  accent: "#8b5cf6",
  fields: [],
});

const registry = {
  trigger_manual: def("trigger_manual", "trigger"),
  agent: def("agent", "ai"),
  notify: def("notify", "actions"),
};

const title = (id: string) => `flows.nodes.${id}.title`;

describe("NodePalette", () => {
  it("always lists every category, in catalog order, with its nodes under it", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "flows.categories.trigger",
      "flows.categories.ai",
      "flows.categories.logic",
      "flows.categories.apps",
      "flows.categories.data",
      "flows.categories.actions",
    ]);

    const group = (category: string) =>
      screen.getByTestId(`palette-group-${category}`);
    expect(group("ai")).toHaveTextContent(title("agent"));
    expect(group("actions")).toHaveTextContent(title("notify"));
    expect(group("trigger")).toHaveTextContent(title("trigger_manual"));
  });

  it("marks the categories that have no node yet", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    for (const category of ["logic", "apps", "data"]) {
      expect(screen.getByTestId(`palette-group-${category}`)).toHaveTextContent(
        "flows.builder.groupEmpty",
      );
    }
    for (const category of ["trigger", "ai", "actions"]) {
      expect(
        screen.getByTestId(`palette-group-${category}`),
      ).not.toHaveTextContent("flows.builder.groupEmpty");
    }
  });

  it("shows the count of nodes in each category", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    expect(screen.getByTestId("palette-count-ai")).toHaveTextContent("1");
    expect(screen.getByTestId("palette-count-data")).toHaveTextContent("0");
  });

  it("filters by title or summary, ignoring case", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    fireEvent.change(
      screen.getByPlaceholderText("flows.builder.paletteSearch"),
      {
        target: { value: "NOTIFY" },
      },
    );
    expect(screen.getByText(title("notify"))).toBeInTheDocument();
    expect(screen.queryByText(title("agent"))).not.toBeInTheDocument();
    // while searching, only the categories with a match remain
    expect(screen.queryByText("flows.categories.ai")).not.toBeInTheDocument();
    expect(screen.queryByText("flows.categories.data")).not.toBeInTheDocument();
    expect(screen.getByText("flows.categories.actions")).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("flows.builder.paletteSearch"),
      {
        target: { value: "SUMMARY" },
      },
    );
    expect(screen.getByText(title("agent"))).toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    fireEvent.change(
      screen.getByPlaceholderText("flows.builder.paletteSearch"),
      {
        target: { value: "zzz" },
      },
    );
    expect(
      screen.getByText("flows.builder.paletteNoMatch"),
    ).toBeInTheDocument();
  });

  it("adds a node when its item is clicked", () => {
    const onAdd = vi.fn();
    render(<NodePalette onAdd={onAdd} registry={registry} />);
    fireEvent.click(screen.getByText(title("agent")));
    expect(onAdd).toHaveBeenCalledWith("agent");
  });

  it("starts a drag that carries the node id", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText(title("agent")), {
      dataTransfer: { setData, effectAllowed: "" },
    });
    expect(setData).toHaveBeenCalledWith("application/flow-node", "agent");
  });

  it("describes each item with its summary as a tooltip", () => {
    render(<NodePalette onAdd={vi.fn()} registry={registry} />);
    const item = screen.getByText(title("agent")).closest("button")!;
    expect(item).toHaveAttribute("title", "flows.nodes.agent.summary");
  });

  it("shows all six categories, each empty, while the catalog has no nodes", () => {
    render(<NodePalette onAdd={vi.fn()} registry={{}} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.getAllByText("flows.builder.groupEmpty")).toHaveLength(6);
    expect(
      screen.queryByText("flows.builder.paletteNoMatch"),
    ).not.toBeInTheDocument();
  });

  it("reports no match when searching a catalog that has no nodes", () => {
    render(<NodePalette onAdd={vi.fn()} registry={{}} />);
    fireEvent.change(
      screen.getByPlaceholderText("flows.builder.paletteSearch"),
      {
        target: { value: "agent" },
      },
    );
    expect(
      screen.getByText("flows.builder.paletteNoMatch"),
    ).toBeInTheDocument();
  });
});
