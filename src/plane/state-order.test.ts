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

// With a state_order list, both navigation and ordering follow the declared slug
// order instead of the workflow group — so `n`/`p` step through the same
// sequence the user configured for `sort: state`.
describe("orderStates / neighbourState with state_order", () => {
  // "In Progress" (started) before "In Review" (started): the group rank cannot
  // express this, but a state_order list can.
  const ORDER = ["backlog", "in progress", "in review", "done"];

  it("orders states by the declared slug order", () => {
    const states: IssueState[] = [
      { id: "review", name: "In Review", group: "started" },
      { id: "doing", name: "In Progress", group: "started" },
      { id: "backlog", name: "Backlog", group: "backlog" },
    ];
    expect(orderStates(states, ORDER).map((s) => s.id)).toEqual(["backlog", "doing", "review"]);
  });

  it("steps forward through the declared order", () => {
    const states: IssueState[] = [
      { id: "doing", name: "In Progress", group: "started" },
      { id: "review", name: "In Review", group: "started" },
    ];
    // Forward from In Progress lands on In Review (declared next), not the other
    // way around as plain group order would have it for same-group states.
    expect(neighbourState(states, "doing", 1, ORDER)?.id).toBe("review");
    expect(neighbourState(states, "review", -1, ORDER)?.id).toBe("doing");
  });

  // A state not in state_order still navigates: it sorts after the listed ones
  // (by group), so it has well-defined neighbours instead of falling out.
  it("places unlisted states after listed ones and still steps into them", () => {
    const states: IssueState[] = [
      { id: "blocked", name: "Blocked", group: "started" }, // not in ORDER
      { id: "doing", name: "In Progress", group: "started" },
    ];
    // Listed "In Progress" comes first; "Blocked" (unlisted) follows, so forward
    // from In Progress reaches Blocked.
    expect(orderStates(states, ORDER).map((s) => s.id)).toEqual(["doing", "blocked"]);
    expect(neighbourState(states, "doing", 1, ORDER)?.id).toBe("blocked");
  });

  // The end-of-order no-op (return undefined, no wrap-around) must still hold
  // when the order comes from state_order rather than the workflow group.
  it("is a no-op past the last declared state", () => {
    const states: IssueState[] = [
      { id: "backlog", name: "Backlog", group: "backlog" },
      { id: "review", name: "In Review", group: "started" },
    ];
    // "In Review" is the last of these two in ORDER; forward from it is undefined.
    expect(neighbourState(states, "review", 1, ORDER)).toBeUndefined();
    expect(neighbourState(states, "backlog", -1, ORDER)).toBeUndefined();
  });

  // A configured slug that matches none of the project's states is inert: the
  // remaining order is unaffected. Guards navigation against stale config slugs.
  it("ignores state_order slugs that no project state has", () => {
    const states: IssueState[] = [
      { id: "review", name: "In Review", group: "started" },
      { id: "doing", name: "In Progress", group: "started" },
    ];
    // ORDER also lists "backlog"/"done", which are absent here — order still holds.
    expect(orderStates(states, ORDER).map((s) => s.id)).toEqual(["doing", "review"]);
  });
});
