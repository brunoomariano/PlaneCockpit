// RelationsService reads a work item's relations (the authoritative set of which
// related items exist now). The endpoint returns only target UUIDs grouped by
// relation type — no key, name, or timestamp — so this adapter just fetches and
// caches that dict. The key/related_at enrichment (from the activity log) and the
// name/state enrichment (per-target retrieve) are domain/application concerns,
// not the adapter's.

import type { Project } from "../types/project.js";
import type { RelationType } from "../types/relation.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { RELATION_TYPES } from "../types/relation.js";
import { ACTIVITIES_TTL_SECONDS } from "../config/defaults.js";
import type { PlaneApiClient } from "./client.js";
import type { IssueRelations } from "./relation-view.js";

// Plane returns the relations as an object keyed by relation type, each an array
// of UUIDs. Some types may be absent on older releases, so the adapter normalizes
// to a full IssueRelations with every type present (empty when missing).
type RawRelations = Partial<Record<RelationType, string[] | null>>;

function normalize(raw: RawRelations): IssueRelations {
  const relations = {} as IssueRelations;
  for (const type of RELATION_TYPES) {
    relations[type] = raw[type] ?? [];
  }
  return relations;
}

export class RelationsService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  // list returns the current relations for an issue, cache-first. The short TTL
  // matches the activity log's: opening the detail and toggling the relations
  // section reuses one fetch, and a freshly added relation appears on reopen.
  async list(project: Project, issueId: string, signal?: AbortSignal): Promise<IssueRelations> {
    const key = cacheKeys.issueRelations(this.api.workspace, project.id, issueId);
    const cached = await this.cache.get<IssueRelations>(key);
    if (cached) return cached;

    // The relations sub-resource lives under `work-items/`, not the `issues/`
    // alias that the other endpoints accept: `issues/{id}/relations/` 404s on
    // this deployment while `work-items/{id}/relations/` returns the dict. (Other
    // sub-resources like activities answer under both, which is why only this one
    // needs the explicit `work-items` segment.)
    const raw = await this.api.request<RawRelations>(
      this.api.workspacePath("projects", project.id, "work-items", issueId, "relations"),
      { signal },
    );
    const relations = normalize(raw);
    await this.cache.set(key, relations, ACTIVITIES_TTL_SECONDS);
    return relations;
  }
}
