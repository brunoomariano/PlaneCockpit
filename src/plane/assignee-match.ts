import type { Issue } from "../types/issue.js";

// Plane's list endpoint ignores the `assignees` query param on this deployment,
// so assignee filtering is done client-side over the issues already fetched —
// the same approach state_search uses. The view's `assignee` spec ("me", a
// display name, an email, or a UUID) is resolved to a user id upstream; here we
// just match that id against each issue's assignees.

/**
 * Keeps only issues assigned to one of `assigneeIds`. An empty or absent id
 * list is a no-op (matches everything), so a view without an assignee filter
 * never drops issues. An issue matches if any of its assignees' ids is in the
 * set.
 */
export function refineByAssignee(issues: Issue[], assigneeIds: string[] | undefined): Issue[] {
  if (!assigneeIds || assigneeIds.length === 0) return issues;
  const wanted = new Set(assigneeIds);
  return issues.filter((issue) => issue.assignees.some((a) => wanted.has(a.id)));
}
