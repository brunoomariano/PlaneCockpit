import type { Project } from "../types/project.js";
import { NotFoundError, PlaneCliError } from "../utils/errors.js";
import type { ProjectsService } from "./projects.js";
import type { WorkItemsService } from "./work-items.js";

const ISSUE_KEY_PATTERN = /^([A-Z][A-Z0-9]*)-(\d+)$/;

export interface ResolvedIssue {
  project: Project;
  issueId: string;
}

// IssueResolver maps human-readable identifiers (e.g. ENG-123) to internal UUIDs.
// It never exposes Plane UUIDs upward — callers always use the friendly key.
export class IssueResolver {
  constructor(
    private readonly projects: ProjectsService,
    private readonly workItems: WorkItemsService,
  ) {}

  parseKey(key: string): { identifier: string; sequence: number } {
    const match = ISSUE_KEY_PATTERN.exec(key.trim());
    if (!match) {
      throw new PlaneCliError("INVALID_ISSUE_KEY", `invalid issue key: ${key} (expected like ENG-123)`);
    }
    const identifier = match[1] ?? "";
    const sequence = Number.parseInt(match[2] ?? "0", 10);
    return { identifier, sequence };
  }

  async resolve(key: string): Promise<ResolvedIssue> {
    const { identifier, sequence } = this.parseKey(key);
    const project = await this.projects.findByIdentifier(identifier);
    const issues = await this.workItems.list({ project });
    const match = issues.find((i) => i.sequence_id === sequence);
    if (!match) {
      throw new NotFoundError(`issue not found: ${key}`, { project: identifier });
    }
    return { project, issueId: match.id };
  }
}
