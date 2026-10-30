import { describe, expect, it } from "vitest";

import type { OrgEdge, OrgNode } from "../../api/modules/orgChart";
import {
  AGENCY_NODE_W,
  AGENT_NODE_W,
  COL_GAP_AGENCY,
  MAX_ROW_WIDTH,
  ROW_AGENCY_Y,
  ROW_AGENT_Y,
  ROW_BAND_HEIGHT,
  layoutNodes,
} from "./layout";

const root: OrgNode = {
  id: "root:org",
  type: "root",
  label: "",
  meta: { agencyCount: 0, agentCount: 0, teamCount: 0, channelCount: 0 },
};

function agency(id: string, agentCount: number): { nodes: OrgNode[]; edges: OrgEdge[] } {
  const agencyNode: OrgNode = {
    id: `agency:${id}`,
    type: "agency",
    label: id,
    meta: {
      description: null,
      color: null,
      iconName: null,
      agentCount,
      activeCount: 0,
    },
  };
  const nodes: OrgNode[] = [agencyNode];
  const edges: OrgEdge[] = [];
  for (let i = 0; i < agentCount; i += 1) {
    const agentId = `${id}-a${i}`;
    nodes.push({
      id: `agent:${agentId}`,
      type: "agent",
      label: agentId,
      meta: {
        agentId,
        description: null,
        model: null,
        state: "idle",
        color: null,
        iconName: null,
        kind: "expert",
        channelCount: 0,
        channels: [],
        teamMember: false,
      },
    });
    edges.push({
      id: `agency-agent:${id}:${agentId}`,
      source: `agency:${id}`,
      target: `agent:${agentId}`,
      kind: "agency-agent",
    });
  }
  return { nodes, edges };
}

function graph(...agencies: Array<{ nodes: OrgNode[]; edges: OrgEdge[] }>) {
  return {
    nodes: [root, ...agencies.flatMap((a) => a.nodes)],
    edges: agencies.flatMap((a) => a.edges),
  };
}

describe("org chart layout", () => {
  it("places the root above every agency", () => {
    const g = graph(agency("one", 2));
    const laid = layoutNodes(g.nodes, g.edges);
    const rootNode = laid.find((n) => n.type === "root")!;
    expect(rootNode.position.y).toBe(0);
    for (const node of laid) {
      if (node.type !== "root") expect(node.position.y).toBeGreaterThan(0);
    }
  });

  it("centres each agency over its own agents", () => {
    const g = graph(agency("one", 3));
    const laid = layoutNodes(g.nodes, g.edges);
    const node = laid.find((n) => n.id === "agency:one")!;
    const agents = laid.filter((n) => n.type === "agent");
    const left = Math.min(...agents.map((a) => a.position.x));
    const right = Math.max(...agents.map((a) => a.position.x + AGENT_NODE_W));
    expect(node.position.x + AGENCY_NODE_W / 2).toBeCloseTo((left + right) / 2);
  });

  it("drops an agency that has no visible agent", () => {
    const g = graph(agency("one", 2), agency("empty", 0));
    const laid = layoutNodes(g.nodes, g.edges);
    expect(laid.map((n) => n.id)).not.toContain("agency:empty");
  });

  it("keeps agents on the row directly below their agency", () => {
    const g = graph(agency("one", 2));
    const laid = layoutNodes(g.nodes, g.edges);
    const node = laid.find((n) => n.id === "agency:one")!;
    const agents = laid.filter((n) => n.type === "agent");
    expect(node.position.y).toBe(ROW_AGENCY_Y);
    for (const a of agents) expect(a.position.y).toBe(ROW_AGENT_Y);
    expect(ROW_AGENT_Y).toBeGreaterThan(ROW_AGENCY_Y);
  });

  it("packs a wide set of agencies into several rows without overlap", () => {
    const agencies = Array.from({ length: 8 }, (_, i) => agency(`a${i}`, 3));
    const g = graph(...agencies);
    const laid = layoutNodes(g.nodes, g.edges);
    const rows = new Set(
      laid.filter((n) => n.type === "agency").map((n) => n.position.y),
    );
    expect(rows.size).toBeGreaterThan(1);
    for (const rowY of rows) {
      const inRow = laid.filter(
        (n) => n.type === "agency" && n.position.y === rowY,
      );
      const width =
        inRow.length * 3 * 240 + COL_GAP_AGENCY * (inRow.length - 1);
      expect(width).toBeLessThanOrEqual(MAX_ROW_WIDTH);
    }
    const ys = [...rows].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i] - ys[i - 1]).toBe(ROW_BAND_HEIGHT);
    }
  });

  it("gives an agency wider than the row cap a row of its own", () => {
    const wide = agency("wide", 12);
    const g = graph(wide, agency("small", 1));
    const big = (wide.nodes[0].meta as { agentCount: number }).agentCount;
    expect(big * 240).toBeGreaterThan(MAX_ROW_WIDTH);
    const laid = layoutNodes(g.nodes, g.edges);
    const wideY = laid.find((n) => n.id === "agency:wide")!.position.y;
    const smallY = laid.find((n) => n.id === "agency:small")!.position.y;
    expect(wideY).not.toBe(smallY);
  });

  it("renders the root centred when there is nothing else", () => {
    const laid = layoutNodes([root], []);
    expect(laid).toHaveLength(1);
    expect(laid[0].id).toBe("root:org");
  });
});
