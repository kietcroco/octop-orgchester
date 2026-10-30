import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { update, remove, messageError, confirm } = vi.hoisted(() => ({
  update: vi.fn(),
  remove: vi.fn(),
  messageError: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("../../../api/modules/flows", () => ({ flowApi: { update, remove } }));
vi.mock("@/utils/antdMessage", () => ({
  message: { error: messageError, success: vi.fn() },
}));
vi.mock("@/utils/antdModal", () => ({ modal: { confirm } }));

import type { FlowSummary } from "../../../api/modules/flows";
import { FlowCard } from "./FlowCard";

const flow: FlowSummary = {
  id: "f1",
  name: "Support bot",
  description: "Answers FAQs",
  status: "draft",
  nodeCount: 3,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function setup() {
  const props = {
    flow,
    onOpen: vi.fn(),
    onStatusChange: vi.fn(),
    onDeleted: vi.fn(),
  };
  render(<FlowCard {...props} />);
  return props;
}

const openMenu = () =>
  fireEvent.click(screen.getByLabelText("flows.actions.more"));

beforeEach(() => {
  update.mockReset();
  remove.mockReset();
  messageError.mockReset();
  confirm.mockReset();
});

describe("FlowCard", () => {
  it("renders name, description, step count and a status tag", () => {
    setup();
    expect(screen.getByText("Support bot")).toBeInTheDocument();
    expect(screen.getByText("Answers FAQs")).toBeInTheDocument();
    expect(screen.getByText(/3 flows\.stepCount/)).toBeInTheDocument();
    expect(screen.getByText("flows.status.draft")).toBeInTheDocument();
  });

  it("opens the flow when the title is clicked", () => {
    const props = setup();
    fireEvent.click(screen.getByText("Support bot"));
    expect(props.onOpen).toHaveBeenCalledWith("f1");
  });

  it("changes status from the actions menu", async () => {
    update.mockResolvedValue({ ...flow, status: "active" });
    const props = setup();

    openMenu();
    fireEvent.click(await screen.findByText("flows.actions.setActive"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("f1", { status: "active" }),
    );
    await waitFor(() =>
      expect(props.onStatusChange).toHaveBeenCalledWith("f1", "active"),
    );
  });

  it("toasts and keeps the status when the update fails", async () => {
    update.mockRejectedValue(new Error("boom"));
    const props = setup();

    openMenu();
    fireEvent.click(await screen.findByText("flows.actions.setPaused"));

    await waitFor(() =>
      expect(messageError).toHaveBeenCalledWith("flows.statusFailed"),
    );
    expect(props.onStatusChange).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    remove.mockResolvedValue(undefined);
    confirm.mockImplementation(
      (config: { onOk?: () => unknown }) => config.onOk?.(),
    );
    const props = setup();

    openMenu();
    fireEvent.click(await screen.findByText("flows.delete"));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("f1"));
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith("f1"));
  });

  it("keeps the flow when the confirmation is cancelled", async () => {
    confirm.mockImplementation(() => undefined);
    const props = setup();

    openMenu();
    fireEvent.click(await screen.findByText("flows.delete"));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    expect(props.onDeleted).not.toHaveBeenCalled();
  });
});
