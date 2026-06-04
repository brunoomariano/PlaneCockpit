/**
 * ProjectsService payload normalization.
 *
 * Part of the self-hosted payload audit: projects may arrive as a bare array or
 * a `{ results }` page, with `workspace` or `workspace_id`, and (like the members
 * endpoint) the occasional null/partial row. list() must accept both container
 * shapes, reconcile the workspace field, and drop rows without a usable
 * id/identifier rather than emitting half-populated projects.
 */

import { describe, it, expect, vi } from "vitest";
import { ProjectsService } from "./projects.js";
import { MemoryCacheStore } from "../cache/memory.js";
import type { PlaneApiClient } from "./client.js";

function service(payload: unknown): ProjectsService {
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async () => payload),
  } as unknown as PlaneApiClient;
  return new ProjectsService(api, new MemoryCacheStore());
}

describe("ProjectsService.list", () => {
  // The paginated `{ results }` shape, with workspace_id.
  it("accepts the paginated shape and keeps workspace_id", async () => {
    const svc = service({
      results: [{ id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws-1" }],
    });
    const projects = await svc.list();
    expect(projects).toEqual([
      { id: "p1", identifier: "ENG", name: "Eng", description: undefined, workspace_id: "ws-1" },
    ]);
  });

  // The bare-array shape, with the legacy `workspace` field.
  it("accepts a bare array and reconciles the legacy workspace field", async () => {
    const svc = service([{ id: "p1", identifier: "ENG", name: "Eng", workspace: "ws-1" }]);
    const projects = await svc.list();
    expect(projects[0]).toMatchObject({ id: "p1", identifier: "ENG", workspace_id: "ws-1" });
  });

  // Null / partial rows are dropped, not surfaced as id-less projects.
  it("drops rows without a usable id or identifier", async () => {
    const svc = service({
      results: [
        { id: "p1", identifier: "ENG", name: "Eng" },
        null,
        { id: "p2" }, // no identifier
        { identifier: "NOID" }, // no id
      ],
    });
    const projects = await svc.list();
    expect(projects.map((p) => p.identifier)).toEqual(["ENG"]);
  });

  it("falls back to the identifier when name is missing", async () => {
    const svc = service([{ id: "p1", identifier: "ENG" }]);
    const projects = await svc.list();
    expect(projects[0]!.name).toBe("ENG");
  });
});

describe("ProjectsService.findByIdentifier", () => {
  it("returns the matching project", async () => {
    const svc = service({
      results: [
        { id: "p1", identifier: "ENG", name: "Eng" },
        { id: "p2", identifier: "OPS", name: "Ops" },
      ],
    });
    const ops = await svc.findByIdentifier("OPS");
    expect(ops.id).toBe("p2");
  });

  it("throws with the available identifiers when not found", async () => {
    const svc = service({ results: [{ id: "p1", identifier: "ENG", name: "Eng" }] });
    await expect(svc.findByIdentifier("NOPE")).rejects.toThrow(/NOPE/);
  });
});
