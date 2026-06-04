import type { IssueState, IssueStateGroup } from "../types/issue.js";
import type { Project } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

interface RawState {
  id: string;
  name: string;
  group: IssueStateGroup;
  color?: string;
}

function toState(raw: RawState): IssueState {
  return { id: raw.id, name: raw.name, group: raw.group, color: raw.color };
}

// StatesService lists the workflow states of a project. States are project-scoped
// in Plane (each project defines its own backlog/started/completed columns), so
// the service fetches and caches them per project id — the edit modal's state
// picker reads them through here.
export class StatesService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(project: Project): Promise<IssueState[]> {
    const key = cacheKeys.states(this.api.workspace, project.id);
    const cached = await this.cache.get<IssueState[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<RawState> | RawState[]>(
      this.api.workspacePath("projects", project.id, "states"),
    );
    const list = Array.isArray(res) ? res : res.results;
    const states = list.map(toState);
    await this.cache.set(key, states);
    return states;
  }
}
