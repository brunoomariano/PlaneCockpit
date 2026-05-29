// Issues is the domain-facing facade. Internally it delegates to WorkItemsService and
// the issue resolver, so commands never depend on SDK-specific naming (WorkItem).

import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService, CreateIssueParams, UpdateIssueParams } from "./work-items.js";
import { IssueResolver } from "./resolver.js";
import { sortIssues } from "./sort-issues.js";
import { refineByStateSearch } from "./state-match.js";

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
   * Each project is queried separately (the Plane API lists per project), the
   * results are merged, refined client-side by the view's state_search, and
   * reordered by the view's `sort`. If any project fetch fails, the error
   * propagates.
   *
   * `queryLimit` caps how many issues each project's API query fetches. It does
   * NOT cap the state_search refinement: matching runs after the fetch, so the
   * final result may contain fewer issues than `queryLimit`.
   */
  async list(
    projectIdentifiers: string[],
    view?: ViewDefinition,
    queryLimit?: number,
  ): Promise<Issue[]> {
    // Query each project in parallel. Promise.all rejects on the first error,
    // propagating the partial failure instead of silently returning an
    // incomplete set.
    const perProject = await Promise.all(
      projectIdentifiers.map(async (identifier) => {
        const project = await this.projects.findByIdentifier(identifier);
        return this.workItems.list({ project, view, limit: queryLimit });
      }),
    );

    // Merge, refine client-side by state_search, and reorder. For a single
    // project the server already returns the view's sort order, so the
    // client-side sort is a no-op there.
    const refined = refineByStateSearch(perProject.flat(), view?.filters);
    return sortIssues(refined, view?.sort);
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
