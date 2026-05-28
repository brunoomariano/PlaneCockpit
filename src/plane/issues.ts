// Issues is the domain-facing facade. Internally it delegates to WorkItemsService and
// the issue resolver, so commands never depend on SDK-specific naming (WorkItem).

import type { Issue } from "../types/issue.js";
import type { ViewDefinition } from "../types/views.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService, CreateIssueParams, UpdateIssueParams } from "./work-items.js";
import { IssueResolver } from "./resolver.js";

export class IssuesService {
  readonly resolver: IssueResolver;

  constructor(
    private readonly projects: ProjectsService,
    private readonly workItems: WorkItemsService,
  ) {
    this.resolver = new IssueResolver(projects, workItems);
  }

  async list(projectIdentifier: string, view?: ViewDefinition, limit?: number): Promise<Issue[]> {
    const project = await this.projects.findByIdentifier(projectIdentifier);
    return this.workItems.list({ project, view, limit });
  }

  async view(issueKey: string): Promise<Issue> {
    const { project, issueId } = await this.resolver.resolve(issueKey);
    return this.workItems.retrieve(project, issueId);
  }

  async create(projectIdentifier: string, input: Omit<CreateIssueParams, "project">): Promise<Issue> {
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
