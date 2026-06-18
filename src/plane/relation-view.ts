// Relation join. The relations endpoint is authoritative for which relations
// exist now but gives only target UUIDs; the activity log carries the key and the
// related_at but keeps events for removed relations too. So the current relations
// drive the list, and each is enriched with the key/related_at of its add event
// from the log (matched by target UUID). This is a pure transform — the adapter
// fetches; this joins.

import type { IssueActivity } from "../types/activity.js";
import type { IssueRelation, RelationType } from "../types/relation.js";
import { RELATION_TYPES } from "../types/relation.js";

// IssueRelations is the relations endpoint's response: target UUIDs grouped by
// relation type. Every type is present (possibly empty), matching Plane's shape.
export type IssueRelations = Record<RelationType, string[]>;

// AddEvent is the part of a relation "add" activity the join needs: the target
// UUID (Plane puts it in oldIdentifier for an add) and when it happened.
interface AddEvent {
  relatedAt: string;
  key?: string;
}

// indexAddEvents builds a UUID → add-event map from the log. A relation add is a
// `field` matching a relation type with a target in oldIdentifier; the latest
// such event per UUID wins (a relation removed and re-added shows the re-add).
function indexAddEvents(activities: readonly IssueActivity[]): Map<string, AddEvent> {
  const byTarget = new Map<string, AddEvent>();
  for (const a of activities) {
    if (!a.field || !RELATION_TYPES.includes(a.field as RelationType)) continue;
    const target = a.oldIdentifier;
    if (!target) continue;
    const existing = byTarget.get(target);
    if (!existing || a.createdAt > existing.relatedAt) {
      byTarget.set(target, { relatedAt: a.createdAt, key: a.newValue });
    }
  }
  return byTarget;
}

// buildRelations turns the current relations (UUIDs by type) into a flat,
// display-ordered IssueRelation[], attaching the key/related_at from the log when
// the target's add event is present. Targets with no recorded add event still
// appear (sourced from the authoritative endpoint), just without key/related_at.
export function buildRelations(
  relations: IssueRelations,
  activities: readonly IssueActivity[],
): IssueRelation[] {
  const addEvents = indexAddEvents(activities);
  const result: IssueRelation[] = [];
  for (const type of RELATION_TYPES) {
    for (const targetId of relations[type] ?? []) {
      const add = addEvents.get(targetId);
      result.push({ type, targetId, targetKey: add?.key, relatedAt: add?.relatedAt });
    }
  }
  return result;
}
