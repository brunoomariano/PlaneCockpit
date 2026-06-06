import { describe, it, expect } from "vitest";
import {
  isNarrowLayout,
  listViewportRows,
  restoredSelection,
  autoRefreshIntervalMs,
  NARROW_BREAKPOINT,
  DEFAULT_AUTO_REFRESH_SECONDS,
} from "./dashboard.js";
import { patchTouchesViewFilter } from "./view-filter-reconcile.js";

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

describe("autoRefreshIntervalMs", () => {
  // An omitted interval falls back to the 15s default, converted to ms.
  it("defaults to DEFAULT_AUTO_REFRESH_SECONDS when undefined", () => {
    expect(autoRefreshIntervalMs(undefined)).toBe(DEFAULT_AUTO_REFRESH_SECONDS * 1000);
    expect(DEFAULT_AUTO_REFRESH_SECONDS).toBe(15);
  });

  // A positive interval is converted from seconds to milliseconds.
  it("converts a positive interval from seconds to milliseconds", () => {
    expect(autoRefreshIntervalMs(30)).toBe(30_000);
    expect(autoRefreshIntervalMs(1)).toBe(1_000);
  });

  // 0 disables auto-refresh (no timer), distinct from omitting the value.
  it("returns undefined when set to 0 to disable auto-refresh", () => {
    expect(autoRefreshIntervalMs(0)).toBeUndefined();
  });
});

describe("patchTouchesViewFilter", () => {
  // A patch that changes a field the view filters on may move the issue in/out
  // of the view, so the dashboard must reconcile by refreshing rather than
  // patching the row in place.
  it("is true when the patched state changes and the view filters by state_group", () => {
    expect(patchTouchesViewFilter({ state_id: "s-done" }, { state_group: ["completed"] })).toBe(
      true,
    );
  });

  it("is true when labels change and the view filters by labels", () => {
    expect(patchTouchesViewFilter({ label_ids: ["l-1"] }, { labels: ["l-1"] })).toBe(true);
  });

  it("is true when assignees change and the view filters by assignee", () => {
    expect(patchTouchesViewFilter({ assignee_ids: ["u-1"] }, { assignee: "me" })).toBe(true);
  });

  // A field the view does not filter on stays a safe in-place patch.
  it("is false when the patched field is not a filter of the view", () => {
    expect(patchTouchesViewFilter({ priority: "high" }, { state_group: ["started"] })).toBe(false);
  });

  it("is false when the view has no filters", () => {
    expect(patchTouchesViewFilter({ state_id: "s-done" }, undefined)).toBe(false);
  });
});
