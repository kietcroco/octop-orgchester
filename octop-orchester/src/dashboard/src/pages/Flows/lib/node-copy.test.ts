import { describe, expect, it } from "vitest";

import en from "../../../locales/en.json";
import vi from "../../../locales/vi.json";
import zh from "../../../locales/zh.json";
import { CATEGORY_ORDER, NODE_REGISTRY, type NodeDef } from "./node-catalog";

/**
 * Guards the copy of the node catalog: a node added to NODE_REGISTRY must ship
 * its texts in every language (flows.nodes.<id>.*), or the palette, card and
 * inspector would show raw keys. Vacuous for nodes while the catalog is empty,
 * real the moment a node is added.
 */

const LOCALES: Record<string, unknown> = { en, zh, vi };

const lookup = (locale: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      locale,
    );

const isText = (value: unknown) =>
  typeof value === "string" && value.trim() !== "";

/** Every copy key a node needs, e.g. `flows.nodes.agent.fields.prompt.label`. */
export function copyKeysOf(def: NodeDef): string[] {
  const base = `flows.nodes.${def.id}`;
  return [
    `${base}.title`,
    `${base}.summary`,
    ...def.fields.flatMap((field) => [
      `${base}.fields.${field.key}.label`,
      ...(field.options ?? []).map(
        (option) => `${base}.fields.${field.key}.options.${option}`,
      ),
    ]),
    ...(def.outputs ?? []).map((output) => `${base}.outputs.${output}`),
  ];
}

export function missingCopy(
  registry: Record<string, NodeDef>,
  locales: Record<string, unknown>,
): string[] {
  return Object.entries(locales).flatMap(([name, locale]) =>
    Object.values(registry).flatMap((def) =>
      copyKeysOf(def)
        .filter((key) => !isText(lookup(locale, key)))
        .map((key) => `${name}: ${key}`),
    ),
  );
}

describe("flows copy", () => {
  it("names every category in every language", () => {
    for (const [name, locale] of Object.entries(LOCALES)) {
      for (const category of CATEGORY_ORDER) {
        expect(
          isText(lookup(locale, `flows.categories.${category}`)),
          `${name}: ${category}`,
        ).toBe(true);
      }
    }
  });

  it("has the copy of every node in the catalog in every language", () => {
    expect(missingCopy(NODE_REGISTRY, LOCALES)).toEqual([]);
  });

  it("reports exactly what a node is missing", () => {
    const def: NodeDef = {
      id: "demo",
      engine: "agent",
      category: "ai",
      icon: "Bot",
      accent: "#000",
      fields: [{ key: "mode", type: "select", options: ["fast", "slow"] }],
      outputs: ["true"],
    };
    const partial = {
      flows: {
        nodes: {
          demo: {
            title: "Demo",
            summary: "",
            fields: { mode: { label: "Mode", options: { fast: "Fast" } } },
          },
        },
      },
    };
    expect(missingCopy({ demo: def }, { en: partial })).toEqual([
      "en: flows.nodes.demo.summary",
      "en: flows.nodes.demo.fields.mode.options.slow",
      "en: flows.nodes.demo.outputs.true",
    ]);
  });
});
