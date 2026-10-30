import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { create, messageError } = vi.hoisted(() => ({
  create: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock("../../../api/modules/flows", () => ({ flowApi: { create } }));
vi.mock("@/utils/antdMessage", () => ({
  message: { error: messageError, success: vi.fn() },
}));

import type { FlowDTO } from "../../../api/modules/flows";
import { CreateFlowModal } from "./CreateFlowModal";

const created = { id: "new1", name: "x" } as FlowDTO;

function setup(open = true) {
  const props = { open, onClose: vi.fn(), onCreated: vi.fn() };
  const view = render(<CreateFlowModal {...props} />);
  return { props, ...view };
}

const nameInput = () =>
  screen.getByPlaceholderText("flows.namePlaceholder") as HTMLInputElement;
const radios = () => screen.getAllByRole("radio") as HTMLInputElement[];
const save = () => fireEvent.click(screen.getByText("flows.save"));
const hasFieldError = () =>
  document.querySelector(".ant-form-item-explain-error") !== null;

beforeEach(() => {
  create.mockReset();
  messageError.mockReset();
});

describe("CreateFlowModal", () => {
  it("lists the three templates with blank selected", () => {
    setup();
    expect(radios()).toHaveLength(3);
    expect(radios()[0].checked).toBe(true);
    expect(screen.getByText("flows.templates.faq.name")).toBeInTheDocument();
    expect(screen.getByText("flows.templates.alert.name")).toBeInTheDocument();
    expect(nameInput().value).toBe("flows.templates.blank.name");
  });

  it("prefills the name from the chosen template", async () => {
    setup();
    fireEvent.click(radios()[1]);
    await waitFor(() =>
      expect(nameInput().value).toBe("flows.templates.faq.name"),
    );
  });

  it("creates a flow from the chosen template", async () => {
    create.mockResolvedValue(created);
    const { props } = setup();

    fireEvent.click(radios()[2]);
    fireEvent.change(nameInput(), { target: { value: "  Báo tin  " } });
    fireEvent.change(
      screen.getByPlaceholderText("flows.descriptionPlaceholder"),
      {
        target: { value: "  khi có tin  " },
      },
    );
    save();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const body = create.mock.calls[0][0];
    expect(body.name).toBe("Báo tin");
    expect(body.description).toBe("khi có tin");
    expect(body.nodes.map((n: { type: string }) => n.type)).toEqual([
      "trigger",
      "notify",
    ]);
    expect(body.edges).toHaveLength(1);
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith(created));
  });

  it("sends a null description when it is left empty", async () => {
    create.mockResolvedValue(created);
    setup();
    save();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0].description).toBeNull();
  });

  it("blocks a whitespace-only name", async () => {
    setup();
    fireEvent.change(nameInput(), { target: { value: "   " } });
    save();
    await waitFor(() => expect(hasFieldError()).toBe(true));
    expect(create).not.toHaveBeenCalled();
  });

  it("blocks names over 64 characters", async () => {
    setup();
    fireEvent.change(nameInput(), { target: { value: "a".repeat(65) } });
    save();
    await waitFor(() => expect(hasFieldError()).toBe(true));
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps the modal open and toasts on failure", async () => {
    create.mockRejectedValue(new Error("boom"));
    const { props } = setup();
    save();

    await waitFor(() =>
      expect(messageError).toHaveBeenCalledWith("flows.saveFailed"),
    );
    expect(props.onCreated).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("resets to blank when reopened", async () => {
    const { props, rerender } = setup();
    fireEvent.click(radios()[1]);
    await waitFor(() =>
      expect(nameInput().value).toBe("flows.templates.faq.name"),
    );

    rerender(<CreateFlowModal {...props} open={false} />);
    rerender(<CreateFlowModal {...props} open />);

    await waitFor(() => expect(radios()[0].checked).toBe(true));
    expect(nameInput().value).toBe("flows.templates.blank.name");
  });
});
