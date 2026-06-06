import type { UpdateIssuePatch } from "../plane/work-items.js";
import type { ViewFilters } from "../types/views.js";

// patchTouchesViewFilter reports whether an edit patch changed a field the
// active view filters on, in which case the edit may move the issue in or out of
// the view and the row must be reconciled by a refresh rather than patched in
// place. Maps each editable field to the filter(s) that key off it; `state_id`
// covers both the state_group and the client-side state_search filters.
export function patchTouchesViewFilter(
  patch: UpdateIssuePatch,
  filters: ViewFilters | undefined,
): boolean {
  if (!filters) return false;
  if (patch.state_id !== undefined && (filters.state_group || filters.state_search)) return true;
  if (patch.priority !== undefined && filters.priority) return true;
  if (patch.assignee_ids !== undefined && filters.assignee) return true;
  if (patch.label_ids !== undefined && filters.labels) return true;
  return false;
}
