import type { IssueState } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

export class StatesService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(projectId: string): Promise<IssueState[]> {
    const key = cacheKeys.states(this.api.workspace, projectId);
    const cached = await this.cache.get<IssueState[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<IssueState> | IssueState[]>(
      this.api.workspacePath("projects", projectId, "states"),
    );
    const list = Array.isArray(res) ? res : res.results;
    await this.cache.set(key, list);
    return list;
  }
}
