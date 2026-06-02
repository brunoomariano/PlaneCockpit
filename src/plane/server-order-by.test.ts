/**
 * Bloco 4 — Per-project `order_by` server hint.
 *
 * Plane's list endpoint `order_by` takes a single field. With a multi-key sort,
 * we send the FIRST key's field as a best-effort hint and let the client-side
 * chained comparator be authoritative for the merged set. Fields with no server
 * equivalent (`project`, `state`, `assign`) yield no `order_by` at all — the
 * param is dropped so we don't ask Plane to order by something it can't.
 */

import { describe, it, expect } from "vitest";
import { serverOrderBy } from "./sort-issues.js";
import type { SortKey } from "../types/views.js";

describe("serverOrderBy", () => {
  it("should send the first key's field when it has a server equivalent", () => {
    const sort: SortKey[] = [
      { field: "priority", direction: "desc" },
      { field: "updated_at", direction: "desc" },
    ];
    expect(serverOrderBy(sort)).toBe("priority");
  });

  it("should map created_at and updated_at as server-orderable fields", () => {
    expect(serverOrderBy([{ field: "created_at", direction: "desc" }])).toBe("created_at");
    expect(serverOrderBy([{ field: "updated_at", direction: "asc" }])).toBe("updated_at");
  });

  it("should drop order_by when the first key has no server equivalent", () => {
    // project/state/assign have no server equivalent; we must not fall through
    // to a later key — the hint is simply omitted.
    expect(
      serverOrderBy([
        { field: "project", direction: "asc" },
        { field: "priority", direction: "desc" },
      ]),
    ).toBeUndefined();
    expect(serverOrderBy([{ field: "state", direction: "asc" }])).toBeUndefined();
    expect(serverOrderBy([{ field: "assign", direction: "asc" }])).toBeUndefined();
  });

  it("should return undefined for an empty or absent sort", () => {
    expect(serverOrderBy(undefined)).toBeUndefined();
    expect(serverOrderBy([])).toBeUndefined();
  });
});
