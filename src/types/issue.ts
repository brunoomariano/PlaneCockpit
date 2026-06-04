// Issue is the internal domain model. The Plane SDK may expose this as WorkItem.

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export type IssueStateGroup = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

export interface IssueState {
  id: string;
  name: string;
  group: IssueStateGroup;
  color?: string;
}

export interface IssueLabel {
  id: string;
  name: string;
  color?: string;
}

export interface IssueUser {
  id: string;
  display_name: string;
  email?: string;
}

export interface Issue {
  id: string;
  sequence_id: number;
  project_id: string;
  project_identifier: string;
  key: string;
  name: string;
  description?: string;
  state: IssueState;
  priority: IssuePriority;
  assignees: IssueUser[];
  labels: IssueLabel[];
  created_at: string;
  updated_at: string;
  cycle_id?: string;
  module_ids?: string[];
}
