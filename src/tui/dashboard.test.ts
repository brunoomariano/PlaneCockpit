import { describe, it, expect } from "vitest";
import {
  isNarrowLayout,
  listViewportRows,
  restoredSelection,
  NARROW_BREAKPOINT,
} from "./dashboard.js";

describe("isNarrowLayout", () => {
  // Narrow stacks the views panel on top; wide keeps it as a left column.
  it("is narrow strictly below the breakpoint", () => {
    expect(isNarrowLayout(NARROW_BREAKPOINT - 1)).toBe(true);
    expect(isNarrowLayout(40)).toBe(true);
  });

  it("is wide at and above the breakpoint", () => {
    expect(isNarrowLayout(NARROW_BREAKPOINT)).toBe(false);
    expect(isNarrowLayout(120)).toBe(false);
  });
});

describe("listViewportRows", () => {
  const base = { terminalRows: 40, filtering: false, hasFilter: false, narrow: false };

  it("reserves a base set of rows for chrome", () => {
    expect(listViewportRows(base)).toBe(40 - 9);
  });

  // The stacked views panel in narrow layout costs 4 extra rows versus wide.
  it("reserves more rows in narrow layout", () => {
    expect(listViewportRows({ ...base, narrow: true })).toBe(40 - 9 - 4);
  });

  it("reserves rows for the filter box and active filter line", () => {
    expect(listViewportRows({ ...base, filtering: true, hasFilter: true })).toBe(40 - 9 - 3 - 1);
  });

  it("never drops below the 3-row floor on a tiny terminal", () => {
    expect(listViewportRows({ ...base, terminalRows: 5 })).toBe(3);
  });
});

describe("restoredSelection", () => {
  const keys = ["ENG-1", "ENG-2", "ENG-3"];

  // A view switch passes no previous key, so the cursor starts at the top.
  it("returns the top when there is no previous key", () => {
    expect(restoredSelection(keys, undefined)).toBe(0);
  });

  // A refresh re-anchors the cursor on the same issue even if its index moved.
  it("re-anchors on the previously selected key", () => {
    expect(restoredSelection(keys, "ENG-3")).toBe(2);
    expect(restoredSelection(["ENG-9", "ENG-3"], "ENG-3")).toBe(1);
  });

  // If the previously selected issue is gone after refresh, fall back to the top.
  it("falls back to the top when the key disappeared", () => {
    expect(restoredSelection(keys, "ENG-99")).toBe(0);
    expect(restoredSelection([], "ENG-1")).toBe(0);
  });
});
