import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { FLOW_TEMPLATES } from "./templates";

const t = ((key: string) => key) as unknown as TFunction;

const built = (id: string) => {
  const template = FLOW_TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error(`missing template ${id}`);
  return template.build(t);
};

describe("flow templates", () => {
  it("offers blank, faq and alert in that order", () => {
    expect(FLOW_TEMPLATES.map((item) => item.id)).toEqual([
      "blank",
      "faq",
      "alert",
    ]);
  });

  it("blank has no nodes or edges", () => {
    expect(built("blank")).toEqual({
      name: "flows.templates.blank.name",
      description: "flows.templates.blank.description",
      nodes: [],
      edges: [],
    });
  });

  it("faq is trigger(message) -> agent", () => {
    const faq = built("faq");
    expect(faq.name).toBe("flows.templates.faq.name");
    expect(faq.nodes).toEqual([
      {
        id: "t",
        type: "trigger",
        label: "flows.templates.faq.nodes.trigger",
        config: { triggerKind: "message" },
        position: { x: 0, y: 0 },
      },
      {
        id: "a",
        type: "agent",
        label: "flows.templates.faq.nodes.agent",
        config: { prompt: "" },
        position: { x: 280, y: 0 },
      },
    ]);
    expect(faq.edges).toEqual([{ id: "t-a", source: "t", target: "a" }]);
  });

  it("alert is trigger(message) -> notify", () => {
    const alert = built("alert");
    expect(alert.nodes.map((node) => node.type)).toEqual(["trigger", "notify"]);
    expect(alert.nodes[1].config).toEqual({ to: "", message: "" });
    expect(alert.edges).toEqual([{ id: "t-n", source: "t", target: "n" }]);
  });

  it.each(["blank", "faq", "alert"])(
    "%s has unique node ids and edges that point at real nodes",
    (id) => {
      const { nodes, edges } = built(id);
      const ids = nodes.map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const edge of edges) {
        expect(ids).toContain(edge.source);
        expect(ids).toContain(edge.target);
      }
    },
  );
});
