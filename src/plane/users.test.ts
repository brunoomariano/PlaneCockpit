/**
 * UsersService.list normalizes the workspace members endpoint.
 *
 * Plane self-hosted releases disagree on the members payload shape: some wrap
 * each row as `{ member: { id, display_name } }`, others return the user fields
 * flattened on the row itself, and some include null/partial rows (a pending
 * invite with no user yet). list() must accept both shapes and drop rows that
 * carry no usable id, so downstream pickers never see undefined entries.
 */

import { describe, it, expect, vi } from "vitest";
import { UsersService } from "./users.js";
import { MemoryCacheStore } from "../cache/memory.js";
import type { PlaneApiClient } from "./client.js";

function fakeClient(payload: unknown): PlaneApiClient {
  return {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async () => payload),
  } as unknown as PlaneApiClient;
}

describe("UsersService.list", () => {
  // The nested `{ member: {...} }` shape some deployments return.
  it("should unwrap the nested member shape", async () => {
    const api = fakeClient({
      results: [
        { member: { id: "u-1", display_name: "Ana", email: "ana@x" } },
        { member: { id: "u-2", display_name: "Bruno" } },
      ],
    });
    const users = await new UsersService(api, new MemoryCacheStore()).list();
    expect(users).toEqual([
      { id: "u-1", display_name: "Ana", email: "ana@x" },
      { id: "u-2", display_name: "Bruno" },
    ]);
  });

  // The flattened shape (user fields directly on the row) other deployments use.
  it("should accept the flattened member shape", async () => {
    const api = fakeClient([
      { id: "u-1", display_name: "Ana" },
      { id: "u-2", display_name: "Bruno", email: "bruno@x" },
    ]);
    const users = await new UsersService(api, new MemoryCacheStore()).list();
    expect(users.map((u) => u.id)).toEqual(["u-1", "u-2"]);
  });

  // Pending invites / partial rows must not leak undefined entries downstream.
  it("should drop rows without a usable id", async () => {
    const api = fakeClient({
      results: [
        { member: { id: "u-1", display_name: "Ana" } },
        { member: null },
        null,
        { member: { display_name: "no id" } },
      ],
    });
    const users = await new UsersService(api, new MemoryCacheStore()).list();
    expect(users).toEqual([{ id: "u-1", display_name: "Ana" }]);
  });

  // An empty (or fully-unusable) result must not be cached: otherwise a single
  // bad response would serve an empty assignee picker for the whole TTL. The
  // next list() should hit the API again instead of returning the cached empty.
  it("should not cache an empty result so the next call retries the API", async () => {
    const requests: unknown[] = [];
    let payload: unknown = { results: [] };
    const api = {
      workspace: "acme",
      workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
      request: vi.fn(async () => {
        requests.push(1);
        return payload;
      }),
    } as unknown as PlaneApiClient;
    const svc = new UsersService(api, new MemoryCacheStore());

    expect(await svc.list()).toEqual([]);
    // Now the API has members; the second call must re-fetch (no cached empty).
    payload = { results: [{ member: { id: "u-1", display_name: "Ana" } }] };
    expect(await svc.list()).toEqual([{ id: "u-1", display_name: "Ana" }]);
    expect(requests).toHaveLength(2);
  });
});
