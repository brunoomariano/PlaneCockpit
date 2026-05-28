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
  project: string;
  filters?: ViewFilters;
  sort?: IssueSortField;
  limit?: number;
}
