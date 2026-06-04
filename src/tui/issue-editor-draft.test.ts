/**
 * Block 3 — Issue editor draft: the headless diff logic behind the edit modal.
 *
 * The editor opens a draft seeded from the issue's current state/priority/
 * assignees, tracks whether it diverges from that original, and builds the
 * minimal PATCH carrying only the changed fields. These tests pin that logic
 * (independent of React): seeding, dirty detection, revert-to-original, the
 * minimal patch, and the no-change case.
 */

import { describe, it, expect } from "vitest";
import {
  editorOriginal,
  isDraftDirty,
  buildUpdatePatch,
  type EditorDraft,
} from "./issue-editor-draft.js";
import type { Issue } from "../types/issue.js";

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "id-1",
    sequence_id: 1,
    project_id: "p1",
    project_identifier: "ENG",
    key: "ENG-1",
    name: "Some issue",
    state: { id: "s-todo", name: "Todo", group: "unstarted" },
    priority: "medium",
    assignees: [{ id: "u-1", display_name: "Ana" }],
    labels: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("editorOriginal", () => {
  // Scenario 8: opening the editor materializes the issue's current values.
  it("should snapshot the issue's current state, priority, assignees and labels", () => {
    const original = editorOriginal(issue({ labels: [{ id: "l-1", name: "bug" }] as never }));
    expect(original).toEqual({
      state_id: "s-todo",
      priority: "medium",
      assignee_ids: ["u-1"],
      label_ids: ["l-1"],
    });
  });
});

describe("isDraftDirty", () => {
  // Scenario 10: changing a field marks the draft dirty.
  it("should report dirty when the state changes", () => {
    const original = editorOriginal(issue());
    const draft: EditorDraft = { ...original, state_id: "s-doing" };
    expect(isDraftDirty(original, draft)).toBe(true);
  });

  it("should report dirty when the priority changes", () => {
    const original = editorOriginal(issue());
    const draft: EditorDraft = { ...original, priority: "high" };
    expect(isDraftDirty(original, draft)).toBe(true);
  });

  it("should report dirty when assignees change regardless of order", () => {
    const original = editorOriginal(issue({ assignees: [{ id: "u-1", display_name: "Ana" }] }));
    const draft: EditorDraft = { ...original, assignee_ids: ["u-2", "u-1"] };
    expect(isDraftDirty(original, draft)).toBe(true);
  });

  it("should report dirty when labels change", () => {
    const original = editorOriginal(issue({ labels: [{ id: "l-1", name: "bug" }] as never }));
    const draft: EditorDraft = { ...original, label_ids: ["l-1", "l-2"] };
    expect(isDraftDirty(original, draft)).toBe(true);
  });

  // Scenario 11: reverting every field back to the original clears dirty.
  it("should report clean when the draft equals the original (order-insensitive)", () => {
    const original = editorOriginal(issue({ assignees: [{ id: "u-1" }, { id: "u-2" }] as never }));
    const draft: EditorDraft = { ...original, assignee_ids: ["u-2", "u-1"] };
    expect(isDraftDirty(original, draft)).toBe(false);
  });
});

describe("buildUpdatePatch", () => {
  // Scenario 12: the PATCH carries only the changed fields.
  it("should include only the fields that changed", () => {
    const original = editorOriginal(issue());
    const draft: EditorDraft = { ...original, state_id: "s-doing", priority: "urgent" };
    expect(buildUpdatePatch(original, draft)).toEqual({
      state_id: "s-doing",
      priority: "urgent",
    });
  });

  it("should include assignee_ids only when the set changed", () => {
    const original = editorOriginal(issue());
    const draft: EditorDraft = { ...original, assignee_ids: [] };
    expect(buildUpdatePatch(original, draft)).toEqual({ assignee_ids: [] });
  });

  it("should include label_ids only when the set changed", () => {
    const original = editorOriginal(issue({ labels: [{ id: "l-1", name: "bug" }] as never }));
    const draft: EditorDraft = { ...original, label_ids: [] };
    expect(buildUpdatePatch(original, draft)).toEqual({ label_ids: [] });
  });

  // Scenario 13: no changes => empty patch (the dashboard treats it as a no-op).
  it("should produce an empty patch when nothing changed", () => {
    const original = editorOriginal(issue());
    const draft: EditorDraft = { ...original };
    expect(buildUpdatePatch(original, draft)).toEqual({});
  });
});
