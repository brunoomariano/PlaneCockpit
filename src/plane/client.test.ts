import { describe, it, expect } from "vitest";
import { extractNextCursor, type PaginatedResponse } from "./client.js";

function page(extra: Partial<PaginatedResponse<unknown>>): PaginatedResponse<unknown> {
  return { results: [], ...extra };
}

describe("extractNextCursor", () => {
  it("returns null when no pagination metadata is present", () => {
    expect(extractNextCursor(page({}))).toBeNull();
  });

  it("prefers the explicit next_page_results=false signal", () => {
    expect(
      extractNextCursor(page({ next_cursor: "still-here", next_page_results: false })),
    ).toBeNull();
  });

  it("returns null when total_pages is 1 even if a cursor leaks through", () => {
    expect(extractNextCursor(page({ next_cursor: "leak", total_pages: 1 }))).toBeNull();
  });

  it("returns next_cursor when set", () => {
    expect(extractNextCursor(page({ next_cursor: "abc" }))).toBe("abc");
  });

  it("falls back to next when next_cursor is missing", () => {
    expect(extractNextCursor(page({ next: "abc" }))).toBe("abc");
  });
});
