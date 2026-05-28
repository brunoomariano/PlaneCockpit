import type { Module } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

export class ModulesService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(projectId: string): Promise<Module[]> {
    const key = cacheKeys.modules(this.api.workspace, projectId);
    const cached = await this.cache.get<Module[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<Module> | Module[]>(
      this.api.workspacePath("projects", projectId, "modules"),
    );
    const list = Array.isArray(res) ? res : res.results;
    await this.cache.set(key, list);
    return list;
  }
}
