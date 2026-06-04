// The Plane SDK exposes issues as WorkItems. This adapter translates between the SDK shape
// and the internal Issue domain model. Commands always consume Issue, never WorkItem.

import type { Issue, IssuePriority, IssueState, IssueStateGroup } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { ViewDefinition } from "../types/views.js";
import { normalizeFilters, filtersFingerprint } from "./filters.js";
import { serverOrderBy } from "./sort-issues.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";
import { extractNextCursor } from "./client.js";
import { collectPages } from "../utils/async.js";
import type { Project } from "../types/project.js";
import { htmlToMarkdown } from "../utils/html-to-markdown.js";
import { textToHtml } from "../utils/text-to-html.js";

// Plane's list endpoint expands `state` only when `?expand=state` is set; otherwise
// it returns a UUID string. Same with `assignees` and `labels` (UUID arrays).
// The adapter normalizes both shapes so the domain model is consistent.
type RawState = { id: string; name: string; group: IssueStateGroup; color?: string } | string;
type RawAssignee = { id: string; display_name: string; email?: string } | string;
type RawLabel = { id: string; name: string; color?: string } | string;

interface RawWorkItem {
  id: string;
  sequence_id: number;
  name: string;
  description?: string;
  description_html?: string;
  description_stripped?: string;
  priority?: IssuePriority | null;
  state: RawState;
  assignees?: RawAssignee[];
  labels?: RawLabel[];
  created_at: string;
  updated_at: string;
  cycle_id?: string;
  module_ids?: string[];
  project?: string;
  project_id?: string;
}

// Plane stores descriptions as HTML (TipTap output). We convert to Markdown so the
// TUI can render with marked-terminal — formatting survives (headings, lists, code,
// links) and consumers that take description as plain text still get something
// usable. description_stripped is preferred only if HTML is absent.
function pickDescription(raw: RawWorkItem): string | undefined {
  if (raw.description_html && raw.description_html.length > 0) {
    return htmlToMarkdown(raw.description_html);
  }
  if (raw.description_stripped && raw.description_stripped.length > 0) {
    return raw.description_stripped;
  }
  return raw.description;
}

function toIssueState(raw: RawState | undefined | null): IssueState {
  if (raw == null) return { id: "", name: "—", group: "backlog" };
  if (typeof raw === "string") {
    return { id: raw, name: raw.slice(0, 8), group: "backlog" };
  }
  return { id: raw.id, name: raw.name, group: raw.group, color: raw.color };
}

function toIssue(raw: RawWorkItem, projectIdentifier: string, projectId: string): Issue {
  return {
    id: raw.id,
    sequence_id: raw.sequence_id,
    project_id: projectId,
    project_identifier: projectIdentifier,
    key: `${projectIdentifier}-${raw.sequence_id}`,
    name: raw.name ?? "",
    description: pickDescription(raw),
    state: toIssueState(raw.state),
    priority: raw.priority ?? "none",
    assignees: (raw.assignees ?? []).map((a) =>
      typeof a === "string"
        ? { id: a, display_name: a.slice(0, 8) }
        : { id: a.id, display_name: a.display_name, email: a.email },
    ),
    labels: (raw.labels ?? []).map((l) =>
      typeof l === "string"
        ? { id: l, name: l.slice(0, 8) }
        : { id: l.id, name: l.name, color: l.color },
    ),
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
  state_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
}

export interface UpdateIssueParams {
  project: Project;
  issueId: string;
  patch: UpdateIssuePatch;
}

// UpdateIssuePatch is the domain-facing patch: it names relations by id
// (state_id, assignee_ids, label_ids). toApiBody renames them to what the Plane
// issues endpoint expects (state, assignees, labels) before the request.
export type UpdateIssuePatch = Partial<Pick<Issue, "name" | "description" | "priority">> & {
  state_id?: string;
  assignee_ids?: string[];
  label_ids?: string[];
};

// toApiBody translates a domain update patch into the Plane API body. The
// endpoint expects `state`/`assignees`/`labels` (not the *_id(s) domain names),
// and the description must be sent as `description_html` — Plane stores
// descriptions as HTML and silently ignores a plain `description` field (it
// returns 200 but the body never changes). Only keys present in the patch are
// emitted, so a single-field edit never blanks out the others.
export function toApiBody(patch: UpdateIssuePatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description_html = textToHtml(patch.description);
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.state_id !== undefined) body.state = patch.state_id;
  if (patch.assignee_ids !== undefined) body.assignees = patch.assignee_ids;
  if (patch.label_ids !== undefined) body.labels = patch.label_ids;
  return body;
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
    // per_page caps the server-side page size; without it Plane defaults to 1000,
    // which makes "give me the first 50" pay the cost of one giant page.
    const perPage = limit && limit < 100 ? limit : 100;
    const query: Record<string, string | number | boolean | undefined> = {
      assignees: normalized.assignees?.join(","),
      state_group: normalized.state_groups?.join(","),
      labels: normalized.labels?.join(","),
      priority: normalized.priorities?.join(","),
      cycle: normalized.cycle,
      module: normalized.module,
      // Best-effort single-field hint; the client-side chained sort in
      // IssuesService is authoritative for the merged multi-project set.
      order_by: serverOrderBy(view?.sort),
      per_page: perPage,
      // Ask Plane to inline these relations so we don't get bare UUIDs in the response.
      expand: "state,assignees,labels",
    };

    const issues = await collectPages<Issue>(
      {
        fetchPage: async (cursor) => {
          const res = await this.api.request<PaginatedResponse<RawWorkItem>>(
            this.api.workspacePath("projects", project.id, "issues"),
            { query: { ...query, cursor: cursor ?? undefined }, signal },
          );
          return {
            items: res.results.map((r) => toIssue(r, project.identifier, project.id)),
            nextCursor: extractNextCursor(res),
          };
        },
      },
      limit,
    );

    await this.cache.set(cacheKey, issues, 60);
    return issues;
  }

  async retrieve(project: Project, issueId: string): Promise<Issue> {
    // Plane's `fields=` parameter restricts the response to that list, so we cannot
    // use it here — we need state/assignees/labels too. The retrieve endpoint already
    // includes description_html by default.
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", project.id, "issues", issueId),
      { query: { expand: "state,assignees,labels" } },
    );
    return toIssue(raw, project.identifier, project.id);
  }

  async create(params: CreateIssueParams): Promise<Issue> {
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", params.project.id, "issues"),
      {
        method: "POST",
        body: {
          name: params.name,
          // Same as update: the description must be HTML, not a plain string.
          description_html:
            params.description !== undefined ? textToHtml(params.description) : undefined,
          priority: params.priority,
          state: params.state_id,
          assignees: params.assignee_ids,
          labels: params.label_ids,
        },
      },
    );
    await this.invalidateProjectIssues(params.project.id);
    return toIssue(raw, params.project.identifier, params.project.id);
  }

  async update(params: UpdateIssueParams): Promise<Issue> {
    const raw = await this.api.request<RawWorkItem>(
      this.api.workspacePath("projects", params.project.id, "issues", params.issueId),
      { method: "PATCH", body: toApiBody(params.patch) },
    );
    await this.invalidateProjectIssues(params.project.id);
    return toIssue(raw, params.project.identifier, params.project.id);
  }

  async delete(project: Project, issueId: string): Promise<void> {
    await this.api.request(this.api.workspacePath("projects", project.id, "issues", issueId), {
      method: "DELETE",
    });
    await this.invalidateProjectIssues(project.id);
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
