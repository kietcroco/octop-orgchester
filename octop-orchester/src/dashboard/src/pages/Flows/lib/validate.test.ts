import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import { validateFlow } from "./validate";

const node = (id: string, type: string): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, config: {} },
});
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("validateFlow", () => {
  it("has nothing to say about an empty flow", () => {
    expect(validateFlow([], [])).toEqual([]);
  });

  it("requires a trigger once there are steps", () => {
    const issues = validateFlow([node("a", "agent")], []);
    expect(issues).toContainEqual({ level: "error", code: "no_trigger" });
  });

  it("is happy with a connected trigger -> step flow", () => {
    expect(
      validateFlow(
        [node("t", "trigger"), node("a", "agent")],
        [edge("t", "a")],
      ),
    ).toEqual([]);
  });

  it("flags an edge that points at a missing step", () => {
    const issues = validateFlow([node("t", "trigger")], [edge("t", "ghost")]);
    expect(issues).toContainEqual({ level: "error", code: "broken_edge" });
  });

  it("warns about a step connected to nothing, naming the node", () => {
    const issues = validateFlow(
      [node("t", "trigger"), node("a", "agent"), node("lonely", "notify")],
      [edge("t", "a")],
    );
    expect(issues).toEqual([
      { level: "warning", code: "disconnected", nodeId: "lonely" },
    ]);
  });

  it("does not warn about triggers, notes or a single-step flow", () => {
    expect(
      validateFlow(
        [node("t", "trigger"), node("n", "note"), node("a", "agent")],
        [edge("t", "a")],
      ),
    ).toEqual([]);
    expect(validateFlow([node("t", "trigger")], [])).toEqual([]);
  });
});
