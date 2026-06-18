/**
 * Bloco 2 — Chained, multi-key client-side comparator.
 *
 * `sortIssues` takes an ordered list of `{ field, direction }` keys and reorders
 * the merged multi-project set. It walks the key list and returns on the first
 * non-zero comparison, so each key breaks ties of the ones above it; on a full
 * tie it stays stable (preserves the order the projects were queried in). New
 * fields beyond the legacy set: `project` (by project_identifier), `state` (by
 * workflow-group rank, not name) and `assign` (by first assignee display_name,
 * unassigned pinned last in either direction). `name` is gone as a sort field.
 */

import { describe, it, expect } from "vitest";
import { sortIssues } from "./sort-issues.js";
import type { Issue, IssuePriority, IssueStateGroup, IssueUser } from "../types/issue.js";

// A SortKey is the normalised form the comparator consumes. Imported from the
// views type module once it exists (bloco 2 adds SortKey/SortField there).
import type { SortKey } from "../types/views.js";

interface IssueOverrides {
  priority?: IssuePriority;
  group?: IssueStateGroup;
  // Display name of the state; defaults to the group name. Set explicitly when a
  // test exercises state_order, which matches on the (normalized) state name.
  stateName?: string;
  created_at?: string;
  updated_at?: string;
  assignees?: IssueUser[];
  project_identifier?: string;
}

function issue(key: string, o: IssueOverrides = {}): Issue {
  const projectIdentifier = o.project_identifier ?? "ENG";
  const group = o.group ?? "unstarted";
  const stateName = o.stateName ?? group;
  return {
    id: `issue-${key}`,
    sequence_id: Number(key.split("-")[1] ?? 0),
    project_id: `id-${projectIdentifier}`,
    project_identifier: projectIdentifier,
    key,
    name: key,
    state: { id: `s-${stateName}`, name: stateName, group },
    priority: o.priority ?? "none",
    assignees: o.assignees ?? [],
    labels: [],
    created_at: o.created_at ?? "2024-01-01T00:00:00Z",
    updated_at: o.updated_at ?? "2024-01-01T00:00:00Z",
  };
}

function keys(...ks: SortKey[]): SortKey[] {
  return ks;
}

describe("sortIssues — single key and direction", () => {
  it("should honour direction on a single priority key", () => {
    const issues = [
      issue("ENG-1", { priority: "low" }),
      issue("ENG-2", { priority: "urgent" }),
      issue("ENG-3", { priority: "medium" }),
    ];
    const desc = sortIssues(issues, keys({ field: "priority", direction: "desc" }));
    expect(desc.map((i) => i.priority)).toEqual(["urgent", "medium", "low"]);
    const asc = sortIssues(issues, keys({ field: "priority", direction: "asc" }));
    expect(asc.map((i) => i.priority)).toEqual(["low", "medium", "urgent"]);
  });

  it("should put urgent first on priority desc and reverse it on asc", () => {
    // PRIORITY_RANK has urgent=0 internally; desc must still mean "urgent
    // first" to the user, so the comparator inverts on direction.
    const issues = [issue("ENG-1", { priority: "none" }), issue("ENG-2", { priority: "urgent" })];
    const desc = sortIssues(issues, keys({ field: "priority", direction: "desc" }));
    expect(desc[0]?.priority).toBe("urgent");
    const asc = sortIssues(issues, keys({ field: "priority", direction: "asc" }));
    expect(asc[0]?.priority).toBe("none");
  });
});

