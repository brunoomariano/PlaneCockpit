// ActivitiesService reads a work item's activity log (the per-field change
// history Plane records). It is the transport adapter only: it fetches and maps
// raw rows to the IssueActivity domain model and caches the result per issue. The
// state-change derivation (time in state) lives in plane/state-duration.ts, not
// here — the adapter must not replicate that domain rule.

import type { IssueActivity } from "../types/activity.js";
import type { Project } from "../types/project.js";
import type { CacheStore } from "../cache/types.js";
import { cacheKeys } from "../cache/keys.js";
import { ACTIVITIES_TTL_SECONDS } from "../config/defaults.js";
import type { PlaneApiClient, PaginatedResponse } from "./client.js";

// Plane returns activity rows in snake_case. Fields beyond these exist
// (old_identifier, new_identifier, epoch, …) but the detail view does not use
// them, so the adapter maps only what IssueActivity declares.
interface RawActivity {
  id: string;
  verb: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  old_identifier?: string | null;
  new_identifier?: string | null;
  created_at: string;
  actor?: string | null;
}

function toActivity(raw: RawActivity): IssueActivity {
  return {
    id: raw.id,
    verb: raw.verb,
    field: raw.field ?? undefined,
    oldValue: raw.old_value ?? undefined,
    newValue: raw.new_value ?? undefined,
    oldIdentifier: raw.old_identifier ?? undefined,
    newIdentifier: raw.new_identifier ?? undefined,
    createdAt: raw.created_at,
    actor: raw.actor ?? undefined,
  };
}

// Self-hosted Plane returns the activity log either as a bare array, a `{ result:
// [...] }` envelope (observed on this deployment), or the standard paginated
// `{ results: [...] }`. unwrap accepts all three so the adapter is robust across
// releases, the same way StatesService tolerates array-or-page responses.
type RawActivitiesResponse =
  | RawActivity[]
  | { result: RawActivity[] }
  | PaginatedResponse<RawActivity>;

function unwrap(res: RawActivitiesResponse): RawActivity[] {
  if (Array.isArray(res)) return res;
  if ("result" in res && Array.isArray(res.result)) return res.result;
  if ("results" in res && Array.isArray(res.results)) return res.results;
  return [];
}

export class ActivitiesService {
  constructor(
    private readonly api: PlaneApiClient,
    private readonly cache: CacheStore,
  ) {}

  // list returns the issue's activity log, cache-first. The cached copy lets the
  // detail view's timing line and the activity tab share a single fetch; the
  // short TTL means a fresh change shows up the next time the detail opens.
  async list(project: Project, issueId: string, signal?: AbortSignal): Promise<IssueActivity[]> {
    const key = cacheKeys.issueActivities(this.api.workspace, project.id, issueId);
    const cached = await this.cache.get<IssueActivity[]>(key);
    if (cached) return cached;

    const res = await this.api.request<RawActivitiesResponse>(
      this.api.workspacePath("projects", project.id, "issues", issueId, "activities"),
      { signal },
    );
    const activities = unwrap(res).map(toActivity);
    await this.cache.set(key, activities, ACTIVITIES_TTL_SECONDS);
    return activities;
  }
}
