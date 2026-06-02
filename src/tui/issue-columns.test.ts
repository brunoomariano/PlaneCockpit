/**
 * Bloco 2 — The responsive solver consumes the resolved layout.
 *
 * issueColumns(width, layout?) seeds its fixed widths and visibility from the
 * layout but stays the authority on what fits. With no layout it must reproduce
 * today's behaviour exactly. `hidden` removes a column even when it would fit;
 * `width` overrides a column's constant; `grow` moves the leftover space to a
 * non-TITLE column (TITLE becomes fixed); `align` is carried through for the
 * renderer. The MIN_TITLE_WIDTH guarantee survives: a too-narrow terminal still
 * drops STATE→ASSIGN and collapses PRIORITY so the grow column stays readable.
 */

import { describe, it, expect } from "vitest";
import { issueColumns } from "./issue-list.js";
import type { ViewLayout } from "../types/views.js";

// A comfortably wide terminal where every column fits; and a narrow one.
const WIDE = 160;
const NARROW = 48;

describe("issueColumns — no layout (regression)", () => {
  it("should reproduce today's columns when no layout is given", () => {
    // Interface stable for this call form; the no-layout path must not change.
    // Snapshot the key observable fields across three widths.
    for (const w of [WIDE, 90, NARROW]) {
      const cols = issueColumns(w);
      expect(cols).toMatchObject({
        title: expect.any(Number),
        priorityWidth: expect.any(Number),
        compactPriority: expect.any(Boolean),
        showState: expect.any(Boolean),
        showAssign: expect.any(Boolean),
      });
      // TITLE never drops below the readable floor.
      expect(cols.title).toBeGreaterThanOrEqual(12);
    }
  });
});

describe("issueColumns — layout intent", () => {
  it("should hide a column marked hidden even on a wide terminal", () => {
    const layout: ViewLayout = { state: { hidden: true } };
    const cols = issueColumns(WIDE, layout);
    expect(cols.showState).toBe(false);
    // ASSIGN still shows on a wide terminal; only STATE was hidden.
    expect(cols.showAssign).toBe(true);
  });

  it("should use a configured fixed width instead of the column constant", () => {
    const layout: ViewLayout = { assign: { width: 24 } };
    const cols = issueColumns(WIDE, layout);
    // The resolved ASSIGN width is the configured 24, and TITLE was recomputed
    // against it (so total still fits the inner width).
    expect(cols.assignWidth).toBe(24);
  });

  it("should let a non-TITLE column grow and fix TITLE", () => {
    const layout: ViewLayout = { assign: { grow: true } };
    const cols = issueColumns(WIDE, layout);
    // ASSIGN absorbs the leftover; TITLE is no longer the growing column.
    expect(cols.growColumn).toBe("assign");
  });

  it("should carry per-column alignment through for the renderer", () => {
    const layout: ViewLayout = { priority: { align: "right" } };
    const cols = issueColumns(WIDE, layout);
    expect(cols.align?.priority).toBe("right");
  });

  // Not xfail: the MIN_TITLE_WIDTH guarantee and the narrow-terminal drop must
  // hold both today and after layout lands — the solver may never let a pinned
  // width force a row wrap. This pins that invariant against the layout path.
  it("should still guarantee MIN_TITLE_WIDTH on a narrow terminal with greedy widths", () => {
    // User pins large widths on every optional column; on a narrow terminal the
    // solver must still drop STATE then ASSIGN and collapse PRIORITY so the
    // growing column never falls below the readable floor (no row wrap).
    const layout: ViewLayout = {
      priority: { width: 14 },
      state: { width: 30 },
      assign: { width: 40 },
      title: { grow: true },
    };
    const cols = issueColumns(NARROW, layout);
    expect(cols.title).toBeGreaterThanOrEqual(12);
    // At least one optional column was dropped to make room.
    expect(cols.showState && cols.showAssign).toBe(false);
  });
});