describe("sortIssues — tie-break cascade", () => {
  it("should break a first-key tie with the second key", () => {
    const issues = [
      issue("ENG-1", { priority: "high", updated_at: "2024-01-01T00:00:00Z" }),
      issue("ENG-2", { priority: "high", updated_at: "2024-03-01T00:00:00Z" }),
    ];
    const out = sortIssues(
      issues,
      keys({ field: "priority", direction: "desc" }, { field: "updated_at", direction: "desc" }),
    );
    // Same priority -> most recently updated first.
    expect(out.map((i) => i.key)).toEqual(["ENG-2", "ENG-1"]);
  });

  it("should cascade across more than two keys", () => {
    // All share project ENG, priority high, state started -> fall through to
    // updated_at desc.
    const base = { priority: "high" as const, group: "started" as const };
    const issues = [
      issue("ENG-1", { ...base, updated_at: "2024-01-01T00:00:00Z" }),
      issue("ENG-2", { ...base, updated_at: "2024-05-01T00:00:00Z" }),
    ];
    const out = sortIssues(
      issues,
      keys(
        { field: "project", direction: "asc" },
        { field: "priority", direction: "desc" },
        { field: "state", direction: "asc" },
        { field: "updated_at", direction: "desc" },
      ),
    );
    expect(out.map((i) => i.key)).toEqual(["ENG-2", "ENG-1"]);
  });

  // Stability is a permanent invariant of sortIssues (equal-on-all-keys issues
  // keep the query order). Not xfail — it must hold before and after the change.
  it("should preserve input order on a full tie (stability)", () => {
    // Identical on every sort key: must keep the query order (projects merged
    // in this sequence).
    const issues = [
      issue("OPS-9", { project_identifier: "OPS", priority: "none" }),
      issue("OPS-3", { project_identifier: "OPS", priority: "none" }),
      issue("OPS-7", { project_identifier: "OPS", priority: "none" }),
    ];
    const out = sortIssues(
      issues,
      keys({ field: "project", direction: "asc" }, { field: "priority", direction: "desc" }),
    );
    expect(out.map((i) => i.key)).toEqual(["OPS-9", "OPS-3", "OPS-7"]);
  });
});

