import { request } from "../request";

/** Row shape from ``GET /api/agencies``. */
export interface AgencySummary {
  agency_id: string;
  name: string;
  description: string | null;
  color: string;
  icon_name: string | null;
  agent_count: number;
  channel_count: number;
  created_at: number;
  updated_at: number;
}

export interface AgencyAgent {
  agent_id: string;
  name: string;
  color: string | null;
  icon_name: string | null;
  state: string | null;
  default_model: string | null;
  user_id: number | null;
}

export interface AgencyChannel {
  channel_id: string;
  agent_id: string;
  name: string;
  kind: string;
  enabled: boolean;
}

export interface AgencyDetail extends AgencySummary {
  agents: AgencyAgent[];
  channels: AgencyChannel[];
}

export interface AgencyWriteBody {
  name?: string;
  description?: string | null;
  color?: string;
  icon_name?: string | null;
}

export function listAgencies(): Promise<AgencySummary[]> {
  return request<AgencySummary[]>("/agencies");
}

export function createAgency(body: AgencyWriteBody): Promise<AgencySummary> {
  return request<AgencySummary>("/agencies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAgency(agencyId: string): Promise<AgencyDetail> {
  return request<AgencyDetail>(`/agencies/${encodeURIComponent(agencyId)}`);
}

export function updateAgency(
  agencyId: string,
  body: AgencyWriteBody,
): Promise<AgencyDetail> {
  return request<AgencyDetail>(`/agencies/${encodeURIComponent(agencyId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAgency(agencyId: string): Promise<void> {
  return request<void>(`/agencies/${encodeURIComponent(agencyId)}`, {
    method: "DELETE",
  });
}

export function setAgencyMembers(
  agencyId: string,
  agentIds: string[],
): Promise<AgencyDetail> {
  return request<AgencyDetail>(
    `/agencies/${encodeURIComponent(agencyId)}/members`,
    {
      method: "PUT",
      body: JSON.stringify({ agent_ids: agentIds }),
    },
  );
}

export function getAgentAgencies(
  agentId: string,
): Promise<{ agency_ids: string[] }> {
  return request<{ agency_ids: string[] }>(
    `/agencies/by-agent/${encodeURIComponent(agentId)}`,
  );
}

export function setAgentAgencies(
  agentId: string,
  agencyIds: string[],
): Promise<{ agency_ids: string[] }> {
  return request<{ agency_ids: string[] }>(
    `/agencies/by-agent/${encodeURIComponent(agentId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ agency_ids: agencyIds }),
    },
  );
}
