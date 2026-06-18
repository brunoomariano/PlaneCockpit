/**
 * Block — relation-view: joining current relations with the activity log.
 *
 * The relations endpoint gives target UUIDs by type; buildRelations enriches each
 * with the key/related_at of its add event from the log. Covers: the happy join,
 * display ordering across types, a target with no add event (kept, no key/date),
 * an add event for a UUID no longer in the relations (ignored — removed), the
 * latest add winning on re-add, and empty inputs.
 */

import { describe, it, expect } from "vitest";
import { buildRelations, type IssueRelations } from "./relation-view.js";
import type { IssueActivity } from "../types/activity.js";

function emptyRelations(): IssueRelations {
  return {
    blocking: [],
    blocked_by: [],
    duplicate: [],
    relates_to: [],
    start_after: [],
    start_before: [],
    finish_after: [],
    finish_before: [],
  };
}

function addEvent(field: string, targetId: string, key: string, createdAt: string): IssueActivity {
  return {
    id: `${field}-${targetId}`,
    verb: "updated",
    field,
    oldValue: "",
    newValue: key,
    oldIdentifier: targetId,
    createdAt,
  };
}

describe("buildRelations", () => {
  // A relation present in the endpoint and with an add event gets its key/date.
  it("attaches key and related_at from the matching add event", () => {
    const relations = { ...emptyRelations(), relates_to: ["uuid-a"] };
    const log = [addEvent("relates_to", "uuid-a", "ENG-80", "2026-06-18T16:47:07.000Z")];
    expect(buildRelations(relations, log)).toEqual([
      {
        type: "relates_to",
        targetId: "uuid-a",
        targetKey: "ENG-80",
        relatedAt: "2026-06-18T16:47:07.000Z",
      },
    ]);
  });

  // Groups are emitted in the configured display order: blocking before
  // blocked_by before relates_to, regardless of the endpoint's key order.
  it("orders relations by relation type", () => {
    const relations = {
      ...emptyRelations(),
      relates_to: ["r"],
      blocking: ["b"],
      blocked_by: ["bb"],
    };
    const types = buildRelations(relations, []).map((r) => r.type);
    expect(types).toEqual(["blocking", "blocked_by", "relates_to"]);
  });

  // A current relation with no recorded add event still appears (the endpoint is
  // authoritative), just without a key or related_at.
  it("keeps a relation that has no add event in the log", () => {
    const relations = { ...emptyRelations(), blocked_by: ["uuid-x"] };
    expect(buildRelations(relations, [])).toEqual([
      { type: "blocked_by", targetId: "uuid-x", targetKey: undefined, relatedAt: undefined },
    ]);
  });

  // An add event whose UUID is no longer a current relation (the relation was
  // removed) must not resurrect it: only endpoint relations are listed.
  it("ignores add events for relations that no longer exist", () => {
    const relations = emptyRelations();
    const log = [addEvent("relates_to", "ghost", "ENG-1", "2026-06-18T10:00:00.000Z")];
    expect(buildRelations(relations, log)).toEqual([]);
  });

  // A relation removed then re-added has two events; the latest related_at wins.
  it("uses the most recent add event on re-add", () => {
    const relations = { ...emptyRelations(), relates_to: ["uuid-a"] };
    const log = [
      addEvent("relates_to", "uuid-a", "ENG-80", "2026-06-01T00:00:00.000Z"),
      addEvent("relates_to", "uuid-a", "ENG-80", "2026-06-18T00:00:00.000Z"),
    ];
    expect(buildRelations(relations, log)[0]?.relatedAt).toBe("2026-06-18T00:00:00.000Z");
  });

  // Non-relation events (state, priority) are ignored by the join.
  it("ignores non-relation activity events", () => {
    const relations = { ...emptyRelations(), relates_to: ["uuid-a"] };
    const log: IssueActivity[] = [
      { id: "s", verb: "updated", field: "state", oldIdentifier: "uuid-a", createdAt: "t" },
    ];
    expect(buildRelations(relations, log)[0]?.relatedAt).toBeUndefined();
  });

  it("returns nothing when there are no relations", () => {
    expect(buildRelations(emptyRelations(), [])).toEqual([]);
  });
});
