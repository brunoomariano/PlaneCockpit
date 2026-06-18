/**
 * Block — RelationsService: per-issue relations fetch with a short cache.
 *
 * Covers normalization (missing/null types become empty arrays, every type
 * present), the cache hit on a second call, the TTL re-fetch, and forwarding the
 * abort signal.
 */

import { describe, it, expect, vi } from "vitest";
import { RelationsService } from "./relations.js";
import { MemoryCacheStore } from "../cache/memory.js";
import { cacheKeys } from "../cache/keys.js";
import { RELATION_TYPES } from "../types/relation.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

function project(): Project {
  return { id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws" };
}

function fakeClient(response: unknown): {
  api: PlaneApiClient;
  calls: Array<{ path: string; signal?: AbortSignal }>;
} {
  const calls: Array<{ path: string; signal?: AbortSignal }> = [];
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async (path: string, opts?: { signal?: AbortSignal }) => {
      calls.push({ path, signal: opts?.signal });
      return response;
    }),
  } as unknown as PlaneApiClient;
  return { api, calls };
}

describe("RelationsService", () => {
  // Regression: the relations sub-resource only exists under `work-items/`; the
  // `issues/` alias 404s, which silently degraded the detail to "(no relations)".
  // Pin the path so the segment cannot regress to `issues`.
  it("requests the work-items relations sub-resource", async () => {
    const { api, calls } = fakeClient({ blocked_by: ["a"] });
    await new RelationsService(api, new MemoryCacheStore()).list(project(), "i9");
    expect(calls[0]?.path).toBe("/workspaces/acme/projects/p1/work-items/i9/relations");
  });

  // A partial response is normalized: present types kept, the rest empty arrays.
  it("normalizes to every relation type, defaulting missing ones to empty", async () => {
    const { api } = fakeClient({ blocked_by: ["a"], relates_to: null });
    const relations = await new RelationsService(api, new MemoryCacheStore()).list(project(), "i9");
    expect(relations.blocked_by).toEqual(["a"]);
    expect(relations.relates_to).toEqual([]);
    // Every type is present so callers can iterate without guarding.
    for (const type of RELATION_TYPES) {
      expect(Array.isArray(relations[type])).toBe(true);
    }
  });

  // A second call for the same issue is served from cache (one API hit).
  it("reuses the cached relations on a second call", async () => {
    const { api, calls } = fakeClient({ blocked_by: ["a"] });
    const svc = new RelationsService(api, new MemoryCacheStore());
    await svc.list(project(), "i9");
    await svc.list(project(), "i9");
    expect(calls).toHaveLength(1);
  });

  it("caches under the per-issue relations key", async () => {
    const { api } = fakeClient({ blocked_by: ["a"] });
    const cache = new MemoryCacheStore();
    await new RelationsService(api, cache).list(project(), "i9");
    expect(await cache.get(cacheKeys.issueRelations("acme", "p1", "i9"))).not.toBeNull();
  });

  it("re-fetches after the TTL expires", async () => {
    const { api, calls } = fakeClient({ blocked_by: ["a"] });
    let now = 1_000;
    const cache = new MemoryCacheStore({ now: () => now });
    const svc = new RelationsService(api, cache);
    await svc.list(project(), "i9");
    await svc.list(project(), "i9"); // cached
    expect(calls).toHaveLength(1);
    now += 61_000; // past the 60s TTL
    await svc.list(project(), "i9");
    expect(calls).toHaveLength(2);
  });

  it("forwards the abort signal to the client", async () => {
    const { api, calls } = fakeClient({});
    const controller = new AbortController();
    await new RelationsService(api, new MemoryCacheStore()).list(
      project(),
      "i9",
      controller.signal,
    );
    expect(calls[0]?.signal).toBe(controller.signal);
  });
});
