import { describe, expect, it } from "vitest";

import { FLOW_NODE_TYPES } from "./node-types";
import {
  CATEGORY_ORDER,
  NODE_REGISTRY,
  getNodeDef,
  listNodesByCategory,
  registryIdOf,
  type NodeDef,
} from "./node-catalog";

const def = (id: string, category: NodeDef["category"]): NodeDef => ({
  id,
  engine: "agent",
  category,
  icon: "Bot",
  accent: "#000",
  fields: [],
});

const fake: Record<string, NodeDef> = {
  note: def("note", "actions"),
  agent: def("agent", "ai"),
  notify: def("notify", "actions"),
};

describe("registryIdOf", () => {
  it("maps triggers to trigger_<kind> and defaults to manual", () => {
    expect(registryIdOf("trigger", { triggerKind: "message" })).toBe(
      "trigger_message",
    );
    expect(registryIdOf("trigger", {})).toBe("trigger_manual");
  });

  it("uses the engine type for every other node", () => {
    expect(registryIdOf("agent", {})).toBe("agent");
  });
});

describe("node catalog helpers", () => {
  it("groups nodes by category in CATEGORY_ORDER, dropping empty groups", () => {
    const groups = listNodesByCategory(fake);
    expect(groups.map((g) => g.category)).toEqual(["ai", "actions"]);
    expect(groups[1].nodes.map((n) => n.id).sort()).toEqual(["note", "notify"]);
    expect(CATEGORY_ORDER).toEqual([
      "trigger",
      "ai",
      "logic",
      "apps",
      "data",
      "actions",
    ]);
  });

  it("returns no groups for an empty registry", () => {
    expect(listNodesByCategory({})).toEqual([]);
  });

  it("looks a node up by id", () => {
    expect(getNodeDef("agent", fake)).toBe(fake.agent);
    expect(getNodeDef("nope", fake)).toBeUndefined();
    expect(getNodeDef("constructor", fake)).toBeUndefined();
  });
});

// Invariants that must hold for every node added to the real catalog. They are
// vacuously true while the catalog is empty and become real guards per node.
describe("NODE_REGISTRY invariants", () => {
  it("every catalog entry is keyed by its id and uses a known engine and category", () => {
    for (const [key, node] of Object.entries(NODE_REGISTRY)) {
      expect(node.id, key).toBe(key);
      expect(FLOW_NODE_TYPES, key).toContain(node.engine);
      expect(CATEGORY_ORDER, key).toContain(node.category);
    }
  });

  it("field keys are unique within a node", () => {
    for (const [key, node] of Object.entries(NODE_REGISTRY)) {
      const keys = node.fields.map((f) => f.key);
      expect(new Set(keys).size, key).toBe(keys.length);
    }
  });

  it("trigger nodes fix a triggerKind that matches their id", () => {
    for (const [key, node] of Object.entries(NODE_REGISTRY)) {
      if (node.engine !== "trigger") continue;
      expect(key).toBe(`trigger_${String(node.fixedConfig?.triggerKind)}`);
    }
  });
});
