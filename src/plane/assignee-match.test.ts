/**
 * Client-side assignee refinement.
 *
 * This deployment's list endpoint ignores the `assignees` query param, so the
 * assignee filter runs over the issues already fetched. An empty id list is a
 * no-op; otherwise an issue is kept when any of its assignees' ids is wanted.
 */

import { describe, it, expect } from "vitest";
import { refineByAssignee } from "./assignee-match.js";
import type { Issue } from "../types/issue.js";

function issue(key: string, assigneeIds: string[]): Issue {
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: "p",
    project_identifier: "ENG",
    key,
    name: key,
    state: { id: "s", name: "Todo", group: "unstarted" },
    priority: "none",
    assignees: assigneeIds.map((id) => ({ id, display_name: id })),
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("refineByAssignee", () => {
  it("should keep every issue when the id list is absent or empty", () => {
    const issues = [issue("ENG-1", ["u1"]), issue("ENG-2", [])];
    expect(refineByAssignee(issues, undefined)).toEqual(issues);
    expect(refineByAssignee(issues, [])).toEqual(issues);
  });

  it("should keep only issues assigned to one of the wanted ids", () => {
    const issues = [
      issue("ENG-1", ["u1"]),
      issue("ENG-2", ["u2"]),
      issue("ENG-3", ["u2", "u3"]),
      issue("ENG-4", []),
    ];
    const out = refineByAssignee(issues, ["u2"]);
    expect(out.map((i) => i.key)).toEqual(["ENG-2", "ENG-3"]);
  });

  it("should match when any wanted id is among the issue's assignees", () => {
    const issues = [issue("ENG-1", ["u1"]), issue("ENG-2", ["u9"])];
    const out = refineByAssignee(issues, ["u1", "u5"]);
    expect(out.map((i) => i.key)).toEqual(["ENG-1"]);
  });
});
