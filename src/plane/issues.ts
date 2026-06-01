// Issues is the domain-facing facade. Internally it delegates to WorkItemsService and
// the issue resolver, so commands never depend on SDK-specific naming (WorkItem).

import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService, CreateIssueParams, UpdateIssueParams } from "./work-items.js";
import type { UsersService } from "./users.js";
import { IssueResolver } from "./resolver.js";
import { sortIssues } from "./sort-issues.js";
import { refineByStateSearch } from "./state-match.js";
import { refineByStateGroup } from "./state-group-match.js";
import { refineByAssignee } from "./assignee-match.js";

export class IssuesService {
  readonly resolver: IssueResolver;

  constructor(
    private readonly projects: ProjectsService,
    private readonly workItems: WorkItemsService,
    private readonly users: UsersService,
  ) {
    this.resolver = new IssueResolver(projects, workItems);
  }

  /**
   * Lists issues from one or more projects as a single set.
   *
   * Each project is queried separately (the Plane API lists per project), the
   * results are merged, refined client-side by the view's state_search, and
   * reordered by the view's `sort`. If any project fetch fails, the error
   * propagates.
   *
   * `queryLimit` caps both the per-project API fetch AND the final aggregate
   * result. The fetch cap is per project; after merge + client-side refinement
   * (state_search / assignee) + sort, the result is sliced to `queryLimit` so a
   * "max N" view honors N across all projects, not N per project. Refinement may
   * still leave fewer than the cap.
   */
  async list(
    projectIdentifiers: string[],
    view?: ViewDefinition,
    queryLimit?: number,
  ): Promise<Issue[]> {
    // Resolve the assignee filter once (e.g. "me" -> the current user's id)
    // before fetching, so the same id set applies across every project.
    const assigneeIds = await this.resolveAssigneeIds(view);

    // Query each project in parallel. Promise.all rejects on the first error,
    // propagating the partial failure instead of silently returning an
    // incomplete set.
    const perProject = await Promise.all(
      projectIdentifiers.map(async (identifier) => {
        const project = await this.projects.findByIdentifier(identifier);
        return this.workItems.list({ project, view, limit: queryLimit });
      }),
    );

    // Merge, refine client-side (state_group + state_search + assignee, since
    // this deployment ignores those query params), and reorder. For a single
    // project the server already returns the view's sort order, so the
    // client-side sort is a no-op there.
    const byGroup = refineByStateGroup(perProject.flat(), view?.filters?.state_group);
    const byState = refineByStateSearch(byGroup, view?.filters);
    const byAssignee = refineByAssignee(byState, assigneeIds);
    const sorted = sortIssues(byAssignee, view?.sort);
    // Apply queryLimit as an aggregate cap too: it bounds the per-project fetch
    // above, but the merged set can still exceed it, so slice the final ordered
    // result to honor "max N" across all projects.
    return queryLimit !== undefined ? sorted.slice(0, queryLimit) : sorted;
  }

  /**
   * Resolves a view's `assignee` filter into user ids. Each spec ("me", a
   * display name, an email, or a UUID) is resolved via UsersService; absent
   * filter yields undefined (no assignee refinement).
   */
  private async resolveAssigneeIds(view?: ViewDefinition): Promise<string[] | undefined> {
    const spec = view?.filters?.assignee;
    if (!spec) return undefined;
    const specs = Array.isArray(spec) ? spec : [spec];
    const resolved = await Promise.all(specs.map((s) => this.users.resolveAssignee(s)));
    return resolved.map((u) => u.id);
  }

  async view(issueKey: string): Promise<Issue> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    return this.workItems.retrieve(project, issueId);
  }

  async create(
    projectIdentifier: string,
    input: Omit<CreateIssueParams, "project">,
  ): Promise<Issue> {
    const project = await this.projects.findByIdentifier(projectIdentifier);
    return this.workItems.create({ project, ...input });
  }

  async update(issueKey: string, patch: UpdateIssueParams["patch"]): Promise<Issue> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    return this.workItems.update({ project, issueId, patch });
  }

  async assign(issueKey: string, assigneeIds: string[]): Promise<Issue> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    return this.workItems.assign(project, issueId, assigneeIds);
  }

  async comment(issueKey: string, comment: string): Promise<void> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    await this.workItems.comment(project, issueId, comment);
  }
}
