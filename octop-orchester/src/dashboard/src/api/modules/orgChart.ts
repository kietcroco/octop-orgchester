import { request } from "../request";

export interface OrgChannel {
  channelId: string;
  name: string;
  kind: string;
}

export interface OrgAgentMeta {
  agentId: string;
  description: string | null;
  model: string | null;
  state: string;
  color: string | null;
  iconName: string | null;
  kind: string;
  channelCount: number;
  channels: OrgChannel[];
  teamMember: boolean;
}

export interface OrgAgencyMeta {
  description: string | null;
  color: string | null;
  iconName: string | null;
  agentCount: number;
  activeCount: number;
  unassigned?: boolean;
}

export interface OrgRootMeta {
  agencyCount: number;
  agentCount: number;
  teamCount: number;
  channelCount: number;
}

export interface OrgNode {
  id: string;
  type: "root" | "agency" | "agent";
  label: string;
  meta: OrgRootMeta | OrgAgencyMeta | OrgAgentMeta;
}

export interface OrgEdge {
  id: string;
  source: string;
  target: string;
  kind: "root-agency" | "agency-agent" | "team-agent";
  animated?: boolean;
  label?: string;
}

export interface OrgSummary {
  agencies: number;
  agents: number;
  activeAgents: number;
  teams: number;
  channels: number;
}

export interface OrgGraph {
  nodes: OrgNode[];
  edges: OrgEdge[];
  summary: OrgSummary;
}

export function getOrgGraph(): Promise<OrgGraph> {
  return request<OrgGraph>("/org-graph");
}
