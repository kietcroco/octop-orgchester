import type { TFunction } from "i18next";

import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "../../../api/modules/flows";

/**
 * Starter flows offered when creating a flow (Orchester: lib/flows/templates.ts).
 * Nodes are written directly in stored form; once the node registry exists a
 * test there should assert every template node resolves to a registered node.
 */

export type FlowTemplateId = "blank" | "faq" | "alert";

export interface BuiltFlowTemplate {
  name: string;
  description: string;
  nodes: StoredFlowNode[];
  edges: StoredFlowEdge[];
}

export interface FlowTemplate {
  id: FlowTemplateId;
  build(t: TFunction): BuiltFlowTemplate;
}

const COL = 280;

const messageTrigger = (label: string): StoredFlowNode => ({
  id: "t",
  type: "trigger",
  label,
  config: { triggerKind: "message" },
  position: { x: 0, y: 0 },
});

export const FLOW_TEMPLATES: readonly FlowTemplate[] = [
  {
    id: "blank",
    build: (t) => ({
      name: t("flows.templates.blank.name"),
      description: t("flows.templates.blank.description"),
      nodes: [],
      edges: [],
    }),
  },
  {
    id: "faq",
    build: (t) => ({
      name: t("flows.templates.faq.name"),
      description: t("flows.templates.faq.description"),
      nodes: [
        messageTrigger(t("flows.templates.faq.nodes.trigger")),
        {
          id: "a",
          type: "agent",
          label: t("flows.templates.faq.nodes.agent"),
          config: { prompt: "" },
          position: { x: COL, y: 0 },
        },
      ],
      edges: [{ id: "t-a", source: "t", target: "a" }],
    }),
  },
  {
    id: "alert",
    build: (t) => ({
      name: t("flows.templates.alert.name"),
      description: t("flows.templates.alert.description"),
      nodes: [
        messageTrigger(t("flows.templates.alert.nodes.trigger")),
        {
          id: "n",
          type: "notify",
          label: t("flows.templates.alert.nodes.notify"),
          config: { to: "", message: "" },
          position: { x: COL, y: 0 },
        },
      ],
      edges: [{ id: "t-n", source: "t", target: "n" }],
    }),
  },
];
