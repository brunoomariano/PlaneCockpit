import type { IssuePriority, IssueStateGroup } from "./issue.js";

export interface ViewFilters {
  assignee?: string | string[];
  state_group?: IssueStateGroup[];
  labels?: string[];
  priority?: IssuePriority[];
  cycle?: string;
  module?: string;
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
  limit?: number;
}
