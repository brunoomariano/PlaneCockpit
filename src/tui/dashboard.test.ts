import { describe, it, expect } from "vitest";
import { isNarrowLayout, listViewportRows, NARROW_BREAKPOINT } from "./dashboard.js";

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
