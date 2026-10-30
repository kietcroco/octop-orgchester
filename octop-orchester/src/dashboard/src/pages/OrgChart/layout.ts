import type {
  OrgAgentMeta,
  OrgAgencyMeta,
  OrgEdge,
  OrgNode,
  OrgRootMeta,
} from "../../api/modules/orgChart";

/**
 * Row packing for the org canvas — ported from Orchester's `OrgCanvas`.
 * Pure: no DOM, no ReactFlow import, so it runs under vitest without the dep.
 */

export const COL_WIDTH_AGENT = 240;
export const COL_GAP_AGENCY = 36;
export const ROW_ROOT_Y = 0;
export const ROW_AGENCY_Y = 150;
export const ROW_AGENT_Y = 300;
export const ROW_BAND_HEIGHT = 540;
export const MAX_ROW_WIDTH = 2400;
export const AGENCY_NODE_W = 220;
export const ROOT_NODE_W = 240;
export const AGENT_NODE_W = 200;

export interface OrgLayoutNode {
  id: string;
  type: "root" | "agency" | "agent";
  position: { x: number; y: number };
  data: {
    label: string;
    meta: OrgRootMeta | OrgAgencyMeta | OrgAgentMeta;
  };
}

interface Group {
  agency: OrgNode;
  agents: OrgNode[];
  width: number;
}

function groupWidth(agentCount: number): number {
  return Math.max(agentCount, 1) * COL_WIDTH_AGENT;
}

function buildGroups(nodes: OrgNode[], edges: OrgEdge[]): Group[] {
  const agentsById = new Map<string, OrgNode>();
  for (const node of nodes) {
    if (node.type === "agent") agentsById.set(node.id, node);
  }
  const members = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "agency-agent") continue;
    members.set(edge.source, [...(members.get(edge.source) ?? []), edge.target]);
  }
  const groups: Group[] = [];
  for (const node of nodes) {
    if (node.type !== "agency") continue;
    const agents = (members.get(node.id) ?? [])
      .map((id) => agentsById.get(id))
      .filter((a): a is OrgNode => Boolean(a));
    // An agency with no visible member is not drawn at all.
    if (agents.length === 0) continue;
    groups.push({ agency: node, agents, width: groupWidth(agents.length) });
  }
  return groups;
}

function packRows(groups: Group[]): Group[][] {
  const rows: Group[][] = [];
  let row: Group[] = [];
  let width = 0;
  for (const group of groups) {
    if (row.length > 0) {
      const next = width + COL_GAP_AGENCY + group.width;
      if (next > MAX_ROW_WIDTH) {
        rows.push(row);
        row = [];
        width = 0;
      }
    }
    width = row.length === 0 ? group.width : width + COL_GAP_AGENCY + group.width;
    row.push(group);
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

export function layoutNodes(nodes: OrgNode[], edges: OrgEdge[]): OrgLayoutNode[] {
  const root = nodes.find((node) => node.type === "root");
  const groups = buildGroups(nodes, edges);
  const rows = packRows(groups);

  const out: OrgLayoutNode[] = [];
  let minX = 0;
  let maxX = 0;

  rows.forEach((row, index) => {
    const rowWidth =
      row.reduce((sum, g) => sum + g.width, 0) + COL_GAP_AGENCY * (row.length - 1);
    // Every row is centred on x = 0, so the root stays centred over all of them.
    let cursor = -rowWidth / 2;
    const agencyY = ROW_AGENCY_Y + index * ROW_BAND_HEIGHT;
    const agentY = ROW_AGENT_Y + index * ROW_BAND_HEIGHT;

    row.forEach((group) => {
      const center = cursor + group.width / 2;
      out.push({
        id: group.agency.id,
        type: "agency",
        position: { x: center - AGENCY_NODE_W / 2, y: agencyY },
        data: { label: group.agency.label, meta: group.agency.meta },
      });
      group.agents.forEach((agent, i) => {
        out.push({
          id: agent.id,
          type: "agent",
          position: {
            x: cursor + i * COL_WIDTH_AGENT + (COL_WIDTH_AGENT - AGENT_NODE_W) / 2,
            y: agentY,
          },
          data: { label: agent.label, meta: agent.meta },
        });
      });
      minX = Math.min(minX, cursor);
      maxX = Math.max(maxX, cursor + group.width);
      cursor += group.width + COL_GAP_AGENCY;
    });
  });

  if (root) {
    out.unshift({
      id: root.id,
      type: "root",
      position: { x: (minX + maxX) / 2 - ROOT_NODE_W / 2, y: ROW_ROOT_Y },
      data: { label: root.label, meta: root.meta },
    });
  }
  return out;
}
