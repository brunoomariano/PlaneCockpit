import type { Issue } from "../types/issue.js";
import type { SortDirection, SortField, SortKey } from "../types/views.js";

// Priority order from highest to lowest. Mirrors the ordering Plane applies
// server-side when order_by=priority.
const PRIORITY_RANK: Record<Issue["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

// Workflow lifecycle order, mirroring PRIORITY_RANK. `state` sorts by this group
// rank (backlog → … → cancelled), not by the state's display name.
const STATE_GROUP_RANK: Record<Issue["state"]["group"], number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
};

// Built-in fallback applied when neither the view nor defaults.sort declares an
// order: group by project, urgent first, earliest workflow stage first, most
// recently touched first.
export const DEFAULT_SORT: SortKey[] = [
  { field: "project", direction: "asc" },
  { field: "priority", direction: "desc" },
  { field: "state", direction: "asc" },
  { field: "updated_at", direction: "desc" },
];

// Base comparators, each in the field's "asc" sense as the USER means it
// (the chained comparator negates the result for "desc"). The user-facing
// direction differs from the internal rank for priority/state, so those
// comparators negate the rank difference to align the two:
//   - priority asc = none → urgent (urgent is the high end). PRIORITY_RANK has
//     urgent=0, so asc-by-user is descending-by-rank → negate.
//   - state asc = backlog → cancelled (lifecycle order). STATE_GROUP_RANK
//     already runs backlog=0 → cancelled=4, so asc-by-user = ascending-by-rank.
//   - project asc = project_identifier A→Z.
//   - created_at/updated_at asc = oldest first.
//   - assign asc = first assignee display_name A→Z; unassigned always last
//     (handled separately so direction never moves it).
const ASC_COMPARATORS: Record<SortField, (a: Issue, b: Issue) => number> = {
  project: (a, b) => a.project_identifier.localeCompare(b.project_identifier),
  priority: (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  state: (a, b) => STATE_GROUP_RANK[a.state.group] - STATE_GROUP_RANK[b.state.group],
  created_at: (a, b) => a.created_at.localeCompare(b.created_at),
  updated_at: (a, b) => a.updated_at.localeCompare(b.updated_at),
  assign: (a, b) => firstAssignee(a).localeCompare(firstAssignee(b)),
};

function firstAssignee(issue: Issue): string {
  return issue.assignees[0]?.display_name ?? "";
}

// Compares one key, applying its direction. `assign` pins unassigned issues last
// regardless of direction (they are a "no value" bucket, not the far end of the
// order), so it short-circuits before the directional comparison.
function compareKey(a: Issue, b: Issue, field: SortField, direction: SortDirection): number {
  if (field === "assign") {
    const aUnassigned = a.assignees.length === 0;
    const bUnassigned = b.assignees.length === 0;
    if (aUnassigned !== bUnassigned) return aUnassigned ? 1 : -1;
    if (aUnassigned && bUnassigned) return 0;
  }
  const base = ASC_COMPARATORS[field](a, b);
  return direction === "desc" ? -base : base;
}

/**
 * Reorders a set of issues client-side by an ordered list of sort keys.
 *
 * Needed when the view aggregates multiple projects: each project is queried
 * sorted server-side, but the merged set must be reordered as a whole. The
 * comparator walks the key list and returns on the first non-zero comparison, so
 * each key breaks ties of the ones above it. The sort is stable: issues that are
 * equal on every key keep their input order (the order the projects were queried
 * in).
 */
export function sortIssues(issues: Issue[], sort: SortKey[] | undefined): Issue[] {
  if (!sort || sort.length === 0) return issues;

  // Array.prototype.sort is stable in V8, so ties keep the input order.
  return [...issues].sort((a, b) => {
    for (const { field, direction } of sort) {
      const cmp = compareKey(a, b, field, direction);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/**
 * Resolves the effective sort for a view: the view's own `sort` wins; otherwise
 * the profile's `defaults.sort`; otherwise the built-in DEFAULT_SORT. A view's
 * sort replaces the default wholesale — keys are never merged.
 */
export function resolveSort(
  viewSort: SortKey[] | undefined,
  defaultsSort: SortKey[] | undefined,
): SortKey[] {
  return viewSort ?? defaultsSort ?? DEFAULT_SORT;
}

// Fields Plane's list endpoint can order by server-side. project/state/assign
// have no server equivalent in this deployment.
const SERVER_ORDERABLE: ReadonlySet<SortField> = new Set<SortField>([
  "priority",
  "created_at",
  "updated_at",
]);

/**
 * Maps a resolved sort to the per-project `order_by` query hint. Plane's
 * `order_by` takes a single field, so we send the FIRST key's field as a
 * best-effort hint (the client-side chained comparator is authoritative for the
 * merged set). When the first key has no server equivalent, returns undefined so
 * the param is dropped — we don't fall through to a later key.
 */
export function serverOrderBy(sort: SortKey[] | undefined): SortField | undefined {
  const first = sort?.[0];
  if (!first) return undefined;
  return SERVER_ORDERABLE.has(first.field) ? first.field : undefined;
}
