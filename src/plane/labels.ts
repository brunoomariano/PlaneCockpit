import type { IssueLabel } from "../types/issue.js";
import type { Project } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { STATES_LABELS_TTL_SECONDS } from "../config/defaults.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

interface RawLabel {
  id: string;
  name: string;
  color?: string;
}

function toLabel(raw: RawLabel): IssueLabel {
  return { id: raw.id, name: raw.name, color: raw.color };
}

// LabelsService lists the labels of a project. Labels are project-scoped in
// Plane (each project defines its own), so the service fetches and caches them
// per project id — the edit modal's label picker reads them through here.
// Mirrors StatesService.
export class LabelsService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  async list(project: Project): Promise<IssueLabel[]> {
    const key = cacheKeys.labels(this.api.workspace, project.id);
    const cached = await this.cache.get<IssueLabel[]>(key);
    if (cached) return cached;
    const res = await this.api.request<PaginatedResponse<RawLabel> | RawLabel[]>(
      this.api.workspacePath("projects", project.id, "labels"),
    );
    const list = Array.isArray(res) ? res : res.results;
    const labels = list.map(toLabel);
    // Explicit short TTL: a label created in Plane reappears within minutes,
    // regardless of how high the profile-wide cache.ttl is set for issues.
    await this.cache.set(key, labels, STATES_LABELS_TTL_SECONDS);
    return labels;
  }
}
