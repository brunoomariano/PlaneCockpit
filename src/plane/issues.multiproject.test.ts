/**
 * Multi-project aggregation in IssuesService.list.
 *
 * `list` takes a list of project identifiers and aggregates the issues from all
 * of them into a single set, reordered client-side by the view's `sort` and
 * truncated by `limit` applied to the total. If any project fetch fails, the
 * error propagates (no silent partial result).
 */

import { describe, it, expect, vi } from "vitest";
import { IssuesService } from "./issues.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService } from "./work-items.js";
import type { UsersService } from "./users.js";
import type { Issue } from "../types/issue.js";
import type { Project } from "../types/project.js";

// IssuesService now resolves assignee specs through UsersService; these tests
// use no assignee filter, so a stub whose resolveAssignee is never called suffices.
const stubUsers = { resolveAssignee: vi.fn() } as unknown as UsersService;

function project(identifier: string): Project {
  return { id: `id-${identifier}`, identifier, name: identifier, workspace_id: "ws" };
}

function issue(key: string, projectIdentifier: string, overrides: Partial<Issue> = {}): Issue {
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: `id-${projectIdentifier}`,
    project_identifier: projectIdentifier,
    key,
    name: key,
    state: { id: "s", name: "Todo", group: "unstarted" },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Builds an IssuesService with stubbed ProjectsService/WorkItemsService.
 * `byProject` maps identifier -> issues the work-items service returns for that
 * project; an entry can be an error to be thrown.
 */
function makeService(byProject: Record<string, Issue[] | Error>): IssuesService {
  const known = new Set(Object.keys(byProject));
  const projects = {
    findByIdentifier: vi.fn(async (identifier: string) => {
      // Faithful to the real service: only resolves known string identifiers.
      // If list passes an array (old vs new signature), this fails.
      if (typeof identifier !== "string" || !known.has(identifier)) {
        throw new Error(`project not found: ${String(identifier)}`);
      }
      return project(identifier);
    }),
  } as unknown as ProjectsService;

  const workItems = {
    list: vi.fn(async ({ project: p }: { project: Project }) => {
      const result = byProject[p.identifier];
      if (result instanceof Error) throw result;
      return result ?? [];
    }),
  } as unknown as WorkItemsService;

  return new IssuesService(projects, workItems, stubUsers);
}

describe("multi-project aggregation", () => {
  it("should return issues from every project in the view as one set", async () => {
    const svc = makeService({
      ENG: [issue("ENG-1", "ENG")],
      OPS: [issue("OPS-1", "OPS")],
    });
    const out = await svc.list(["ENG", "OPS"], { name: "Cross", projects: ["ENG", "OPS"] });
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "OPS-1"]);
  });

  it("should reorder the merged set client-side by the view sort", async () => {
    const svc = makeService({
      ENG: [issue("ENG-1", "ENG", { priority: "low" })],
      OPS: [issue("OPS-1", "OPS", { priority: "urgent" })],
    });
    const out = await svc.list(["ENG", "OPS"], {
      name: "Cross",
      projects: ["ENG", "OPS"],
      sort: "priority",
    });
    // urgent comes before low, regardless of the order in which the projects
    // were queried (ENG first, but OPS-1 is urgent).
    expect(out.map((i) => i.key)).toEqual(["OPS-1", "ENG-1"]);
  });

  it("should forward queryLimit to each project's fetch", async () => {
    const limits: (number | undefined)[] = [];
    const projects = {
      findByIdentifier: vi.fn(async (identifier: string) => project(identifier)),
    } as unknown as ProjectsService;
    const workItems = {
      list: vi.fn(async ({ project: p, limit }: { project: Project; limit?: number }) => {
        limits.push(limit);
        return [issue(`${p.identifier}-1`, p.identifier)];
      }),
    } as unknown as WorkItemsService;
    const svc = new IssuesService(projects, workItems, stubUsers);

    await svc.list(["ENG", "OPS"], { name: "Cross", projects: ["ENG", "OPS"] }, 3);
    // queryLimit reaches each project's fetch (the per-project page cap).
    expect(limits).toEqual([3, 3]);
  });

  it("should cap the merged result by queryLimit across all projects", async () => {
    // Each project returns 3 issues (6 total); queryLimit 4 must bound the
    // aggregate, not just the per-project fetch.
    const svc = makeService({
      ENG: [issue("ENG-1", "ENG"), issue("ENG-2", "ENG"), issue("ENG-3", "ENG")],
      OPS: [issue("OPS-1", "OPS"), issue("OPS-2", "OPS"), issue("OPS-3", "OPS")],
    });
    const out = await svc.list(["ENG", "OPS"], { name: "Cross", projects: ["ENG", "OPS"] }, 4);
    expect(out).toHaveLength(4);
  });

  it("should propagate the error when one project fetch fails", async () => {
    const svc = makeService({
      ENG: [issue("ENG-1", "ENG")],
      OPS: new Error("403 forbidden on OPS"),
    });
    // Must propagate the error from work-items (403), not an accidental
    // "project not found" from the old signature receiving an array.
    await expect(
      svc.list(["ENG", "OPS"], { name: "Cross", projects: ["ENG", "OPS"] }),
    ).rejects.toThrow(/403 forbidden on OPS/);
  });

  it("should keep single-project behavior unchanged", async () => {
    const svc = makeService({ ENG: [issue("ENG-1", "ENG"), issue("ENG-2", "ENG")] });
    const out = await svc.list(["ENG"], { name: "Solo", projects: ["ENG"] });
    expect(out.map((i) => i.key)).toEqual(["ENG-1", "ENG-2"]);
  });
});
