import { describe, it, expect } from "vitest";
import { computeViewport, issueColumns, assignLabel } from "./issue-list.js";
import type { Issue } from "../types/issue.js";

function issue(assignees: { id: string; display_name: string }[]): Issue {
  return {
    id: "i",
    sequence_id: 1,
    project_id: "p",
    project_identifier: "ENG",
    key: "ENG-1",
    name: "n",
    state: { id: "s", name: "Todo", group: "unstarted" },
    priority: "none",
    assignees,
    labels: [],
    created_at: "",
    updated_at: "",
  };
}

describe("issueColumns", () => {
  // TITLE absorbs the leftover width after the fixed columns and box chrome, so a
  // wider terminal yields a wider title.
  it("grows the title column with terminal width", () => {
    expect(issueColumns(140).title).toBeGreaterThan(issueColumns(90).title);
    expect(issueColumns(140).showState).toBe(true);
    expect(issueColumns(140).showAssign).toBe(true);
  });

  // Columns degrade in order as width shrinks: drop STATE first (ASSIGN survives
  // longer since assignees are the column users most want), then ASSIGN, then
  // collapse PRIORITY to a single letter, always keeping a usable title.
  it("drops STATE before ASSIGN as the terminal narrows", () => {
    expect(issueColumns(140)).toMatchObject({ showState: true, showAssign: true });
    // Mid width: STATE gone but ASSIGN still shown.
    expect(issueColumns(60)).toMatchObject({ showState: false, showAssign: true });
  });

  it("collapses PRIORITY to a single letter at the tightest widths", () => {
    const tight = issueColumns(34);
    expect(tight).toMatchObject({ showState: false, showAssign: false, compactPriority: true });
    expect(tight.priorityWidth).toBeLessThan(issueColumns(140).priorityWidth);
    // Wide layouts keep the full priority word.
    expect(issueColumns(140).compactPriority).toBe(false);
  });

  it("never shrinks the title below a readable floor", () => {
    expect(issueColumns(20).title).toBeGreaterThanOrEqual(12);
    expect(issueColumns(1).title).toBeGreaterThanOrEqual(12);
  });
});

describe("assignLabel", () => {
  it("joins assignee display names", () => {
    expect(
      assignLabel(
        issue([
          { id: "1", display_name: "ana" },
          { id: "2", display_name: "bruno" },
        ]),
        20,
      ),
    ).toBe("ana, bruno");
  });

  it("is empty when unassigned", () => {
    expect(assignLabel(issue([]), 20)).toBe("");
  });

  it("truncates to the column width", () => {
    expect(assignLabel(issue([{ id: "1", display_name: "a-very-long-name-here" }]), 8)).toBe(
      "a-very-…",
    );
  });
});

describe("computeViewport", () => {
  it("returns empty when there are no rows or no items", () => {
    expect(computeViewport(0, 0, 10)).toEqual({ start: 0, end: 0 });
    expect(computeViewport(10, 0, 0)).toEqual({ start: 0, end: 0 });
  });

  it("returns the full list when it fits", () => {
    expect(computeViewport(5, 2, 10)).toEqual({ start: 0, end: 5 });
  });

  it("keeps the previous window when selection is inside it", () => {
    expect(computeViewport(50, 12, 10, 10)).toEqual({ start: 10, end: 20 });
  });

  it("scrolls down just enough when selection moves past the bottom", () => {
    expect(computeViewport(50, 25, 10, 10)).toEqual({ start: 16, end: 26 });
  });

  it("scrolls up when selection moves above the window", () => {
    expect(computeViewport(50, 4, 10, 20)).toEqual({ start: 4, end: 14 });
  });

  it("clamps the window to the list bounds", () => {
    expect(computeViewport(50, 49, 10)).toEqual({ start: 40, end: 50 });
  });

  it("handles selection past the end gracefully", () => {
    const { start, end } = computeViewport(50, 100, 10, 0);
    expect(end - start).toBe(10);
    expect(end).toBeLessThanOrEqual(50);
  });
});
