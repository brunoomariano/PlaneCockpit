/**
 * Block — ActivitiesService: per-issue activity-log fetch with a short cache.
 *
 * Covers the raw→domain mapping (snake_case → IssueActivity, nulls → undefined),
 * the three response envelopes self-hosted Plane returns (bare array, { result },
 * paginated { results }), the cache hit on a second call, the TTL re-fetch, and
 * that the abort signal is forwarded to the client.
 */

import { describe, it, expect, vi } from "vitest";
import { ActivitiesService } from "./activities.js";
import { MemoryCacheStore } from "../cache/memory.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

function project(): Project {
  return { id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws" };
}

const RAW_STATE_CHANGE = {
  id: "act-1",
  verb: "updated",
  field: "state",
  old_value: "Inbox",
  new_value: "Backlog",
  created_at: "2026-06-18T16:34:29.000Z",
  actor: "user-1",
};

// A fake client that returns a canned response and records each call so we can
// assert fetch count and the forwarded signal.
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

describe("ActivitiesService", () => {
  // Mapping: snake_case raw row → IssueActivity, with nulls collapsed to undefined.
  it("maps a raw state-change row to the domain model", async () => {
    const { api } = fakeClient({ result: [RAW_STATE_CHANGE] });
    const list = await new ActivitiesService(api, new MemoryCacheStore()).list(project(), "i9");
    expect(list).toEqual([
      {
        id: "act-1",
        verb: "updated",
        field: "state",
        oldValue: "Inbox",
        newValue: "Backlog",
        createdAt: "2026-06-18T16:34:29.000Z",
        actor: "user-1",
      },
    ]);
  });

  // Null field/values (Plane's "created" event) become undefined, not "null".
  it("collapses null field and values to undefined", async () => {
    const { api } = fakeClient([
      { id: "c", verb: "created", field: null, old_value: null, new_value: null, created_at: "t" },
    ]);
    const list = await new ActivitiesService(api, new MemoryCacheStore()).list(project(), "i9");
    expect(list[0]).toMatchObject({
      field: undefined,
      oldValue: undefined,
      newValue: undefined,
    });
  });

  // The three envelopes self-hosted Plane uses must all yield the rows.
  it.each([
    ["bare array", [RAW_STATE_CHANGE]],
    ["{ result }", { result: [RAW_STATE_CHANGE] }],
    ["{ results }", { results: [RAW_STATE_CHANGE] }],
  ])("accepts a %s response", async (_label, response) => {
    const { api } = fakeClient(response);
    const list = await new ActivitiesService(api, new MemoryCacheStore()).list(project(), "i9");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "act-1" });
  });

  // A second call for the same issue is served from cache (one API hit).
  it("reuses the cached log on a second call", async () => {
    const { api, calls } = fakeClient({ result: [RAW_STATE_CHANGE] });
    const svc = new ActivitiesService(api, new MemoryCacheStore());
    await svc.list(project(), "i9");
    await svc.list(project(), "i9");
    expect(calls).toHaveLength(1);
  });

  // Distinct issues keep independent cache entries.
  it("caches per issue id", async () => {
    const { api } = fakeClient({ result: [RAW_STATE_CHANGE] });
    const cache = new MemoryCacheStore();
    const svc = new ActivitiesService(api, cache);
    await svc.list(project(), "i9");
    expect(await cache.get(cacheKeys.issueActivities("acme", "p1", "i9"))).not.toBeNull();
    expect(await cache.get(cacheKeys.issueActivities("acme", "p1", "other"))).toBeNull();
  });

  // Once the short TTL lapses, the next call re-fetches so a new transition shows.
  it("re-fetches after the TTL expires", async () => {
    const { api, calls } = fakeClient({ result: [RAW_STATE_CHANGE] });
    let now = 1_000;
    const cache = new MemoryCacheStore({ now: () => now });
    const svc = new ActivitiesService(api, cache);
    await svc.list(project(), "i9");
    await svc.list(project(), "i9"); // cached
    expect(calls).toHaveLength(1);
    now += 61_000; // past the 60s TTL
    await svc.list(project(), "i9");
    expect(calls).toHaveLength(2);
  });

  // The abort signal is forwarded so a closing detail panel can cancel in flight.
  it("forwards the abort signal to the client", async () => {
    const { api, calls } = fakeClient({ result: [RAW_STATE_CHANGE] });
    const controller = new AbortController();
    await new ActivitiesService(api, new MemoryCacheStore()).list(
      project(),
      "i9",
      controller.signal,
    );
    expect(calls[0]?.signal).toBe(controller.signal);
  });
});
