import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const {
  list,
  get,
  update,
  remove,
  messageError,
  messageSuccess,
  confirm,
  navigate,
} = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  confirm: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../../api/modules/flows", () => ({
  flowApi: { list, get, update, remove },
}));
vi.mock("@/utils/antdMessage", () => ({
  message: { error: messageError, success: messageSuccess },
}));
vi.mock("@/utils/antdModal", () => ({ modal: { confirm } }));
vi.mock("../../hooks/useIsMobile", () => ({ useIsMobile: () => false }));
// PageShell pulls in the agent context; the page body is what is under test.
vi.mock("../../layouts/PageShell", () => ({
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));
// The modal has its own tests; here it only has to open and report a created flow.
vi.mock("./components/CreateFlowModal", () => ({
  CreateFlowModal: ({
    open,
    onCreated,
  }: {
    open: boolean;
    onCreated: (flow: { id: string; name: string }) => void;
  }) =>
    open ? (
      <button onClick={() => onCreated({ id: "new/1", name: "New" })}>
        modal-create
      </button>
    ) : null,
}));
vi.mock("./Builder", () => ({
  FlowBuilder: ({ flowId }: { flowId: string }) => <div>builder:{flowId}</div>,
}));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

import type { FlowSummary } from "../../api/modules/flows";
import FlowsPage from "./index";

const row = (
  id: string,
  name: string,
  status: FlowSummary["status"],
): FlowSummary => ({
  id,
  name,
  description: null,
  status,
  nodeCount: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/flows" element={<FlowsPage />} />
        <Route path="/flows/:flowId" element={<FlowsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  [
    list,
    get,
    update,
    remove,
    messageError,
    messageSuccess,
    confirm,
    navigate,
  ].forEach((fn) => fn.mockReset());
});

describe("Flows list", () => {
  it("shows the empty state with a create action when there are no flows", async () => {
    list.mockResolvedValue([]);
    renderAt("/flows");

    expect(await screen.findByText("flows.empty")).toBeInTheDocument();
    expect(screen.getByText("flows.emptyHint")).toBeInTheDocument();
    expect(screen.getAllByText("flows.create").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("groups flows under status headings in active, paused, draft order", async () => {
    list.mockResolvedValue([
      row("1", "Draft one", "draft"),
      row("2", "Active one", "active"),
      row("3", "Paused one", "paused"),
    ]);
    renderAt("/flows");

    await screen.findByText("Active one");
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((el) => el.textContent);
    expect(headings).toEqual([
      "flows.status.active1",
      "flows.status.paused1",
      "flows.status.draft1",
    ]);
  });

  it("filters by search text", async () => {
    list.mockResolvedValue([
      row("1", "Support bot", "draft"),
      row("2", "Daily report", "draft"),
    ]);
    renderAt("/flows");
    await screen.findByText("Support bot");

    fireEvent.change(screen.getByPlaceholderText("flows.searchPlaceholder"), {
      target: { value: "daily" },
    });

    expect(screen.queryByText("Support bot")).not.toBeInTheDocument();
    expect(screen.getByText("Daily report")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("flows.searchPlaceholder"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("flows.empty")).toBeInTheDocument();
  });

  it("shows an error toast when loading fails", async () => {
    list.mockRejectedValue(new Error("boom"));
    renderAt("/flows");
    await waitFor(() =>
      expect(messageError).toHaveBeenCalledWith("flows.loadFailed"),
    );
  });

  it("opens a flow when its card is clicked", async () => {
    list.mockResolvedValue([row("a/1", "Support bot", "draft")]);
    renderAt("/flows");

    fireEvent.click(await screen.findByText("Support bot"));
    expect(navigate).toHaveBeenCalledWith("/flows/a%2F1");
  });

  it("returns to the empty state after removing the last flow", async () => {
    list.mockResolvedValue([row("1", "Only one", "draft")]);
    remove.mockResolvedValue(undefined);
    confirm.mockImplementation(
      (config: { onOk?: () => unknown }) => config.onOk?.(),
    );
    renderAt("/flows");
    await screen.findByText("Only one");

    fireEvent.click(screen.getByLabelText("flows.actions.more"));
    fireEvent.click(await screen.findByText("flows.delete"));

    expect(await screen.findByText("flows.empty")).toBeInTheDocument();
    expect(screen.queryByText("Only one")).not.toBeInTheDocument();
  });
});

describe("Flows create", () => {
  it("opens the create modal from the toolbar and from the empty state", async () => {
    list.mockResolvedValue([]);
    renderAt("/flows");
    await screen.findByText("flows.empty");

    const buttons = screen.getAllByText("flows.create");
    expect(buttons).toHaveLength(2); // toolbar + empty-state action
    expect(screen.queryByText("modal-create")).not.toBeInTheDocument();

    fireEvent.click(buttons[0]);
    expect(screen.getByText("modal-create")).toBeInTheDocument();
  });

  it("toasts and opens the new flow after creation", async () => {
    list.mockResolvedValue([]);
    renderAt("/flows");
    await screen.findByText("flows.empty");

    fireEvent.click(screen.getAllByText("flows.create")[1]);
    fireEvent.click(screen.getByText("modal-create"));

    expect(messageSuccess).toHaveBeenCalledWith("flows.created");
    expect(navigate).toHaveBeenCalledWith("/flows/new%2F1");
    expect(screen.queryByText("modal-create")).not.toBeInTheDocument();
  });
});

describe("Flows detail route", () => {
  it("renders the builder for /flows/:flowId instead of the list", async () => {
    renderAt("/flows/f1");

    expect(await screen.findByText("builder:f1")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText("flows.title")).not.toBeInTheDocument();
  });
});
