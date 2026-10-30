import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { get, update, navigate, messageError, messageSuccess } = vi.hoisted(
  () => ({
    get: vi.fn(),
    update: vi.fn(),
    navigate: vi.fn(),
    messageError: vi.fn(),
    messageSuccess: vi.fn(),
  }),
);

vi.mock("../../../api/modules/flows", () => ({ flowApi: { get, update } }));
vi.mock("@/utils/antdMessage", () => ({
  message: { error: messageError, success: messageSuccess },
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

import type { FlowDTO } from "../../../api/modules/flows";
import { FlowBuilder } from "./index";

const flow: FlowDTO = {
  id: "f1",
  name: "Support bot",
  description: null,
  status: "draft",
  nodes: [],
  edges: [],
  variables: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const nameInput = () =>
  screen.getByLabelText("flows.builder.nameLabel") as HTMLInputElement;
const saveButton = () => screen.getByText("flows.builder.save");

async function renderLoaded() {
  get.mockResolvedValue(flow);
  render(<FlowBuilder flowId="f1" />);
  await screen.findByDisplayValue("Support bot");
}

beforeEach(() => {
  [get, update, navigate, messageError, messageSuccess].forEach((fn) =>
    fn.mockReset(),
  );
});

describe("FlowBuilder shell", () => {
  it("loads the flow and lays out palette, canvas and inspector", async () => {
    await renderLoaded();
    expect(get).toHaveBeenCalledWith("f1");
    expect(screen.getByTestId("builder-palette")).toBeInTheDocument();
    expect(screen.getByTestId("builder-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("builder-inspector")).toBeInTheDocument();
  });

  it("shows Run disabled with an explanation", async () => {
    await renderLoaded();
    const run = screen.getByText("flows.builder.run").closest("button")!;
    expect(run).toBeDisabled();

    fireEvent.mouseEnter(screen.getByTestId("builder-run-wrapper"));
    expect(
      await screen.findByText("flows.builder.runDisabled"),
    ).toBeInTheDocument();
  });

  it("saves an edited name and toasts", async () => {
    update.mockResolvedValue({ ...flow, name: "Mới" });
    await renderLoaded();

    fireEvent.change(nameInput(), { target: { value: "Mới" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "f1",
        expect.objectContaining({ name: "Mới" }),
      ),
    );
    await waitFor(() =>
      expect(messageSuccess).toHaveBeenCalledWith("flows.builder.saved"),
    );
  });

  it("trims the name before saving", async () => {
    update.mockResolvedValue(flow);
    await renderLoaded();
    fireEvent.change(nameInput(), { target: { value: "  Spaced  " } });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "f1",
        expect.objectContaining({ name: "Spaced" }),
      ),
    );
  });

  it("toasts when saving fails", async () => {
    update.mockRejectedValue(new Error("boom"));
    await renderLoaded();
    fireEvent.change(nameInput(), { target: { value: "X" } });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(messageError).toHaveBeenCalledWith("flows.builder.saveFailed"),
    );
    expect(messageSuccess).not.toHaveBeenCalled();
  });

  it("does not save a blank or whitespace-only name", async () => {
    await renderLoaded();
    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.click(saveButton());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(update).not.toHaveBeenCalled();
  });

  it("changes the status straight away", async () => {
    update.mockResolvedValue({ ...flow, status: "active" });
    await renderLoaded();

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("flows.status.active"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("f1", { status: "active" }),
    );
  });

  it("goes back to the list", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText("flows.builder.back"));
    expect(navigate).toHaveBeenCalledWith("/flows");
  });

  it("shows not-found with a way back when the flow is missing", async () => {
    get.mockRejectedValue(new Error("flow not found"));
    render(<FlowBuilder flowId="nope" />);

    expect(await screen.findByText("flows.notFound")).toBeInTheDocument();
    fireEvent.click(screen.getByText("flows.back"));
    expect(navigate).toHaveBeenCalledWith("/flows");
  });
});
