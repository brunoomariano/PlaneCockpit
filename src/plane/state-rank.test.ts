/**
 * State ranking from the configured `state_order`.
 *
 * `buildStateRank` turns a slug list into a rank used by the `state` sort and by
 * quick-transition navigation. These tests pin the slug normalization and the
 * listed-first / unlisted-by-group ordering, including the no-list fallback.
 */

import { describe, it, expect } from "vitest";
import { buildStateRank, normalizeStateSlug } from "./state-rank.js";
import type { IssueState } from "../types/issue.js";

function state(name: string, group: IssueState["group"]): IssueState {
  return { id: `s-${name}`, name, group };
}

describe("normalizeStateSlug", () => {
  it("lowercases, trims, and collapses internal whitespace", () => {
    expect(normalizeStateSlug("  In   Progress ")).toBe("in progress");
    expect(normalizeStateSlug("READY")).toBe("ready");
  });

  // \s also matches tabs/newlines, so a state name pasted with odd whitespace
  // still folds to the same slug as the clean config entry.
  it("collapses tabs and newlines, not just spaces", () => {
    expect(normalizeStateSlug("In\tProgress")).toBe("in progress");
    expect(normalizeStateSlug("In\n\nProgress")).toBe("in progress");
    expect(normalizeStateSlug("In \t Progress")).toBe("in progress");
  });

  it("folds an empty or all-whitespace name to an empty slug", () => {
    expect(normalizeStateSlug("")).toBe("");
    expect(normalizeStateSlug("   \t\n ")).toBe("");
  });
});

describe("buildStateRank", () => {
  it("ranks listed states by their position in the list", () => {
    const rank = buildStateRank(["backlog", "in progress", "in review"]);
    expect(rank(state("Backlog", "backlog"))).toBe(0);
    expect(rank(state("In Progress", "started"))).toBe(1);
    expect(rank(state("In Review", "started"))).toBe(2);
  });

  it("matches slugs case-insensitively and ignoring extra whitespace", () => {
    const rank = buildStateRank(["in progress"]);
    expect(rank(state("In  Progress", "started"))).toBe(0);
    expect(rank(state("IN PROGRESS", "started"))).toBe(0);
  });

  // Unlisted states rank after every listed one; among themselves they keep
  // workflow-group order (backlog < cancelled), since the groups are fixed.
  it("places unlisted states after listed ones, ordered by workflow group", () => {
    const rank = buildStateRank(["in progress"]);
    const listed = rank(state("In Progress", "started"));
    const backlog = rank(state("Backlog", "backlog"));
    const cancelled = rank(state("Cancelled", "cancelled"));
    expect(listed).toBeLessThan(backlog);
    expect(backlog).toBeLessThan(cancelled);
  });

  // A duplicate slug must not shift the earlier rank (first occurrence wins).
  it("keeps the first position for a duplicated slug", () => {
    const rank = buildStateRank(["ready", "in progress", "ready"]);
    expect(rank(state("Ready", "unstarted"))).toBe(0);
  });

  // With no list every state falls back to workflow-group rank, preserving the
  // behaviour from before state_order existed.
  it("falls back to workflow-group order with no list", () => {
    const rank = buildStateRank(undefined);
    expect(rank(state("Backlog", "backlog"))).toBeLessThan(rank(state("Done", "completed")));
  });

  it("treats an empty list the same as no list", () => {
    const rank = buildStateRank([]);
    expect(rank(state("Backlog", "backlog"))).toBeLessThan(rank(state("Cancelled", "cancelled")));
  });

  // The config side is normalized too: a slug typed with messy case/whitespace
  // still matches a cleanly named state. Guards against normalizing only one side.
  it("normalizes the configured slugs, not just the state name", () => {
    const rank = buildStateRank(["  IN   Progress "]);
    expect(rank(state("In Progress", "started"))).toBe(0);
  });

  // The unlisted offset must dominate any listed position, even for a long list.
  // A state at the far end of state_order still ranks before any unlisted state.
  it("ranks every listed state before any unlisted one regardless of list length", () => {
    const order = Array.from({ length: 500 }, (_, i) => `state-${i}`);
    const rank = buildStateRank(order);
    const lastListed = rank(state("state-499", "started"));
    const unlistedBacklog = rank(state("Surprise", "backlog"));
    expect(lastListed).toBe(499);
    expect(lastListed).toBeLessThan(unlistedBacklog);
  });

  // Two unlisted states in the same group get the same rank; the comparator that
  // uses this rank then relies on a stable sort to keep input order.
  it("gives unlisted states in the same group an equal rank", () => {
    const rank = buildStateRank(["backlog"]);
    expect(rank(state("Review", "started"))).toBe(rank(state("QA", "started")));
  });

  // An unmatched listed slug (a state name nobody has) simply never applies; it
  // does not shift the ranks of the states that do match.
  it("ignores listed slugs that match no state", () => {
    const rank = buildStateRank(["ghost", "in progress"]);
    // "in progress" keeps position 1 even though "ghost" matches nothing.
    expect(rank(state("In Progress", "started"))).toBe(1);
  });
});
