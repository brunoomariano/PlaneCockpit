/**
 * LabelsService: project-scoped label listing with a per-project cache.
 *
 * The edit modal's label picker needs the labels of the issue's project. Labels
 * are project-scoped in Plane, so the service fetches them per project and caches
 * them under a project-keyed entry. These tests cover the first fetch, the cache
 * hit on a second call for the same project, and that distinct projects do not
 * share an entry. Mirrors states.test.ts.
 */

import { describe, it, expect, vi } from "vitest";
import { LabelsService } from "./labels.js";
import { MemoryCacheStore } from "../cache/memory.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

function project(identifier: string): Project {
  return { id: `id-${identifier}`, identifier, name: identifier, workspace_id: "ws" };
}

function fakeClient(results: Record<string, Array<{ id: string; name: string; color?: string }>>): {
  api: PlaneApiClient;
  requests: string[];
} {
  const requests: string[] = [];
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async (path: string) => {
      requests.push(path);
      // path: /workspaces/acme/projects/<projectId>/labels
      const projectId = path.split("/")[4] ?? "";
      return { results: results[projectId] ?? [] };
    }),
  } as unknown as PlaneApiClient;
  return { api, requests };
}

describe("LabelsService", () => {
  // First fetch hits the API and returns the project's labels.
  it("should fetch a project's labels from the API on first access", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "l1", name: "bug", color: "#f00" }],
    });
    const svc = new LabelsService(api, new MemoryCacheStore());

    const labels = await svc.list(project("ENG"));

    expect(labels).toEqual([{ id: "l1", name: "bug", color: "#f00" }]);
    expect(requests).toHaveLength(1);
  });

  // A second call for the same project is served from cache.
  it("should reuse the cached labels on a second call for the same project", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "l1", name: "bug" }],
    });
    const svc = new LabelsService(api, new MemoryCacheStore());

    await svc.list(project("ENG"));
    const second = await svc.list(project("ENG"));

    expect(second).toEqual([{ id: "l1", name: "bug" }]);
    expect(requests).toHaveLength(1);
  });

  // Distinct projects keep independent cache entries.
  it("should cache labels independently per project", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "l1", name: "bug" }],
      "id-OPS": [{ id: "l2", name: "ops" }],
    });
    const cache = new MemoryCacheStore();
    const svc = new LabelsService(api, cache);

    const eng = await svc.list(project("ENG"));
    const ops = await svc.list(project("OPS"));

    expect(eng.map((l) => l.id)).toEqual(["l1"]);
    expect(ops.map((l) => l.id)).toEqual(["l2"]);
    expect(requests).toHaveLength(2);
    expect(await cache.get(cacheKeys.labels("acme", "id-ENG"))).not.toBeNull();
    expect(await cache.get(cacheKeys.labels("acme", "id-OPS"))).not.toBeNull();
  });

  // Some Plane releases return the labels as a bare array instead of a
  // { results } page; the adapter must accept both.
  it("should accept a bare-array response", async () => {
    const api = {
      workspace: "acme",
      workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
      request: vi.fn(async () => [{ id: "l1", name: "bug" }]),
    } as unknown as PlaneApiClient;
    const labels = await new LabelsService(api, new MemoryCacheStore()).list(project("ENG"));
    expect(labels).toEqual([{ id: "l1", name: "bug" }]);
  });

  // Bounded by the short states/labels TTL: once it expires the next call
  // re-fetches, so a label created in Plane appears without a manual clear.
  it("should re-fetch after the TTL expires", async () => {
    const { api, requests } = fakeClient({ "id-ENG": [{ id: "l1", name: "bug" }] });
    let now = 1_000;
    const cache = new MemoryCacheStore({ now: () => now });
    const svc = new LabelsService(api, cache);

    await svc.list(project("ENG"));
    await svc.list(project("ENG")); // cached
    expect(requests).toHaveLength(1);

    now += 301_000; // past the 300s TTL
    await svc.list(project("ENG"));
    expect(requests).toHaveLength(2);
  });
});
