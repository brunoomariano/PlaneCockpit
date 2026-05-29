import type { Issue } from "../types/issue.js";
import type { IssueSortField } from "../types/views.js";

// Priority order from highest to lowest. Mirrors the ordering Plane applies
// server-side when order_by=priority.
const PRIORITY_RANK: Record<Issue["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/**
 * Reorders a set of issues client-side by the view's sort field.
 *
 * Needed when the view aggregates multiple projects: each project is queried
 * sorted server-side, but the merged set must be reordered as a whole. Dates go
 * from most to least recent; name is alphabetical. The sort is stable (it
 * preserves the original order on ties).
 */
export function sortIssues(issues: Issue[], sort: IssueSortField | undefined): Issue[] {
  if (!sort) return issues;

  const comparators: Record<IssueSortField, (a: Issue, b: Issue) => number> = {
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    updated_at: (a, b) => b.updated_at.localeCompare(a.updated_at),
    created_at: (a, b) => b.created_at.localeCompare(a.created_at),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  const compare = comparators[sort];

  // Array.prototype.sort is stable in V8, so ties keep the input order (the
  // order in which the projects were queried).
  return [...issues].sort(compare);
}
