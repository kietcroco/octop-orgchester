import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browserStorage, createMockFlowApi, FLOWS_STORAGE_KEY } from "./flows";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

const node = (id: string) => ({
  id,
  type: "trigger",
  label: id,
  config: {},
  position: { x: 0, y: 0 },
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mock flow api", () => {
  it("list is empty on a fresh store", async () => {
    const api = createMockFlowApi(memoryStorage());
    expect(await api.list()).toEqual([]);
  });

  it("create stores a draft with defaults", async () => {
    const api = createMockFlowApi(memoryStorage());
    const flow = await api.create({ name: "A" });

    expect(flow).toMatchObject({
      name: "A",
      description: null,
      status: "draft",
      nodes: [],
      edges: [],
      variables: {},
    });
    expect(flow.id).not.toBe("");
    expect(flow.createdAt).toBe(flow.updatedAt);
  });

  it("list returns summaries newest first with nodeCount", async () => {
    const api = createMockFlowApi(memoryStorage());
    await api.create({ name: "A" });
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    await api.create({ name: "B", nodes: [node("t"), node("a")] });

    const rows = await api.list();
    expect(rows.map((r) => r.name)).toEqual(["B", "A"]);
    expect(rows[0].nodeCount).toBe(2);
    expect(rows[1].nodeCount).toBe(0);
  });

  it("update bumps updatedAt and moves the flow to the top", async () => {
    const api = createMockFlowApi(memoryStorage());
    const a = await api.create({ name: "A" });
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    await api.create({ name: "B" });
    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));

    const updated = await api.update(a.id, { status: "active" });

    expect(updated.status).toBe("active");
    expect(updated.updatedAt).not.toBe(a.updatedAt);
    expect((await api.get(a.id)).updatedAt).toBe(updated.updatedAt);
    expect((await api.list()).map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("get, update and remove reject for an unknown id", async () => {
    const api = createMockFlowApi(memoryStorage());
    await expect(api.get("nope")).rejects.toThrow("flow not found");
    await expect(api.update("nope", { name: "x" })).rejects.toThrow(
      "flow not found",
    );
    await expect(api.remove("nope")).rejects.toThrow("flow not found");
  });

  it("remove deletes the flow", async () => {
    const api = createMockFlowApi(memoryStorage());
    const a = await api.create({ name: "A" });
    await api.remove(a.id);
    expect(await api.list()).toEqual([]);
  });

  it("corrupt stored JSON is treated as empty", async () => {
    const storage = memoryStorage();
    storage.setItem(FLOWS_STORAGE_KEY, "{not json");
    const api = createMockFlowApi(storage);

    expect(await api.list()).toEqual([]);
    const created = await api.create({ name: "A" });
    expect((await api.list()).map((r) => r.id)).toEqual([created.id]);
  });

  it("browserStorage is undefined when reading window.localStorage throws", () => {
    const spy = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });
    try {
      expect(browserStorage()).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to memory when storage throws", async () => {
    const denied = () => {
      throw new Error("denied");
    };
    const api = createMockFlowApi({ getItem: denied, setItem: denied });

    const created = await api.create({ name: "A" });
    expect((await api.list()).map((r) => r.id)).toEqual([created.id]);
  });
});
