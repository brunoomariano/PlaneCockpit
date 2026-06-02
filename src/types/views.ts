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

// Fields a view can sort by. `name` (alphabetical-by-title) was dropped: it is
// rarely the relevant order once project, priority, state and recency exist (it
// stays available as the in-TUI text filter, a different feature).
export type SortField = "project" | "priority" | "state" | "created_at" | "updated_at" | "assign";

export type SortDirection = "asc" | "desc";

// One key of a multi-level sort, after normalisation. A view's `sort` is an
// ordered list of these: the first is the primary key, each following one breaks
// ties of the ones above it.
export interface SortKey {
  field: SortField;
  direction: SortDirection;
}

// Stable ids for the issue-list columns. `title` is the grow column by default
// and is never hidden (a list without titles is useless).
export type ColumnId = "key" | "priority" | "state" | "title" | "assign";

export type ColumnAlign = "left" | "center" | "right";

// Per-column layout intent. The responsive solver still decides what fits; these
// set intent (fixed width, which column grows, alignment, whether to show it).
export interface ColumnLayout {
  width?: number;
  grow?: boolean;
  align?: ColumnAlign;
  hidden?: boolean;
}

// A view's column layout, keyed by column id. At most one column may set
// `grow: true`; absent ⇒ TITLE grows. Resolved by resolveLayout.
export type ViewLayout = Partial<Record<ColumnId, ColumnLayout>>;

export interface ViewDefinition {
  name: string;
  // Project identifiers this view queries. When absent, the view inherits the
  // profile universe (defaults.projects). When present, it must be a subset of
  // that universe. cycle/module are only allowed when the view resolves to a
  // single project.
  projects?: string[];
  filters?: ViewFilters;
  // Ordered list of sort keys. Absent ⇒ the view inherits defaults.sort, then
  // the built-in DEFAULT_SORT. Resolved by resolveSort.
  sort?: SortKey[];
  // Per-column layout. Absent ⇒ the view inherits defaults.layout, then the
  // built-in responsive defaults. Resolved by resolveLayout.
  layout?: ViewLayout;
  // Caps how many issues the API query fetches (per project). It does NOT cap
  // the client-side state_search refinement, which may return fewer.
  query_limit?: number;
}
