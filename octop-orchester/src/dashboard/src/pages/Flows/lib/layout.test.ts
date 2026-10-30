import { describe, expect, it } from "vitest";

import { autoLayout } from "./layout";

interface N {
  id: string;
  position: { x: number; y: number };
  extra?: string;
}

const n = (id: string, extra?: string): N => ({
  id,
  position: { x: 0, y: 0 },
  ...(extra ? { extra } : {}),
});
const at = (nodes: N[], id: string) => nodes.find((x) => x.id === id)!.position;

const overlaps = (nodes: N[], w = 210, h = 64) =>
  nodes.some((a, i) =>
    nodes
      .slice(i + 1)
      .some(
        (b) =>
          a.position.x < b.position.x + w &&
          b.position.x < a.position.x + w &&
          a.position.y < b.position.y + h &&
          b.position.y < a.position.y + h,
      ),
  );

describe("autoLayout", () => {
  it("returns [] for no nodes", () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it("lays a chain out left to right on one row", () => {
    const out = autoLayout(
      [n("a"), n("b"), n("c")],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );
    expect(at(out, "a").x).toBeLessThan(at(out, "b").x);
    expect(at(out, "b").x).toBeLessThan(at(out, "c").x);
    expect(at(out, "a").y).toBe(at(out, "b").y);
    expect(at(out, "b").y).toBe(at(out, "c").y);
  });

  it("puts siblings in one column on different rows", () => {
    const out = autoLayout(
      [n("a"), n("b"), n("c"), n("d")],
      [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
        { source: "b", target: "d" },
        { source: "c", target: "d" },
      ],
    );
    expect(at(out, "b").x).toBe(at(out, "c").x);
    expect(at(out, "b").y).not.toBe(at(out, "c").y);
    expect(at(out, "d").x).toBeGreaterThan(at(out, "b").x);
    expect(overlaps(out)).toBe(false);
  });

  it("terminates on a cycle and keeps every node apart", () => {
    const out = autoLayout(
      [n("a"), n("b"), n("c")],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
        { source: "b", target: "c" },
      ],
    );
    for (const node of out) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
    expect(overlaps(out)).toBe(false);
  });

  it("places unconnected nodes in the first column without overlap", () => {
    const out = autoLayout(
      [n("a"), n("b"), n("lonely")],
      [{ source: "a", target: "b" }],
    );
    expect(at(out, "lonely").x).toBe(at(out, "a").x);
    expect(overlaps(out)).toBe(false);
  });

  it("ignores edges to missing nodes and keeps other node properties", () => {
    const out = autoLayout(
      [n("a", "keep me")],
      [{ source: "a", target: "ghost" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].extra).toBe("keep me");
  });

  it("does not mutate its input", () => {
    const input = [n("a"), n("b")];
    autoLayout(input, [{ source: "a", target: "b" }]);
    expect(input[1].position).toEqual({ x: 0, y: 0 });
  });
});
