import { request } from "../request";

/** Row shape from ``GET /api/webhooks``. */
export interface WebhookEndpoint {
  endpoint_id: string;
  name: string;
  url: string;
  enabled: boolean;
  types: string[];
  agent_ids: string[];
  include_delta: boolean;
  secret_set: boolean;
  /** Names of the custom headers sent with every delivery. Values are never
   *  returned — they are bearer tokens stored sealed on the server. */
  header_names: string[];
  created_at: number;
  last_delivery_at: number | null;
  last_status: "pending" | "sending" | "delivered" | "failed" | null;
  pending_count: number;
  failed_count: number;
}

/** Create returns the signing secret exactly once. */
export interface WebhookEndpointCreated extends WebhookEndpoint {
  secret: string;
}

export interface WebhookWriteBody {
  name?: string;
  url?: string;
  enabled?: boolean;
  types?: string[];
  agent_ids?: string[];
  include_delta?: boolean;
  /** Custom headers. On update this is the full name set: an omitted name is
   *  removed, and a blank value keeps the stored token. */
  headers?: Record<string, string>;
}

export type DeliveryStatus = "pending" | "sending" | "delivered" | "failed";

export interface WebhookDelivery {
  id: number;
  delivery_id: string;
  event_id: string;
  type: string;
  thread_id: string;
  agent_id: string;
  kind: string;
  seq: number;
  status: DeliveryStatus;
  attempts: number;
  next_attempt_at: number;
  response_code: number | null;
  last_error: string | null;
  created_at: number;
  delivered_at: number | null;
}

export interface WebhookTestResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

export const webhooksApi = {
  list: () => request<WebhookEndpoint[]>("/webhooks"),
  create: (body: WebhookWriteBody) =>
    request<WebhookEndpointCreated>("/webhooks", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (endpointId: string, body: WebhookWriteBody) =>
    request<WebhookEndpoint>(`/webhooks/${encodeURIComponent(endpointId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (endpointId: string) =>
    request<void>(`/webhooks/${encodeURIComponent(endpointId)}`, {
      method: "DELETE",
    }),
  rotateSecret: (endpointId: string) =>
    request<{ endpoint_id: string; secret: string }>(
      `/webhooks/${encodeURIComponent(endpointId)}/rotate-secret`,
      { method: "POST" },
    ),
  test: (endpointId: string) =>
    request<WebhookTestResult>(
      `/webhooks/${encodeURIComponent(endpointId)}/test`,
      { method: "POST" },
    ),
  deliveries: (
    endpointId: string,
    opts?: { status?: DeliveryStatus; limit?: number; beforeId?: number },
  ) => {
    const q = new URLSearchParams();
    if (opts?.status) q.set("status", opts.status);
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.beforeId) q.set("before_id", String(opts.beforeId));
    const qs = q.toString();
    return request<WebhookDelivery[]>(
      `/webhooks/${encodeURIComponent(endpointId)}/deliveries${qs ? `?${qs}` : ""}`,
    );
  },
  retry: (deliveryId: string) =>
    request<{ delivery_id: string; status: string }>(
      `/webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      { method: "POST" },
    ),
};

/**
 * Every type the sink can emit, grouped for the picker. Kept beside the API
 * module because the backend's ``signing.event_type`` is the source of truth —
 * ``scripts/webhook_selfcheck.py`` asserts this list matches it.
 */
export const WEBHOOK_EVENT_TYPES: { group: string; types: string[] }[] = [
  {
    group: "message",
    types: [
      "agent.message.received",
      "agent.message.started",
      "agent.message.delta",
      "agent.message.completed",
      "agent.message.tool_only",
    ],
  },
  { group: "tool", types: ["agent.tool.started", "agent.tool.delta", "agent.tool.completed"] },
  {
    group: "context",
    types: [
      "agent.conversation.started",
      "agent.context.loaded",
      "agent.context.memory",
      "agent.context.compacted",
      "agent.skills.loaded",
      "agent.connectors.loaded",
    ],
  },
  { group: "test", types: ["agent.webhook.test"] },
];

export const ALL_EVENT_TYPES = WEBHOOK_EVENT_TYPES.flatMap((g) => g.types);
