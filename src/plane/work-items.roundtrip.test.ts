/**
 * HTTP round-trip for the write operations, through the real PlaneApiClient.
 *
 * The other work-items tests stub `client.request`; this drives the real client
 * with an injected `fetchImpl`, so the actual URL building (trailing slash,
 * encoded segments, expand query), method, headers and JSON body are exercised
 * end to end — the layer the CLI mutations (create/update/transition/label/
 * delete) rely on but that no test reached before.
 */

import { describe, it, expect } from "vitest";
import { PlaneApiClient } from "./client.js";
import { WorkItemsService } from "./work-items.js";
import { MemoryCacheStore } from "../cache/memory.js";
import type { Project } from "../types/project.js";

const PROJECT: Project = { id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws" };

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

// fakeFetch records each call and returns `response` as JSON (200), or 204 for
// an empty response (delete). It mimics undici's fetch shape closely enough for
// the client (status, ok, json/text).
function harness(response: unknown): { svc: WorkItemsService; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const empty = response === undefined;
    return {
      status: empty ? 204 : 200,
      ok: true,
      json: async () => response,
      text: async () => "",
    } as Response;
  }) as unknown as typeof fetch;

  const api = new PlaneApiClient({
    server: { base_url: "https://plane.test", workspace_slug: "acme" },
    apiKey: "k",
    fetchImpl,
  });
  return { svc: new WorkItemsService(api, new MemoryCacheStore()), calls };
}

const RAW = {
  id: "i1",
  sequence_id: 7,
  name: "Issue",
  state: { id: "s1", name: "In Progress", group: "started" },
  created_at: "c",
  updated_at: "u",
};

describe("work-items HTTP round-trip", () => {
  it("PATCHes the slashed issue URL with the mapped body, then re-reads expanded", async () => {
    const { svc, calls } = harness(RAW);
    const issue = await svc.update({ project: PROJECT, issueId: "i1", patch: { state_id: "s9" } });

    // The PATCH does not reliably expand relations on this deployment, so the
    // service re-reads with a GET (expand) to return names instead of UUIDs.
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "GET"]);
    expect(calls[0]!.url).toBe("https://plane.test/api/v1/workspaces/acme/projects/p1/issues/i1/");
    expect(calls[0]!.headers["x-api-key"]).toBe("k");
    expect(calls[0]!.body).toEqual({ state: "s9" }); // toApiBody mapped state_id -> state
    // The re-read GET carries expand, so the returned Issue has the state name.
    expect(calls[1]!.url).toContain("?expand=state%2Cassignees%2Clabels");
    expect(issue.state.name).toBe("In Progress");
  });

  it("POSTs create with description_html, then re-reads expanded", async () => {
    const { svc, calls } = harness(RAW);
    await svc.create({ project: PROJECT, name: "New", description: "hi" });

    expect(calls.map((c) => c.method)).toEqual(["POST", "GET"]);
    expect(calls[0]!.url).toBe("https://plane.test/api/v1/workspaces/acme/projects/p1/issues/");
    expect(calls[0]!.body).toMatchObject({ name: "New", description_html: "<p>hi</p>" });
    expect(calls[1]!.url).toContain("/issues/i1/?expand=");
  });

  it("DELETEs the slashed issue URL", async () => {
    const { svc, calls } = harness(undefined);
    await svc.delete(PROJECT, "i1");

    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toBe("https://plane.test/api/v1/workspaces/acme/projects/p1/issues/i1/");
  });
});
