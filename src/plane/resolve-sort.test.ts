/**
 * Bloco 3 — Resolving the effective sort for a view.
 *
 * The precedence is `view.sort ?? defaults.sort ?? DEFAULT_SORT`. A view's own
 * sort wins; otherwise it inherits the profile's `defaults.sort`; if neither is
 * set, the built-in DEFAULT_SORT (`project asc, priority desc, state asc,
 * updated_at desc`) applies. A view's sort REPLACES the default wholesale — keys
 * are never merged.
 */

import { describe, it, expect } from "vitest";
import { resolveSort, DEFAULT_SORT } from "./sort-issues.js";
import type { SortKey } from "../types/views.js";

describe("resolveSort — precedence", () => {
  it("should use the view's own sort when present", () => {
    const viewSort: SortKey[] = [{ field: "priority", direction: "desc" }];
    const defaultsSort: SortKey[] = [{ field: "project", direction: "asc" }];
    // The view declares its own sort, so defaults are ignored entirely.
    expect(resolveSort(viewSort, defaultsSort)).toEqual(viewSort);
  });

  it("should fall back to defaults.sort when the view declares none", () => {
    const defaultsSort: SortKey[] = [
      { field: "project", direction: "asc" },
      { field: "priority", direction: "desc" },
    ];
    expect(resolveSort(undefined, defaultsSort)).toEqual(defaultsSort);
  });

  it("should replace defaults wholesale, never merge keys", () => {
    const viewSort: SortKey[] = [{ field: "priority", direction: "desc" }];
    const defaultsSort: SortKey[] = [
      { field: "project", direction: "asc" },
      { field: "state", direction: "asc" },
    ];
    // The result is exactly the view's single key — no defaults key is appended.
    expect(resolveSort(viewSort, defaultsSort)).toEqual(viewSort);
  });

  it("should fall back to the built-in DEFAULT_SORT when neither is set", () => {
    expect(resolveSort(undefined, undefined)).toBe(DEFAULT_SORT);
    // The documented four-key default order.
    expect(DEFAULT_SORT).toEqual([
      { field: "project", direction: "asc" },
      { field: "priority", direction: "desc" },
      { field: "state", direction: "asc" },
      { field: "updated_at", direction: "desc" },
    ]);
  });
});
