// Issues is the domain-facing facade. Internally it delegates to WorkItemsService and
// the issue resolver, so commands never depend on SDK-specific naming (WorkItem).

import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService, CreateIssueParams, UpdateIssueParams } from "./work-items.js";
import { IssueResolver } from "./resolver.js";
import { sortIssues } from "./sort-issues.js";

export class IssuesService {
  readonly resolver: IssueResolver;

  constructor(
    private readonly projects: ProjectsService,
    private readonly workItems: WorkItemsService,
  ) {
    this.resolver = new IssueResolver(projects, workItems);
  }

  /**
   * Lists issues from one or more projects as a single set.
   *
   * Each project is queried separately (the Plane API lists per project), and
   * the result is merged, reordered client-side by the view's `sort`, and
   * truncated by `limit` applied to the aggregated total. If any project fetch
   * fails, the error propagates.
   */
  async list(
    projectIdentifiers: string[],
    view?: ViewDefinition,
    limit?: number,
  ): Promise<Issue[]> {
    // Single-project: direct path, no extra sort/merge cost.
    if (projectIdentifiers.length === 1) {
      const project = await this.projects.findByIdentifier(projectIdentifiers[0]!);
      return this.workItems.list({ project, view, limit });
    }

    // Multi-project: query each project in parallel. Promise.all rejects on the
    // first error, propagating the partial failure instead of silently
    // returning an incomplete set.
    const perProject = await Promise.all(
      projectIdentifiers.map(async (identifier) => {
        const project = await this.projects.findByIdentifier(identifier);
        // We do not pass limit here: the limit is on the aggregated total, not per project.
        return this.workItems.list({ project, view });
      }),
    );

    const merged = sortIssues(perProject.flat(), view?.sort);
    return limit ? merged.slice(0, limit) : merged;
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
