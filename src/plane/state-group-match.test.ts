/**
 * Client-side state_group refinement.
 *
 * This deployment's list endpoint ignores the `state_group` query param (it
 * returns issues from every group), so the state_group filter runs over the
 * issues already fetched. An empty group list is a no-op; otherwise an issue is
 * kept when its state's group is among the wanted groups.
 */

import { describe, it, expect } from "vitest";
import { refineByStateGroup } from "./state-group-match.js";
import type { Issue, IssueStateGroup } from "../types/issue.js";

function issue(key: string, group: IssueStateGroup): Issue {
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: "p",
    project_identifier: "ENG",
    key,
    name: key,
    state: { id: `s-${group}`, name: group, group },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("refineByStateGroup", () => {
  it("should keep every issue when the group list is absent or empty", () => {
    const issues = [issue("ENG-1", "backlog"), issue("ENG-2", "completed")];
    expect(refineByStateGroup(issues, undefined)).toEqual(issues);
    expect(refineByStateGroup(issues, [])).toEqual(issues);
  });

  it("should keep only issues whose state group is wanted", () => {
    const issues = [
      issue("ENG-1", "backlog"),
      issue("ENG-2", "unstarted"),
      issue("ENG-3", "started"),
      issue("ENG-4", "completed"),
      issue("ENG-5", "cancelled"),
    ];
    const out = refineByStateGroup(issues, ["backlog", "unstarted", "started"]);
    expect(out.map((i) => i.key)).toEqual(["ENG-1", "ENG-2", "ENG-3"]);
  });

  it("should drop completed (Done) issues from an open-work filter", () => {
    // Regression: the "My work" view filtered to open groups still showed Done.
    const issues = [issue("ENG-1", "started"), issue("ENG-2", "completed")];
    const out = refineByStateGroup(issues, ["backlog", "unstarted", "started"]);
    expect(out.map((i) => i.key)).toEqual(["ENG-1"]);
  });
});
