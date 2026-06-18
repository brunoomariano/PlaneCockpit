// Issues is the domain-facing facade. Internally it delegates to WorkItemsService and
// the issue resolver, so commands never depend on SDK-specific naming (WorkItem).

import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService, CreateIssueParams, UpdateIssueParams } from "./work-items.js";
import type { UsersService } from "./users.js";
import type { SortKey } from "../types/views.js";
import { IssueResolver } from "./resolver.js";
import { sortIssues, resolveSort } from "./sort-issues.js";
import { refineByStateSearch } from "./state-match.js";
import { refineByStateGroup } from "./state-group-match.js";
import { refineByAssignee } from "./assignee-match.js";

// ResilientListResult is the aggregate of a per-project-isolated fetch: the
// merged/sorted issues from the reachable projects, plus the identifiers of any
// project whose fetch failed (so the caller can render a degraded view).
export interface ResilientListResult {
  issues: Issue[];
  failedProjects: string[];
}

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
   *
   * `defaultsSort` is the profile-level `defaults.sort`; the effective sort is
   * resolved once as `view.sort ?? defaultsSort ?? DEFAULT_SORT` and applied
   * both as the per-project server hint and the authoritative client-side sort.
   * `stateOrder` is the profile-level `defaults.state_order`, used by the
   * client-side `state` sort to rank states by the configured slug order.
   */
  // `signal` is threaded down to each per-project fetch so the dashboard can
  // abort an in-flight refresh (e.g. when a new one starts before the previous
  // resolves), preventing requests from piling up and timing out. The positional
  // list mirrors the call sites; the cap is waived rather than reshaping both.
  // eslint-disable-next-line max-params
  async list(
    projectIdentifiers: string[],
    view?: ViewDefinition,
    queryLimit?: number,
    defaultsSort?: SortKey[],
    stateOrder?: string[],
    signal?: AbortSignal,
  ): Promise<Issue[]> {
    // The CLI consumes this and must fail loudly: a `plc issue list` that
    // silently dropped a project would be worse than an error. So `list` runs
    // the resilient fetch and throws if any project failed, while the TUI calls
    // `listResilient` directly to degrade gracefully (see useViewsData).
    const { issues, failedProjects } = await this.listResilient(
      projectIdentifiers,
      view,
      queryLimit,
      defaultsSort,
      stateOrder,
      signal,
    );
    if (failedProjects.length > 0) {
      throw new Error(`failed to fetch projects: ${failedProjects.join(", ")}`);
    }
    return issues;
  }

  /**
   * Like `list`, but isolates per-project failures: each project is fetched
   * independently, the reachable ones are merged/refined/sorted as usual, and
   * the identifiers that failed are returned alongside so the caller can show a
   * degraded ("N of M failed") view instead of an empty or errored one. A slow
   * self-hosted Plane often times out one project while the others answer; this
   * keeps those visible. Failures are not swallowed — the WorkItemsService logs
   * each one with its project + URL via the API trace.
   */
  // Same positional shape as `list`; the cap is waived for the same reason.
  // eslint-disable-next-line max-params
  async listResilient(
    projectIdentifiers: string[],
    view?: ViewDefinition,
    queryLimit?: number,
    defaultsSort?: SortKey[],
    stateOrder?: string[],
    signal?: AbortSignal,
  ): Promise<ResilientListResult> {
    // Resolve the assignee filter once (e.g. "me" -> the current user's id)
    // before fetching, so the same id set applies across every project.
    const assigneeIds = await this.resolveAssigneeIds(view);

    // Resolve the effective sort once so the per-project query hint and the
    // client-side reorder agree, and a view inheriting defaults.sort still gets
    // a server hint. Passed to work-items via an augmented view.
    const sort = resolveSort(view?.sort, defaultsSort);
    const effectiveView = view ? { ...view, sort } : { name: "", sort };

    // Query each project independently. allSettled keeps a single slow/failing
    // project (a common self-hosted timeout) from rejecting the whole merged
    // set: the reachable projects still render, the failed identifiers are
    // collected and surfaced to the caller.
    const settled = await Promise.allSettled(
      projectIdentifiers.map(async (identifier) => {
        const project = await this.projects.findByIdentifier(identifier);
        return this.workItems.list({ project, view: effectiveView, limit: queryLimit, signal });
      }),
    );

    const fetched: Issue[] = [];
    const failedProjects: string[] = [];
    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") fetched.push(...result.value);
      else failedProjects.push(projectIdentifiers[idx]!);
    });

    // Merge, refine client-side (state_group + state_search + assignee, since
    // this deployment ignores those query params), and reorder. For a single
    // project the server already returns the view's sort order, so the
    // client-side sort is a no-op there.
    const byGroup = refineByStateGroup(fetched, view?.filters?.state_group);
    const byState = refineByStateSearch(byGroup, view?.filters);
    const byAssignee = refineByAssignee(byState, assigneeIds);
    const sorted = sortIssues(byAssignee, sort, stateOrder);
    // Apply queryLimit as an aggregate cap too: it bounds the per-project fetch
    // above, but the merged set can still exceed it, so slice the final ordered
    // result to honor "max N" across all projects.
    const issues = queryLimit !== undefined ? sorted.slice(0, queryLimit) : sorted;
    return { issues, failedProjects };
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

  async delete(issueKey: string): Promise<void> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    await this.workItems.delete(project, issueId);
  }
}