describe("sortIssues — per-field semantics", () => {
  it("should sort state by workflow-group rank, not by state name", () => {
    const issues = [
      issue("ENG-1", { group: "cancelled" }),
      issue("ENG-2", { group: "backlog" }),
      issue("ENG-3", { group: "started" }),
      issue("ENG-4", { group: "completed" }),
      issue("ENG-5", { group: "unstarted" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }));
    expect(out.map((i) => i.state.group)).toEqual([
      "backlog",
      "unstarted",
      "started",
      "completed",
      "cancelled",
    ]);
  });

  it("should order assign by first assignee and pin unassigned last in either direction", () => {
    const ana: IssueUser = { id: "u-ana", display_name: "Ana" };
    const bea: IssueUser = { id: "u-bea", display_name: "Bea" };
    const issues = [
      issue("ENG-1", { assignees: [bea] }),
      issue("ENG-2", {}), // unassigned
      issue("ENG-3", { assignees: [ana] }),
    ];
    const asc = sortIssues(issues, keys({ field: "assign", direction: "asc" }));
    // Ana, Bea, then the unassigned one pinned last.
    expect(asc.map((i) => i.key)).toEqual(["ENG-3", "ENG-1", "ENG-2"]);

    const desc = sortIssues(issues, keys({ field: "assign", direction: "desc" }));
    // Bea, Ana, unassigned STILL last (no value bucket, not flipped to front).
    expect(desc.map((i) => i.key)).toEqual(["ENG-1", "ENG-3", "ENG-2"]);
  });

  it("should sort project by project_identifier alphabetically", () => {
    const issues = [
      issue("OPS-1", { project_identifier: "OPS" }),
      issue("ENG-1", { project_identifier: "ENG" }),
      issue("WEB-1", { project_identifier: "WEB" }),
    ];
    const asc = sortIssues(issues, keys({ field: "project", direction: "asc" }));
    expect(asc.map((i) => i.project_identifier)).toEqual(["ENG", "OPS", "WEB"]);
    const desc = sortIssues(issues, keys({ field: "project", direction: "desc" }));
    expect(desc.map((i) => i.project_identifier)).toEqual(["WEB", "OPS", "ENG"]);
  });

  it("should honour direction on created_at and updated_at", () => {
    const issues = [
      issue("ENG-1", { created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" }),
      issue("ENG-2", { created_at: "2024-06-01T00:00:00Z", updated_at: "2024-06-01T00:00:00Z" }),
    ];
    const createdDesc = sortIssues(issues, keys({ field: "created_at", direction: "desc" }));
    expect(createdDesc.map((i) => i.key)).toEqual(["ENG-2", "ENG-1"]);
    const updatedAsc = sortIssues(issues, keys({ field: "updated_at", direction: "asc" }));
    expect(updatedAsc.map((i) => i.key)).toEqual(["ENG-1", "ENG-2"]);
  });
});

describe("sortIssues — state_order override", () => {
  // With a state_order list the `state` key follows the declared slug order,
  // not the workflow group. This is the "In Progress before In Review" fix:
  // the user lists the exact order they want across customizable project states.
  it("should rank states by the declared state_order slugs", () => {
    const issues = [
      issue("ENG-1", { stateName: "In Review", group: "started" }),
      issue("ENG-2", { stateName: "Backlog", group: "backlog" }),
      issue("ENG-3", { stateName: "In Progress", group: "started" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }), [
      "backlog",
      "in progress",
      "in review",
    ]);
    expect(out.map((i) => i.state.name)).toEqual(["Backlog", "In Progress", "In Review"]);
  });

  // Matching is case-insensitive and whitespace-collapsed, so a slug typed as
  // "in progress" still matches a state named "In  Progress".
  it("should match slugs case-insensitively and ignoring extra whitespace", () => {
    const issues = [
      issue("ENG-1", { stateName: "READY" }),
      issue("ENG-2", { stateName: "In  Progress" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }), [
      "in progress",
      "ready",
    ]);
    expect(out.map((i) => i.state.name)).toEqual(["In  Progress", "READY"]);
  });

  // A state whose slug is not listed sorts after every listed one, tie-broken by
  // its workflow group (groups are fixed, so unlisted states stay sensible).
  it("should place unlisted states after listed ones, ordered by workflow group", () => {
    const issues = [
      issue("ENG-1", { stateName: "Cancelled", group: "cancelled" }),
      issue("ENG-2", { stateName: "In Progress", group: "started" }),
      issue("ENG-3", { stateName: "Backlog", group: "backlog" }),
    ];
    // Only "In Progress" is listed; the rest fall to group order (backlog before
    // cancelled).
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }), ["in progress"]);
    expect(out.map((i) => i.state.name)).toEqual(["In Progress", "Backlog", "Cancelled"]);
  });

  it("should reverse the declared order on desc", () => {
    const issues = [
      issue("ENG-1", { stateName: "In Progress", group: "started" }),
      issue("ENG-2", { stateName: "Ready", group: "unstarted" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "desc" }), [
      "ready",
      "in progress",
    ]);
    expect(out.map((i) => i.state.name)).toEqual(["In Progress", "Ready"]);
  });

  // An absent/empty state_order keeps the prior behaviour: pure workflow-group
  // order, regardless of the state's display name.
  it("should fall back to workflow-group order when state_order is absent", () => {
    const issues = [
      issue("ENG-1", { stateName: "Z-late", group: "cancelled" }),
      issue("ENG-2", { stateName: "A-early", group: "backlog" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }));
    expect(out.map((i) => i.state.group)).toEqual(["backlog", "cancelled"]);
  });

  // state_order must apply when `state` is a non-primary key too: here priority
  // ties and the configured state order breaks the tie within each priority.
  it("should apply state_order when state is a secondary tie-break key", () => {
    const issues = [
      issue("ENG-1", { priority: "high", stateName: "In Review", group: "started" }),
      issue("ENG-2", { priority: "high", stateName: "In Progress", group: "started" }),
    ];
    const out = sortIssues(
      issues,
      keys({ field: "priority", direction: "desc" }, { field: "state", direction: "asc" }),
      ["in progress", "in review"],
    );
    expect(out.map((i) => i.state.name)).toEqual(["In Progress", "In Review"]);
  });

  // Issues sharing the same listed state are equal on the state key, so the sort
  // stays stable (keeps the merged/query order) rather than reordering them.
  it("should keep input order among issues with the same listed state (stable)", () => {
    const issues = [
      issue("ENG-9", { stateName: "In Progress", group: "started" }),
      issue("ENG-3", { stateName: "In Progress", group: "started" }),
      issue("ENG-7", { stateName: "In Progress", group: "started" }),
    ];
    const out = sortIssues(issues, keys({ field: "state", direction: "asc" }), ["in progress"]);
    expect(out.map((i) => i.key)).toEqual(["ENG-9", "ENG-3", "ENG-7"]);
  });

  // When `state` is primary and two issues share a state, a following key breaks
  // the tie — the state_order rank does not swallow the cascade.
  it("should cascade to the next key when two issues share the primary state", () => {
    const issues = [
      issue("ENG-1", {
        stateName: "In Progress",
        group: "started",
        updated_at: "2024-01-01T00:00:00Z",
      }),
      issue("ENG-2", {
        stateName: "In Progress",
        group: "started",
        updated_at: "2024-06-01T00:00:00Z",
      }),
    ];
    const out = sortIssues(
      issues,
      keys({ field: "state", direction: "asc" }, { field: "updated_at", direction: "desc" }),
      ["in progress"],
    );
    expect(out.map((i) => i.key)).toEqual(["ENG-2", "ENG-1"]);
  });
});
