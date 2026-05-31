/**
 * Client-side assignee refinement in IssuesService.list.
 *
 * This deployment ignores the `assignees` query param, so a view's `assignee`
 * filter is resolved to user ids (via UsersService, including "me") and applied
 * to the merged set after fetch — the same shape as state_search refinement.
 */

import { describe, it, expect, vi } from "vitest";
import { IssuesService } from "./issues.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService } from "./work-items.js";
import type { UsersService } from "./users.js";
import type { Issue, IssueUser } from "../types/issue.js";
import type { Project } from "../types/project.js";

function project(identifier: string): Project {
  return { id: `id-${identifier}`, identifier, name: identifier, workspace_id: "ws" };
}

function issue(key: string, assigneeIds: string[]): Issue {
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: "id-ENG",
    project_identifier: "ENG",
    key,
    name: key,
    state: { id: "s", name: "In Progress", group: "started" },
    priority: "none",
    assignees: assigneeIds.map((id) => ({ id, display_name: id })),
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

const ME: IssueUser = { id: "me-uuid", display_name: "bruno.mariano" };

function makeService(issues: Issue[]): {
  svc: IssuesService;
  resolveAssignee: ReturnType<typeof vi.fn>;
} {
  const projects = {
    findByIdentifier: vi.fn(async (identifier: string) => project(identifier)),
  } as unknown as ProjectsService;
  const workItems = {
    list: vi.fn(async () => issues),
  } as unknown as WorkItemsService;
  const resolveAssignee = vi.fn(async (spec: string) =>
    spec === "me" ? ME : { id: spec, display_name: spec },
  );
  const users = { resolveAssignee } as unknown as UsersService;
  return { svc: new IssuesService(projects, workItems, users), resolveAssignee };
}

describe("assignee refinement in list", () => {
  it("should resolve 'me' and keep only issues assigned to the current user", async () => {
    const { svc, resolveAssignee } = makeService([
      issue("ENG-1", ["me-uuid"]),
      issue("ENG-2", ["someone-else"]),
      issue("ENG-3", ["me-uuid", "someone-else"]),
    ]);
    const out = await svc.list(["ENG"], {
      name: "Mine",
      projects: ["ENG"],
      filters: { assignee: "me" },
    });
    expect(resolveAssignee).toHaveBeenCalledWith("me");
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "ENG-3"]);
  });

  it("should be a no-op when no assignee filter is configured", async () => {
    const { svc, resolveAssignee } = makeService([
      issue("ENG-1", ["me-uuid"]),
      issue("ENG-2", ["someone-else"]),
    ]);
    const out = await svc.list(["ENG"], { name: "All", projects: ["ENG"] });
    expect(resolveAssignee).not.toHaveBeenCalled();
    expect(out.map((i) => i.key).sort()).toEqual(["ENG-1", "ENG-2"]);
  });
});
