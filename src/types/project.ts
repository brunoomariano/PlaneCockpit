export interface Project {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  workspace_id: string;
}

export interface Cycle {
  id: string;
  name: string;
  project_id: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface Module {
  id: string;
  name: string;
  project_id: string;
}
