/**
 * Block — formatRelationRow: the relation line in the detail's Relations section.
 *
 * Covers the key-only row (target not yet resolved), the enriched row (state +
 * name once the target retrieve settles), the related_at "ago" suffix and its
 * "just now" floor, and the short-UUID fallback when even the key is absent.
 */

import { describe, it, expect } from "vitest";
import { formatRelationRow } from "./format-relation.js";
import type { IssueRelation } from "../types/relation.js";
import type { Issue } from "../types/issue.js";

const NOW = Date.parse("2026-06-18T00:00:00.000Z");

function relation(partial: Partial<IssueRelation>): IssueRelation {
  return {
    type: partial.type ?? "relates_to",
    targetId: partial.targetId ?? "uuid-aaaaaaaa-bbbb",
    targetKey: partial.targetKey,
    relatedAt: partial.relatedAt,
    target: partial.target,
  };
}

function targetIssue(name: string, state: string): Issue {
  return {
    id: "t",
    sequence_id: 1,
    project_id: "p",
    project_identifier: "ENG",
    key: "ENG-80",
    name,
    state: { id: "s", name: state, group: "backlog" },
    priority: "none",
    assignees: [],
    labels: [],
    created_at: "",
    updated_at: "",
  };
}

describe("formatRelationRow", () => {
  it("shows just the key before the target resolves", () => {
    expect(formatRelationRow(relation({ targetKey: "ENG-80" }), NOW)).toBe("ENG-80");
  });

  it("appends state and name once the target is resolved", () => {
    const r = relation({ targetKey: "ENG-80", target: targetIssue("Lead Page", "Backlog") });
    expect(formatRelationRow(r, NOW)).toBe("ENG-80 · Backlog · Lead Page");
  });

  it("appends the related_at as an 'ago' suffix", () => {
    const r = relation({ targetKey: "ENG-80", relatedAt: "2026-06-16T00:00:00.000Z" });
    expect(formatRelationRow(r, NOW)).toBe("ENG-80 · 2d ago");
  });

  it("uses 'just now' for a sub-minute related_at", () => {
    const r = relation({ targetKey: "ENG-80", relatedAt: "2026-06-18T00:00:00.000Z" });
    expect(formatRelationRow(r, NOW)).toBe("ENG-80 · just now");
  });

  it("falls back to a short UUID when the key is absent", () => {
    const r = relation({ targetId: "abcdef12-3456-7890", targetKey: undefined });
    expect(formatRelationRow(r, NOW)).toBe("abcdef12…");
  });
});
