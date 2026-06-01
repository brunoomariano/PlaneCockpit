import type { Issue, IssueStateGroup } from "../types/issue.js";

// Plane's list endpoint ignores the `state_group` query param on this
// deployment (it returns issues from every group regardless), so state_group
// filtering is done client-side over the issues already fetched — the same
// approach assignee and state_search use. Without this, a view filtered to
// `[backlog, unstarted, started]` still showed `Done`/`Cancelled` issues.

/**
 * Keeps only issues whose state belongs to one of `groups`. An empty or absent
 * group list is a no-op (matches everything), so a view without a state_group
 * filter never drops issues.
 */
export function refineByStateGroup(
  issues: Issue[],
  groups: IssueStateGroup[] | undefined,
): Issue[] {
  if (!groups || groups.length === 0) return issues;
  const wanted = new Set(groups);
  return issues.filter((issue) => wanted.has(issue.state.group));
}
