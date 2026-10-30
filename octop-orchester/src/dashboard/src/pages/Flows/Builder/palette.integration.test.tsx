import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { get, update, registry } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  registry: {
    agent: {
      id: "agent",
      engine: "agent",
      category: "ai",
      icon: "Bot",
      accent: "#8b5cf6",
      fields: [],
    },
    trigger_manual: {
      id: "trigger_manual",
      engine: "trigger",
      category: "trigger",
      icon: "Play",
      accent: "#10b981",
      fields: [],
      fixedConfig: { triggerKind: "manual" },
    },
  } as Record<string, unknown>,
}));

vi.mock("../../../api/modules/flows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/modules/flows")>()),
  flowApi: { get, update },
}));
vi.mock("@/utils/antdMessage", () => ({
  message: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("../lib/node-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/node-catalog")>()),
  NODE_REGISTRY: registry,
  getNodeDef: (id: string) => registry[id],
}));

import type { FlowDTO } from "../../../api/modules/flows";
import { FlowBuilder } from "./index";

const flow: FlowDTO = {
  id: "f1",
  name: "Bot",
  description: null,
  status: "draft",
  nodes: [],
  edges: [],
  variables: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

async function open() {
  get.mockResolvedValue(flow);
  update.mockImplementation(async (_id: string, body: object) => ({
    ...flow,
    ...body,
  }));
  render(<FlowBuilder flowId="f1" />);
  await screen.findByDisplayValue("Bot");
}

const lastSaved = () =>
  update.mock.calls.at(-1)![1] as {
    nodes: { id: string; type: string; label: string }[];
    edges: unknown[];
  };

beforeEach(() => {
  get.mockReset();
  update.mockReset();
});

describe("palette, canvas and inspector working together", () => {
  it("lists the cataloged nodes in the palette", async () => {
    await open();
    expect(screen.getByText("flows.nodes.agent.title")).toBeInTheDocument();
    expect(
      screen.getByText("flows.nodes.trigger_manual.title"),
    ).toBeInTheDocument();
  });

  it("adds a node from the palette, selects it, and shows it in the inspector", async () => {
    await open();
    fireEvent.click(screen.getByText("flows.nodes.trigger_manual.title"));

    // the empty guide disappears, the card is on the canvas, the inspector describes it
    await waitFor(() =>
      expect(
        screen.queryByTestId("empty-canvas-guide"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("builder-canvas")).toHaveTextContent(
      "flows.nodes.trigger_manual.title",
    );
    expect(screen.getByLabelText("flows.builder.nodeName")).toHaveValue(
      "flows.nodes.trigger_manual.title",
    );
  });

  it("chains a second node from the selected one and saves both with their link", async () => {
    await open();
    fireEvent.click(screen.getByText("flows.nodes.trigger_manual.title"));
    await screen.findByLabelText("flows.builder.nodeName");
    fireEvent.click(screen.getByText("flows.nodes.agent.title"));
    await waitFor(() =>
      expect(screen.getByTestId("builder-canvas")).toHaveTextContent(
        "flows.nodes.agent.title",
      ),
    );

    fireEvent.click(screen.getByText("flows.builder.save"));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const saved = lastSaved();
    expect(saved.nodes.map((n) => n.type)).toEqual(["trigger", "agent"]);
    expect(saved.edges).toHaveLength(1);
  });

  it("renames from the inspector and the card follows", async () => {
    await open();
    fireEvent.click(screen.getByText("flows.nodes.agent.title"));
    const input = await screen.findByLabelText("flows.builder.nodeName");
    fireEvent.change(input, { target: { value: "Answer FAQs" } });
    await waitFor(() =>
      expect(screen.getByTestId("builder-canvas")).toHaveTextContent(
        "Answer FAQs",
      ),
    );
  });

  it("deleting from the inspector removes the node and empties the inspector", async () => {
    await open();
    fireEvent.click(screen.getByText("flows.nodes.agent.title"));
    fireEvent.click(await screen.findByLabelText("flows.builder.deleteNode"));

    await waitFor(() =>
      expect(
        screen.getByText("flows.builder.inspectorEmpty"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("builder-canvas")).not.toHaveTextContent(
      "flows.nodes.agent.title",
    );
    expect(screen.getByTestId("empty-canvas-guide")).toBeInTheDocument();
  });
});
