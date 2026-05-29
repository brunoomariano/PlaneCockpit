import type { Issue } from "../types/issue.js";
import type { ViewFilters } from "../types/views.js";

// State names are matched by slug so user-written searches do not depend on the
// exact casing or spacing of the state configured in Plane. "In Review",
// "in review", and "InReview" all collapse to the same slug.

/** Lowercases and removes all whitespace from a state name. */
export function slugifyState(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/**
 * Returns true when the issue's state name matches one of the searched names by
 * slug. An empty or absent search list is a no-op (matches everything), so a
 * filter with no state_search never drops issues.
 */
export function matchesStateSearch(stateName: string, search: string[] | undefined): boolean {
  if (!search || search.length === 0) return true;
  const target = slugifyState(stateName);
  return search.some((name) => slugifyState(name) === target);
}

/**
 * Refines already-fetched issues by the view's state_search / project_state_search.
 *
 * For each issue, the applicable search list is the union of the global
 * `state_search` and the `project_state_search` entry for the issue's project.
 * When that union is empty the issue passes (no-op). This never queries the API;
 * it filters the issues the API already returned.
 */
export function refineByStateSearch(issues: Issue[], filters: ViewFilters | undefined): Issue[] {
  const global = filters?.state_search;
  const perProject = filters?.project_state_search;
  if ((!global || global.length === 0) && (!perProject || perProject.length === 0)) {
    return issues;
  }

  return issues.filter((issue) => {
    const projectList = perProject?.find((p) => p.name === issue.project_identifier)?.state_search;
    const union = [...(global ?? []), ...(projectList ?? [])];
    return matchesStateSearch(issue.state.name, union.length > 0 ? union : undefined);
  });
}
