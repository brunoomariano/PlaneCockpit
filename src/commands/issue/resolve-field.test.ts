/**
 * resolveStateByNameOrId / resolveLabelsByNameOrId: mapping CLI tokens to ids.
 *
 * The `plc issue transition` / `plc issue label` commands accept a state/label by
 * name (case-insensitive) or id, scoped to the issue's project. These tests pin
 * id and name resolution, the unknown and ambiguous error cases, and the
 * label-specific order/dedupe/clear behaviour.
 */

import { describe, it, expect } from "vitest";
import { resolveStateByNameOrId, resolveLabelsByNameOrId } from "./resolve-field.js";
import { NotFoundError } from "../../utils/errors.js";
import type { IssueState, IssueLabel } from "../../types/issue.js";

const STATES: IssueState[] = [
  { id: "s-todo", name: "Todo", group: "unstarted" },
  { id: "s-doing", name: "In Progress", group: "started" },
  { id: "s-done", name: "Done", group: "completed" },
];

const LABELS: IssueLabel[] = [
  { id: "l-bug", name: "bug" },
  { id: "l-chore", name: "chore" },
];

describe("resolveStateByNameOrId", () => {
  it("resolves a state by its id", () => {
    expect(resolveStateByNameOrId("s-doing", STATES)).toBe("s-doing");
  });

  it("resolves a state by name, case-insensitively", () => {
    expect(resolveStateByNameOrId("in progress", STATES)).toBe("s-doing");
  });

  it("throws with the valid options for an unknown state", () => {
    expect(() => resolveStateByNameOrId("nope", STATES)).toThrow(NotFoundError);
    expect(() => resolveStateByNameOrId("nope", STATES)).toThrow(/Todo, In Progress, Done/);
  });

  it("throws when the name is ambiguous", () => {
    const dup: IssueState[] = [
      { id: "a", name: "Review", group: "started" },
      { id: "b", name: "review", group: "started" },
    ];
    expect(() => resolveStateByNameOrId("review", dup)).toThrow(/ambiguous/);
  });
});

describe("resolveLabelsByNameOrId", () => {
  it("resolves labels by name or id, preserving order", () => {
    expect(resolveLabelsByNameOrId(["l-bug", "chore"], LABELS)).toEqual(["l-bug", "l-chore"]);
  });

  it("de-duplicates repeated labels", () => {
    expect(resolveLabelsByNameOrId(["bug", "l-bug"], LABELS)).toEqual(["l-bug"]);
  });

  it("returns an empty list for no inputs (clears labels)", () => {
    expect(resolveLabelsByNameOrId([], LABELS)).toEqual([]);
  });

  it("throws with the valid options for an unknown label", () => {
    expect(() => resolveLabelsByNameOrId(["missing"], LABELS)).toThrow(/bug, chore/);
  });
});
