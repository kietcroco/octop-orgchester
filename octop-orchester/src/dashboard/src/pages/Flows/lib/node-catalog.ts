import type { FieldDef } from "./field-types";
import type { FlowNodeType } from "./node-types";

/**
 * Node catalog — single source of truth for the palette, the canvas card and
 * the inspector. It starts EMPTY on purpose: each node is added on its own
 * (entry here + `flows.nodes.<id>.*` copy + field renderers + tests) so a node
 * reaches the UI complete.
 */

export type NodeCategory =
  | "trigger"
  | "ai"
  | "logic"
  | "apps"
  | "data"
  | "actions";

export interface NodeDef {
  /** Unique catalog id; triggers are `trigger_<kind>`. */
  id: string;
  /** Engine type the flow engine runs (several ids can share one). */
  engine: FlowNodeType;
  category: NodeCategory;
  /** lucide icon name, resolved through the canvas `NODE_ICONS` map. */
  icon: string;
  /** Accent colour (hex) of the node card and palette item. */
  accent: string;
  fields: FieldDef[];
  /** Config a freshly added node starts with. */
  defaults?: Record<string, unknown>;
  /** Config values that distinguish variants sharing an engine (e.g. `triggerKind`). */
  fixedConfig?: Record<string, unknown>;
  /** Fixed output handle ids for branching nodes, e.g. `["true", "false"]`. */
  outputs?: string[];
}

export const NODE_REGISTRY: Record<string, NodeDef> = {};

export const CATEGORY_ORDER: readonly NodeCategory[] = [
  "trigger",
  "ai",
  "logic",
  "apps",
  "data",
  "actions",
];

export function getNodeDef(
  id: string,
  registry: Record<string, NodeDef> = NODE_REGISTRY,
): NodeDef | undefined {
  return Object.prototype.hasOwnProperty.call(registry, id)
    ? registry[id]
    : undefined;
}

export function listNodesByCategory(
  registry: Record<string, NodeDef> = NODE_REGISTRY,
): { category: NodeCategory; nodes: NodeDef[] }[] {
  const defs = Object.values(registry);
  return CATEGORY_ORDER.map((category) => ({
    category,
    nodes: defs.filter((def) => def.category === category),
  })).filter((group) => group.nodes.length > 0);
}

/** The catalog id of a stored node — triggers share one engine type. */
export function registryIdOf(
  type: string,
  config: Record<string, unknown>,
): string {
  return type === "trigger"
    ? `trigger_${String(config.triggerKind ?? "manual")}`
    : type;
}
