// The Plane SDK exposes issues as WorkItems. This adapter translates between the SDK shape
// and the internal Issue domain model. Commands always consume Issue, never WorkItem.

import type { Issue, IssuePriority, IssueState, IssueStateGroup } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { ViewDefinition } from "../types/views.js";
import { normalizeFilters, filtersFingerprint } from "./filters.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";
import { collectPages } from "../utils/async.js";
import type { Project } from "../types/project.js";

interface RawWorkItem {
  id: string;
  sequence_id: number;
  name: string;
  description?: string;
  priority: IssuePriority;
  state: { id: string; name: string; group: IssueStateGroup; color?: string };
  assignees?: { id: string; display_name: string; email?: string }[];
  labels?: { id: string; name: string; color?: string }[];
  created_at: string;
  updated_at: string;
  cycle_id?: string;
  module_ids?: string[];
  project?: string;
  project_id?: string;
}

function toIssueState(raw: RawWorkItem["state"]): IssueState {
  return { id: raw.id, name: raw.name, group: raw.group, color: raw.color };
}

function toIssue(raw: RawWorkItem, projectIdentifier: string): Issue {
  return {
    id: raw.id,
    sequence_id: raw.sequence_id,
    project_identifier: projectIdentifier,
    key: `${projectIdentifier}-${raw.sequence_id}`,
    name: raw.name,
    description: raw.description,
    state: toIssueState(raw.state),
    priority: raw.priority,
    assignees: (raw.assignees ?? []).map((a) => ({
      id: a.id,
      display_name: a.display_name,
      email: a.email,
    })),
    labels: (raw.labels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color })),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    cycle_id: raw.cycle_id,
    module_ids: raw.module_ids,
  };
}

export interface ListIssuesParams {
  project: Project;
  view?: ViewDefinition;
  limit?: number;
  signal?: AbortSignal;
}

export interface CreateIssueParams {
  project: Project;
  name: string;
  description?: string;
  priority?: IssuePriority;
  assignee_ids?: string[];
  label_ids?: string[];
}

export interface UpdateIssueParams {
  project: Project;
  issueId: string;
  patch: Partial<Pick<Issue, "name" | "description" | "priority">> & {
    state_id?: string;
    assignee_ids?: string[];
    label_ids?: string[];
  };
}

export class WorkItemsService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(params: ListIssuesParams): Promise<Issue[]> {
    const { project, view, limit, signal } = params;
    const fingerprint = view ? filtersFingerprint(view.filters) : "all";
    const cacheKey = cacheKeys.issuesPage(this.api.workspace, project.id, fingerprint);
    const cached = await this.cache.get<Issue[]>(cacheKey);
    if (cached) return limit ? cached.slice(0, limit) : cached;

    const normalized = normalizeFilters(view?.filters);
    const query: Record<string, string | number | boolean | undefined> = {
      assignees: normalized.assignees?.join(","),
      state_group: normalized.state_groups?.join(","),
      labels: normalized.labels?.join(","),
      priority: normalized.priorities?.join(","),
      cycle: normalized.cycle,
      module: normalized.module,
      order_by: view?.sort,
    };

    const issues = await collectPages<Issue>(
      {
        fetchPage: async (cursor) => {
          const res = await this.api.request<PaginatedResponse<RawWorkItem>>(
            this.api.workspacePath("projects", project.id, "issues"),
            { query: { ...query, cursor: cursor ?? undefined }, signal },
          );
          return {
            items: res.results.map((r) => toIssue(r, project.identifier)),
            nextCursor: res.next_cursor,
          };
        },
      },
      limit,
    );

    await this.cache.set(cacheKey, issues, 60);
    return issues;
  }

  async retrieve(project: Project, issueId: string): Promise<Issue> {
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", project.id, "issues", issueId),
    );
    return toIssue(raw, project.identifier);
  }

  async create(params: CreateIssueParams): Promise<Issue> {
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", params.project.id, "issues"),
      {
        method: "POST",
        body: {
          name: params.name,
          description: params.description,
          priority: params.priority,
          assignees: params.assignee_ids,
          labels: params.label_ids,
        },
      },
    );
    await this.invalidateProjectIssues(params.project.id);
    return toIssue(raw, params.project.identifier);
  }

  async update(params: UpdateIssueParams): Promise<Issue> {
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", params.project.id, "issues", params.issueId),
      { method: "PATCH", body: params.patch },
    );
    await this.invalidateProjectIssues(params.project.id);
    return toIssue(raw, params.project.identifier);
  }

  async comment(project: Project, issueId: string, comment: string): Promise<void> {
    await this.api.request(
      this.api.workspacePath("projects", project.id, "issues", issueId, "comments"),
      { method: "POST", body: { comment_html: comment } },
    );
  }

  async assign(project: Project, issueId: string, assigneeIds: string[]): Promise<Issue> {
    return this.update({ project, issueId, patch: { assignee_ids: assigneeIds } });
  }

  private async invalidateProjectIssues(projectId: string): Promise<void> {
    await this.cache.clear(cacheKeys.issuesPage(this.api.workspace, projectId, ""));
  }
}
