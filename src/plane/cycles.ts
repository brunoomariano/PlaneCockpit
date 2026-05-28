import type { Cycle } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

export class CyclesService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(projectId: string): Promise<Cycle[]> {
    const key = cacheKeys.cycles(this.api.workspace, projectId);
    const cached = await this.cache.get<Cycle[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<Cycle> | Cycle[]>(
      this.api.workspacePath("projects", projectId, "cycles"),
    );
    const list = Array.isArray(res) ? res : res.results;
    await this.cache.set(key, list);
    return list;
  }

  async current(projectId: string): Promise<Cycle | undefined> {
    const cycles = await this.list(projectId);
    return cycles.find((c) => c.is_current) ?? cycles[0];
  }
}
