import type { FlowStatus } from "../../../api/modules/flows";

// Ported from Orchester lib/flows/group-by-status.ts.
const FLOW_STATUSES: readonly FlowStatus[] = ["active", "paused", "draft"];

/** Group flows by status in display order, keeping input order, dropping empty groups. */
export function groupFlowsByStatus<T extends { status: FlowStatus }>(
  flows: readonly T[],
): { status: FlowStatus; flows: T[] }[] {
  return FLOW_STATUSES.map((status) => ({
    status,
    flows: flows.filter((flow) => flow.status === status),
  })).filter((group) => group.flows.length > 0);
}
