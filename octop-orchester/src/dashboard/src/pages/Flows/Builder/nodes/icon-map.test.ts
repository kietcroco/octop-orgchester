import { describe, expect, it } from "vitest";
import * as lucide from "lucide-react";

import { NODE_REGISTRY } from "../../lib/node-catalog";
import { NODE_ICONS, iconFor } from "./icon-map";

describe("icon map", () => {
  it("falls back to a generic icon for unknown or missing names", () => {
    expect(iconFor(undefined)).toBe(lucide.Box);
    expect(iconFor("DefinitelyNotAnIcon")).toBe(lucide.Box);
  });

  it("only maps names that exist in lucide-react", () => {
    for (const [name, icon] of Object.entries(NODE_ICONS)) {
      expect((lucide as Record<string, unknown>)[name], name).toBe(icon);
    }
  });

  it("covers the icon of every catalog node", () => {
    for (const [id, def] of Object.entries(NODE_REGISTRY)) {
      expect(NODE_ICONS, id).toHaveProperty(def.icon);
    }
  });
});
