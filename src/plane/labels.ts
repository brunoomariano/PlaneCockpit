import type { IssueLabel } from "../types/issue.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

export class LabelsService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(projectId: string): Promise<IssueLabel[]> {
    const key = cacheKeys.labels(this.api.workspace, projectId);
    const cached = await this.cache.get<IssueLabel[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<IssueLabel> | IssueLabel[]>(
      this.api.workspacePath("projects", projectId, "labels"),
    );
    const list = Array.isArray(res) ? res : res.results;
    await this.cache.set(key, list);
    return list;
  }
}
