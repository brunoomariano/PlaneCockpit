/**
 * Client-side state_search refinement in IssuesService.list.
 *
 * state_search / project_state_search never reach the API query (the SDK only
 * accepts state_group). After issues are fetched, the merged set is refined by
 * matching each issue's state name (slugified) against the applicable search
 * list. Per-project and global lists combine by union. query_limit caps the
 * fetch, not the refinement.
 */

import { describe, it, expect, vi } from "vitest";
import { IssuesService } from "./issues.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService } from "./work-items.js";
import type { UsersService } from "./users.js";
import type { Issue } from "../types/issue.js";
import type { Project } from "../types/project.js";
import type { IssueStateGroup } from "../types/issue.js";

function project(identifier: string): Project {
  return { id: `id-${identifier}`, identifier, name: identifier, workspace_id: "ws" };
}

function issue(key: string, projectIdentifier: string, stateName: string): Issue {
  const group: IssueStateGroup = "started";
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: `id-${projectIdentifier}`,
    project_identifier: projectIdentifier,
    key,
    name: key,
    state: { id: `s-${stateName}`, name: stateName, group },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

/**
 * Builds an IssuesService whose work-items service returns the given issues per
 * project. `lastQuery` records the last list params so a test can assert the
 * query did not carry state_search.
 */
function makeService(byProject: Record<string, Issue[]>): {
  svc: IssuesService;
  listCalls: unknown[];
} {
  const listCalls: unknown[] = [];
  const projects = {
    findByIdentifier: vi.fn(async (identifier: string) => project(identifier)),
  } as unknown as ProjectsService;
  const workItems = {
    list: vi.fn(async (params: { project: Project; limit?: number }) => {
      listCalls.push(params);
      return byProject[params.project.identifier] ?? [];
    }),
  } as unknown as WorkItemsService;
  const users = { resolveAssignee: vi.fn() } as unknown as UsersService;
  return { svc: new IssuesService(projects, workItems, users), listCalls };
}

describe("state_search refinement", () => {
  it("should keep only issues whose state matches the global state_search", async () => {
    const { svc } = makeService({
      ENG: [issue("ENG-1", "ENG", "In Review"), issue("ENG-2", "ENG", "Done")],
    });
    const out = await svc.list(["ENG"], {
      name: "Review",
      projects: ["ENG"],
      filters: { state_search: ["In Review"] },
    });
    expect(out.map((i) => i.key)).toEqual(["ENG-1"]);
  });

  it("should refine in the domain layer, not via a fetch that returns only matches", async () => {
    // The fetch returns both a matching and a non-matching issue (the API does
    // not know about state_search). list must drop the non-match itself.
    const { svc } = makeService({
      ENG: [issue("ENG-1", "ENG", "In Review"), issue("ENG-2", "ENG", "Done")],
    });
    const out = await svc.list(["ENG"], {
      name: "Review",
      projects: ["ENG"],
      filters: { state_search: ["In Review"] },
    });
    expect(out.map((i) => i.key)).toEqual(["ENG-1"]);
  });

  it("should refine over all fetched states when no state_group is set", async () => {
    const { svc } = makeService({
      ENG: [
        issue("ENG-1", "ENG", "In Review"),
        issue("ENG-2", "ENG", "Backlog"),
        issue("ENG-3", "ENG", "Done"),
      ],
    });
    const out = await svc.list(["ENG"], {
      name: "Review",
      projects: ["ENG"],
      filters: { state_search: ["Backlog", "Done"] },
    });
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-2", "ENG-3"]);
  });

  it("should union global and per-project search lists", async () => {
    const { svc } = makeService({
      ENG: [issue("ENG-1", "ENG", "In Review"), issue("ENG-2", "ENG", "Done")],
      OPS: [issue("OPS-1", "OPS", "In Review"), issue("OPS-2", "OPS", "Done")],
    });
    const out = await svc.list(["ENG", "OPS"], {
      name: "Mixed",
      projects: ["ENG", "OPS"],
      filters: {
        state_search: ["Done"],
        project_state_search: [{ name: "ENG", state_search: ["In Review"] }],
      },
    });
    // ENG keeps Done OR In Review; OPS (not listed) keeps only Done.
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "ENG-2", "OPS-2"]);
  });

  it("should refine an unlisted project by the global list only", async () => {
    const { svc } = makeService({
      // ENG has a non-matching issue (ENG-2 Done) that must be dropped by its
      // per-project rule; OPS is unlisted with no global rule, so it passes.
      ENG: [issue("ENG-1", "ENG", "In Review"), issue("ENG-2", "ENG", "Done")],
      OPS: [issue("OPS-1", "OPS", "In Review"), issue("OPS-2", "OPS", "Done")],
    });
    const out = await svc.list(["ENG", "OPS"], {
      name: "Mixed",
      projects: ["ENG", "OPS"],
      // No global list: ENG is listed, OPS is not and has no global rule -> OPS passes through.
      filters: { project_state_search: [{ name: "ENG", state_search: ["In Review"] }] },
    });
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "OPS-1", "OPS-2"]);
  });

  it("should cap the fetch with query_limit and let refinement return fewer", async () => {
    const { svc, listCalls } = makeService({
      ENG: [
        issue("ENG-1", "ENG", "In Review"),
        issue("ENG-2", "ENG", "Done"),
        issue("ENG-3", "ENG", "In Review"),
      ],
    });
    const out = await svc.list(
      ["ENG"],
      { name: "Review", projects: ["ENG"], filters: { state_search: ["In Review"] } },
      50,
    );
    // query_limit (50) reaches the fetch; refinement then keeps only matches,
    // so the result can be fewer than the fetched set.
    expect((listCalls[0] as { limit?: number }).limit).toBe(50);
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "ENG-3"]);
  });

  it("should be a no-op when no state_search is configured (regression guard)", async () => {
    const { svc } = makeService({
      ENG: [issue("ENG-1", "ENG", "In Review"), issue("ENG-2", "ENG", "Done")],
    });
    const out = await svc.list(["ENG"], { name: "All", projects: ["ENG"] });
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "ENG-2"]);
  });
});
