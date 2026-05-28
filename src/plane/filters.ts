import { createHash } from "node:crypto";
import type { ViewFilters } from "../types/views.js";

export interface NormalizedFilters {
  assignees?: string[];
  state_groups?: string[];
  labels?: string[];
  priorities?: string[];
  cycle?: string;
  module?: string;
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  const cleaned = arr.map((s) => s.trim()).filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned.sort() : undefined;
}

export function normalizeFilters(filters: ViewFilters | undefined): NormalizedFilters {
  if (!filters) return {};
  const out: NormalizedFilters = {};
  const assignees = toArray(filters.assignee);
  if (assignees) out.assignees = assignees;
  if (filters.state_group?.length) out.state_groups = [...filters.state_group].sort();
  if (filters.labels?.length) out.labels = [...filters.labels].sort();
  if (filters.priority?.length) out.priorities = [...filters.priority].sort();
  if (filters.cycle) out.cycle = filters.cycle;
  if (filters.module) out.module = filters.module;
  return out;
}

export function filtersFingerprint(filters: ViewFilters | undefined): string {
  const normalized = normalizeFilters(filters);
  const json = JSON.stringify(normalized);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}
