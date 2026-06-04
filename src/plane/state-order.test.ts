/**
 * State ordering and neighbour lookup for quick transitions.
 *
 * The `>` / `<` bindings move an issue one step along the project's workflow
 * order (group lifecycle, then API order within a group). These tests pin the
 * ordering and the neighbour lookup, including the no-op at each end and an
 * unknown current state.
 */

import { describe, it, expect } from "vitest";
import { orderStates, neighbourState } from "./state-order.js";
import type { IssueState } from "../types/issue.js";

// Deliberately out of lifecycle order to prove the sort reorders by group.
const STATES: IssueState[] = [
  { id: "done", name: "Done", group: "completed" },
  { id: "todo", name: "Todo", group: "unstarted" },
  { id: "doing", name: "In Progress", group: "started" },
  { id: "backlog", name: "Backlog", group: "backlog" },
  { id: "cancelled", name: "Cancelled", group: "cancelled" },
];

describe("orderStates", () => {
  it("orders states by the group lifecycle", () => {
    expect(orderStates(STATES).map((s) => s.id)).toEqual([
      "backlog",
      "todo",
      "doing",
      "done",
      "cancelled",
    ]);
  });

  it("keeps the API order for states sharing a group (stable)", () => {
    const sameGroup: IssueState[] = [
      { id: "a", name: "Review", group: "started" },
      { id: "b", name: "QA", group: "started" },
    ];
    expect(orderStates(sameGroup).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("neighbourState", () => {
  it("returns the next state forward", () => {
    expect(neighbourState(STATES, "todo", 1)?.id).toBe("doing");
  });

  it("returns the previous state backward", () => {
    expect(neighbourState(STATES, "doing", -1)?.id).toBe("todo");
  });

  it("is undefined moving forward from the last state", () => {
    expect(neighbourState(STATES, "cancelled", 1)).toBeUndefined();
  });

  it("is undefined moving backward from the first state", () => {
    expect(neighbourState(STATES, "backlog", -1)).toBeUndefined();
  });

  it("is undefined when the current state is not among the project's states", () => {
    expect(neighbourState(STATES, "unknown", 1)).toBeUndefined();
  });
});
