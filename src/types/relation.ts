// Relation domain model. Plane's relations endpoint returns target work-item
// UUIDs grouped by relation type and nothing else (no key, name, timestamp), so
// an IssueRelation is enriched from two other sources: the activity log supplies
// the related_at and the human-readable key, and a per-key retrieve supplies the
// target issue (name/state). Construction/joining lives in plane/relation-view.ts.

import type { Issue } from "./issue.js";

// RelationType is the set of relation kinds Plane records. The strings match the
// `field` value in the activity log and the keys of the relations endpoint's
// response, so a single value joins both sources.
export type RelationType =
  | "blocking"
  | "blocked_by"
  | "duplicate"
  | "relates_to"
  | "start_after"
  | "start_before"
  | "finish_after"
  | "finish_before";

// RELATION_TYPES is the display order of relation groups in the detail section:
// the dependency relations (blocking / blocked-by) first as the most operationally
// relevant, then the looser ones.
export const RELATION_TYPES: readonly RelationType[] = [
  "blocking",
  "blocked_by",
  "relates_to",
  "duplicate",
  "start_after",
  "start_before",
  "finish_after",
  "finish_before",
];

// RELATION_LABELS maps each type to the label shown as the group heading.
export const RELATION_LABELS: Record<RelationType, string> = {
  blocking: "blocking",
  blocked_by: "blocked by",
  relates_to: "relates to",
  duplicate: "duplicate of",
  start_after: "starts after",
  start_before: "starts before",
  finish_after: "finishes after",
  finish_before: "finishes before",
};

// IssueRelation is one related work item under a given relation type. `targetId`
// (the UUID) always exists; `targetKey` and `relatedAt` come from the activity
// log and may be absent for a relation with no recorded add event; `target` is
// the lazily-retrieved issue (name/state), absent until enrichment resolves it.
export interface IssueRelation {
  type: RelationType;
  targetId: string;
  targetKey?: string;
  relatedAt?: string;
  target?: Issue;
}
