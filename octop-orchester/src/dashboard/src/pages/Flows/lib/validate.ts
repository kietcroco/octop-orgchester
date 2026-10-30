import type { Edge, Node } from "@xyflow/react";

/**
 * Plain-language flow checks (ported from Orchester lib/flows/validate.ts).
 * Issues carry a code and a node id, never text: the panel words them through
 * i18n. Per-node rules (e.g. required fields) are added together with the node.
 */

export type ValidationCode = "no_trigger" | "broken_edge" | "disconnected";

export interface ValidationIssue {
  level: "error" | "warning";
  code: ValidationCode;
  nodeId?: string;
}

export function validateFlow(
  nodes: readonly Node[],
  edges: readonly Edge[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (nodes.length > 0 && !nodes.some((node) => node.type === "trigger")) {
    issues.push({ level: "error", code: "no_trigger" });
  }

  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      issues.push({ level: "error", code: "broken_edge" });
    }
  }

  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  for (const node of nodes) {
    const exempt = node.type === "trigger" || node.type === "note";
    if (!exempt && nodes.length > 1 && !connected.has(node.id)) {
      issues.push({ level: "warning", code: "disconnected", nodeId: node.id });
    }
  }

  return issues;
}
