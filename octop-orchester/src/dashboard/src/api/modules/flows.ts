/**
 * Flow data layer.
 *
 * The UI talks to `FlowApi` only. Today it is backed by `localStorage`
 * (`createMockFlowApi`); a later HTTP implementation replaces `flowApi`
 * without touching any page. Node/edge shapes follow Orchester's stored
 * flow format so its normalize/validate helpers can be ported unchanged.
 */

export type FlowStatus = "draft" | "active" | "paused";

export interface StoredFlowNode {
  id: string;
  /** Engine type (`trigger`, `agent`, `notify`, ...). */
  type: string;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface StoredFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface FlowDTO {
  id: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  nodes: StoredFlowNode[];
  edges: StoredFlowEdge[];
  variables: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FlowSummary {
  id: string;
  name: string;
  description: string | null;
  status: FlowStatus;
  nodeCount: number;
  updatedAt: string;
}

export interface FlowCreateInput {
  name: string;
  description?: string | null;
  nodes?: StoredFlowNode[];
  edges?: StoredFlowEdge[];
  variables?: Record<string, unknown>;
}

export type FlowUpdateInput = Partial<
  Pick<
    FlowDTO,
    "name" | "description" | "status" | "nodes" | "edges" | "variables"
  >
>;

export interface FlowApi {
  /** Most recently created/updated first. */
  list(): Promise<FlowSummary[]>;
  get(id: string): Promise<FlowDTO>;
  create(input: FlowCreateInput): Promise<FlowDTO>;
  update(id: string, patch: FlowUpdateInput): Promise<FlowDTO>;
  remove(id: string): Promise<void>;
}

export const FLOWS_STORAGE_KEY = "octop.flows.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `flow_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const notFound = () => new Error("flow not found");

export function createMockFlowApi(storage?: StorageLike): FlowApi {
  // Mirror of the last written rows: serves reads when storage is missing,
  // blocked (private window) or throws.
  let memory: FlowDTO[] = [];

  // Rows are kept in recency order (last created/updated first).
  function read(): FlowDTO[] {
    if (!storage) return memory;
    let raw: string | null;
    try {
      raw = storage.getItem(FLOWS_STORAGE_KEY);
    } catch {
      return memory;
    }
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as FlowDTO[]) : [];
    } catch {
      return [];
    }
  }

  function write(rows: FlowDTO[]): void {
    memory = rows;
    if (!storage) return;
    try {
      storage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // memory-only for this session
    }
  }

  return {
    async list() {
      return read().map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        nodeCount: row.nodes.length,
        updatedAt: row.updatedAt,
      }));
    },

    async get(id) {
      const row = read().find((item) => item.id === id);
      if (!row) throw notFound();
      return clone(row);
    },

    async create(input) {
      const now = new Date().toISOString();
      const row: FlowDTO = {
        id: newId(),
        name: input.name,
        description: input.description ?? null,
        status: "draft",
        nodes: clone(input.nodes ?? []),
        edges: clone(input.edges ?? []),
        variables: clone(input.variables ?? {}),
        createdAt: now,
        updatedAt: now,
      };
      write([row, ...read()]);
      return clone(row);
    },

    async update(id, patch) {
      const rows = read();
      const current = rows.find((item) => item.id === id);
      if (!current) throw notFound();
      const next: FlowDTO = {
        ...current,
        ...clone(patch),
        updatedAt: new Date().toISOString(),
      };
      write([next, ...rows.filter((item) => item.id !== id)]);
      return clone(next);
    },

    async remove(id) {
      const rows = read();
      if (!rows.some((item) => item.id === id)) throw notFound();
      write(rows.filter((item) => item.id !== id));
    },
  };
}

/** `window.localStorage`, or undefined when absent or blocked (reading it can throw). */
export function browserStorage(): StorageLike | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export const flowApi: FlowApi = createMockFlowApi(browserStorage());
