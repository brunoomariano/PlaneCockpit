/**
 * Request bodies the WorkItemsService sends to Plane.
 *
 * toApiBody is unit-tested in isolation, but the create path builds its body
 * inline, so this captures the actual body each method sends through the client.
 * The key regression guarded here: descriptions must go out as `description_html`
 * (Plane silently ignores a plain `description`), on both create and update.
 */

import { describe, it, expect, vi } from "vitest";
import { WorkItemsService } from "./work-items.js";
import { MemoryCacheStore } from "../cache/memory.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

const PROJECT: Project = { id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws" };

// A client that records the body of each request and returns a minimal raw issue
// so toIssue does not throw.
function recordingClient(): { svc: WorkItemsService; bodies: unknown[] } {
  const bodies: unknown[] = [];
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async (_path: string, opts?: { body?: unknown }) => {
      bodies.push(opts?.body);
      return { id: "i1", sequence_id: 1, name: "x", state: "s", created_at: "", updated_at: "" };
    }),
  } as unknown as PlaneApiClient;
  return { svc: new WorkItemsService(api, new MemoryCacheStore()), bodies };
}

describe("WorkItemsService.create body", () => {
  // The description must be sent as description_html (converted to HTML), never
  // as a plain `description` field which Plane ignores.
  it("sends the description as description_html", async () => {
    const { svc, bodies } = recordingClient();
    await svc.create({ project: PROJECT, name: "New", description: "hello\nworld" });
    expect(bodies[0]).toMatchObject({
      name: "New",
      description_html: "<p>hello</p><p>world</p>",
    });
    expect(bodies[0]).not.toHaveProperty("description");
  });

  // With no description the field is omitted (undefined), not sent as empty.
  it("omits description_html when no description is given", async () => {
    const { svc, bodies } = recordingClient();
    await svc.create({ project: PROJECT, name: "New" });
    expect((bodies[0] as Record<string, unknown>).description_html).toBeUndefined();
  });

  // state_id maps to the API's `state` on create.
  it("maps state_id to state on create", async () => {
    const { svc, bodies } = recordingClient();
    await svc.create({ project: PROJECT, name: "New", state_id: "s-1" });
    expect(bodies[0]).toMatchObject({ state: "s-1" });
  });
});

describe("WorkItemsService.update body", () => {
  // The PATCH goes through toApiBody, so description becomes description_html here too.
  it("sends the description as description_html on update", async () => {
    const { svc, bodies } = recordingClient();
    await svc.update({ project: PROJECT, issueId: "i1", patch: { description: "body" } });
    expect(bodies[0]).toEqual({ description_html: "<p>body</p>" });
  });
});
