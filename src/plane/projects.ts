import type { Project } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { NotFoundError } from "../utils/errors.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

interface RawProject {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  workspace?: string;
  workspace_id?: string;
}

function toProject(raw: RawProject): Project {
  return {
    id: raw.id,
    identifier: raw.identifier,
    name: raw.name,
    description: raw.description,
    workspace_id: raw.workspace_id ?? raw.workspace ?? "",
  };
}

export class ProjectsService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(): Promise<Project[]> {
    const cacheKey = cacheKeys.projects(this.api.workspace);
    const cached = await this.cache.get<Project[]>(cacheKey);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<RawProject> | RawProject[]>(
      this.api.workspacePath("projects"),
    );
    const list = Array.isArray(res) ? res : res.results;
    const projects = list.map(toProject);
    await this.cache.set(cacheKey, projects);
    return projects;
  }

  async findByIdentifier(identifier: string): Promise<Project> {
    const key = cacheKeys.project(this.api.workspace, identifier);
    const cached = await this.cache.get<Project>(key);
    if (cached) return cached;
    const projects = await this.list();
    const match = projects.find((p) => p.identifier === identifier);
    if (!match) {
      throw new NotFoundError(`project not found: ${identifier}`, {
        available: projects.map((p) => p.identifier),
      });
    }
    await this.cache.set(key, match);
    return match;
  }
}
