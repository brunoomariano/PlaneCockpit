/**
 * Block 1 — StatesService: project-scoped state listing with a per-project cache.
 *
 * The edit modal's state picker needs the states of the issue's project. States
 * are project-scoped in Plane, so the service fetches them per project and caches
 * them under a project-keyed cache entry. These tests cover the first fetch, the
 * cache hit on a second call for the same project, and that distinct projects do
 * not share an entry.
 */

import { describe, it, expect, vi } from "vitest";
import { StatesService } from "./states.js";
import { MemoryCacheStore } from "../cache/memory.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

function project(identifier: string): Project {
  return { id: `id-${identifier}`, identifier, name: identifier, workspace_id: "ws" };
}

// A fake client that records each request path and returns a canned paginated
// payload of raw states, so we can assert how many times the API was hit.
function fakeClient(results: Record<string, Array<{ id: string; name: string; group: string }>>): {
  api: PlaneApiClient;
  requests: string[];
} {
  const requests: string[] = [];
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async (path: string) => {
      requests.push(path);
      // path: /workspaces/acme/projects/<projectId>/states
      const projectId = path.split("/")[4] ?? "";
      return { results: results[projectId] ?? [] };
    }),
  } as unknown as PlaneApiClient;
  return { api, requests };
}

describe("StatesService", () => {
  // Scenario 1: first fetch hits the API and returns the project's states.
  it("should fetch a project's states from the API on first access", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "s1", name: "Todo", group: "unstarted" }],
    });
    const svc = new StatesService(api, new MemoryCacheStore());

    const states = await svc.list(project("ENG"));

    expect(states).toEqual([{ id: "s1", name: "Todo", group: "unstarted" }]);
    expect(requests).toHaveLength(1);
  });

  // Scenario 2: a second call for the same project is served from cache.
  it("should reuse the cached states on a second call for the same project", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "s1", name: "Todo", group: "unstarted" }],
    });
    const svc = new StatesService(api, new MemoryCacheStore());

    await svc.list(project("ENG"));
    const second = await svc.list(project("ENG"));

    expect(second).toEqual([{ id: "s1", name: "Todo", group: "unstarted" }]);
    expect(requests).toHaveLength(1);
  });

  // Scenario 3: distinct projects keep independent cache entries.
  it("should cache states independently per project", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "s1", name: "Todo", group: "unstarted" }],
      "id-OPS": [{ id: "s2", name: "Open", group: "backlog" }],
    });
    const cache = new MemoryCacheStore();
    const svc = new StatesService(api, cache);

    const eng = await svc.list(project("ENG"));
    const ops = await svc.list(project("OPS"));

    expect(eng.map((s) => s.id)).toEqual(["s1"]);
    expect(ops.map((s) => s.id)).toEqual(["s2"]);
    expect(requests).toHaveLength(2);
    expect(await cache.get(cacheKeys.states("acme", "id-ENG"))).not.toBeNull();
    expect(await cache.get(cacheKeys.states("acme", "id-OPS"))).not.toBeNull();
  });

  // The cache entry is bounded by the short states/labels TTL: once it expires,
  // the next call re-fetches, so a state created in Plane appears without a clear.
  it("should re-fetch after the TTL expires", async () => {
    const { api, requests } = fakeClient({
      "id-ENG": [{ id: "s1", name: "Todo", group: "unstarted" }],
    });
    let now = 1_000;
    const cache = new MemoryCacheStore({ now: () => now });
    const svc = new StatesService(api, cache);

    await svc.list(project("ENG"));
    await svc.list(project("ENG")); // cached
    expect(requests).toHaveLength(1);

    // Advance past the 300s TTL: the entry has expired, so the next call hits
    // the API again.
    now += 301_000;
    await svc.list(project("ENG"));
    expect(requests).toHaveLength(2);
  });
});
