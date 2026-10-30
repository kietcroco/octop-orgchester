import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("../request", () => ({ request }));

import {
  createAgency,
  deleteAgency,
  getAgency,
  getAgentAgencies,
  listAgencies,
  setAgencyMembers,
  setAgentAgencies,
  updateAgency,
} from "./agency";

beforeEach(() => {
  request.mockClear();
});

describe("agency api", () => {
  it("uses the /agencies collection and detail endpoints", () => {
    listAgencies();
    createAgency({ name: "Research" });
    getAgency("a/1");
    updateAgency("a/1", { description: "x" });
    deleteAgency("a/1");

    expect(request).toHaveBeenNthCalledWith(1, "/agencies");
    expect(request).toHaveBeenNthCalledWith(2, "/agencies", {
      method: "POST",
      body: JSON.stringify({ name: "Research" }),
    });
    expect(request).toHaveBeenNthCalledWith(3, "/agencies/a%2F1");
    expect(request).toHaveBeenNthCalledWith(4, "/agencies/a%2F1", {
      method: "PATCH",
      body: JSON.stringify({ description: "x" }),
    });
    expect(request).toHaveBeenNthCalledWith(5, "/agencies/a%2F1", {
      method: "DELETE",
    });
  });

  it("wires membership both ways", () => {
    setAgencyMembers("a1", ["ag1", "ag2"]);
    getAgentAgencies("ag1");
    setAgentAgencies("ag1", ["a1"]);

    expect(request).toHaveBeenNthCalledWith(1, "/agencies/a1/members", {
      method: "PUT",
      body: JSON.stringify({ agent_ids: ["ag1", "ag2"] }),
    });
    expect(request).toHaveBeenNthCalledWith(2, "/agencies/by-agent/ag1");
    expect(request).toHaveBeenNthCalledWith(3, "/agencies/by-agent/ag1", {
      method: "PUT",
      body: JSON.stringify({ agency_ids: ["a1"] }),
    });
  });
});
