import type { IssuePriority, IssueStateGroup } from "./issue.js";

// Per-project state name search: refine a single project's issues by state name.
interface ProjectStateSearch {
  name: string;
  state_search: string[];
}

export interface ViewFilters {
  assignee?: string | string[];
  state_group?: IssueStateGroup[];
  labels?: string[];
  priority?: IssuePriority[];
  cycle?: string;
  module?: string;
  // Client-side refinement by state name (matched by slug). state_search applies
  // to every project; project_state_search refines specific projects. The two
  // combine by union. Neither reaches the API query — they filter the issues
  // already fetched (the SDK only filters by state_group server-side).
  state_search?: string[];
  project_state_search?: ProjectStateSearch[];
}

export type IssueSortField = "priority" | "updated_at" | "created_at" | "name";

export interface ViewDefinition {
  name: string;
  // Project identifiers this view queries. When absent, the view inherits the
  // profile universe (defaults.projects). When present, it must be a subset of
  // that universe. cycle/module are only allowed when the view resolves to a
  // single project.
  projects?: string[];
  filters?: ViewFilters;
  sort?: IssueSortField;
  // Caps how many issues the API query fetches (per project). It does NOT cap
  // the client-side state_search refinement, which may return fewer.
  query_limit?: number;
}
