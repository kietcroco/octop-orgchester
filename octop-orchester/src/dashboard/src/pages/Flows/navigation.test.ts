import { describe, expect, it } from "vitest";

import type { OctopUser } from "../../api/modules/auth";
import { buildNavSections } from "../../layouts/sidebarNav";
import { pathToKey, routeConfigs } from "../../routes";

const adminUser = {
  id: 1,
  username: "admin",
  role: "admin",
  permissions: ["*"],
} as OctopUser;

const flatItems = (user: OctopUser | null) =>
  buildNavSections(user, { mobileEnabled: true }).flatMap(
    (section) => section.items,
  );

describe("flows navigation", () => {
  it("adds Flows right after Org chart for a signed-in user", () => {
    const items = flatItems(adminUser);
    const keys = items.map((item) => item.key);
    expect(keys[keys.indexOf("org-chart") + 1]).toBe("flows");

    const flows = items.find((item) => item.key === "flows");
    expect(flows?.path).toBe("/flows");
    expect(flows?.labelKey).toBe("nav.flows");
  });

  it("hides Flows when signed out", () => {
    expect(flatItems(null).map((item) => item.key)).not.toContain("flows");
  });

  it("routes /flows and /flows/:flowId to the same page", () => {
    const paths = routeConfigs.map((route) => route.path);
    expect(paths).toContain("/flows");
    expect(paths).toContain("/flows/:flowId");
    expect(pathToKey["/flows"]).toBe("flows");
  });
});
