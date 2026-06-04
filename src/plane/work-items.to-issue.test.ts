/**
 * Read-path normalization (toIssue), exercised through WorkItemsService.retrieve.
 *
 * Part of the self-hosted payload audit. Plane returns state/assignees/labels
 * either as expanded objects (with ?expand=) or as bare UUID strings, priority
 * can be null, and description lives in description_html / description_stripped /
 * description depending on the release. These tests pin that the adapter
 * normalizes every variant into a consistent Issue.
 */

import { describe, it, expect, vi } from "vitest";
import { WorkItemsService } from "./work-items.js";
import { MemoryCacheStore } from "../cache/memory.js";
import type { PlaneApiClient } from "./client.js";
import type { Project } from "../types/project.js";

const PROJECT: Project = { id: "p1", identifier: "ENG", name: "Eng", workspace_id: "ws" };

function retrieveWith(raw: Record<string, unknown>): Promise<import("../types/issue.js").Issue> {
  const api = {
    workspace: "acme",
    workspacePath: (...segments: string[]) => `/workspaces/acme/${segments.join("/")}`,
    request: vi.fn(async () => raw),
  } as unknown as PlaneApiClient;
  return new WorkItemsService(api, new MemoryCacheStore()).retrieve(PROJECT, "i1");
}

const BASE = { id: "i1", sequence_id: 7, name: "Issue", created_at: "c", updated_at: "u" };

describe("toIssue (via retrieve) — relations as expanded objects", () => {
  it("maps expanded state/assignees/labels into the domain shape", async () => {
    const issue = await retrieveWith({
      ...BASE,
      state: { id: "s1", name: "In Progress", group: "started", color: "#fff" },
      assignees: [{ id: "u1", display_name: "Ana", email: "ana@x" }],
      labels: [{ id: "l1", name: "bug", color: "#f00" }],
      priority: "high",
      description_html: "<p>body</p>",
    });
    expect(issue.key).toBe("ENG-7");
    expect(issue.state).toEqual({ id: "s1", name: "In Progress", group: "started", color: "#fff" });
    expect(issue.assignees).toEqual([{ id: "u1", display_name: "Ana", email: "ana@x" }]);
    expect(issue.labels).toEqual([{ id: "l1", name: "bug", color: "#f00" }]);
    expect(issue.priority).toBe("high");
    expect(issue.description).toContain("body");
  });
});

describe("toIssue (via retrieve) — relations as bare UUID strings", () => {
  it("normalizes string state/assignees/labels (unexpanded response)", async () => {
    const issue = await retrieveWith({
      ...BASE,
      state: "s-uuid-123456789",
      assignees: ["u-uuid-1"],
      labels: ["l-uuid-1"],
    });
    expect(issue.state.id).toBe("s-uuid-123456789");
    expect(issue.assignees[0]!.id).toBe("u-uuid-1");
    expect(issue.labels[0]!.id).toBe("l-uuid-1");
  });
});

describe("toIssue (via retrieve) — defensive defaults", () => {
  it("defaults a null priority to none", async () => {
    const issue = await retrieveWith({ ...BASE, state: "s", priority: null });
    expect(issue.priority).toBe("none");
  });

  it("tolerates a missing/null state", async () => {
    const issue = await retrieveWith({ ...BASE, state: null });
    expect(issue.state).toEqual({ id: "", name: "—", group: "backlog" });
  });

  it("treats absent assignees/labels as empty arrays", async () => {
    const issue = await retrieveWith({ ...BASE, state: "s" });
    expect(issue.assignees).toEqual([]);
    expect(issue.labels).toEqual([]);
  });

  it("falls back to description_stripped when html is absent", async () => {
    const issue = await retrieveWith({ ...BASE, state: "s", description_stripped: "plain body" });
    expect(issue.description).toBe("plain body");
  });
});
