import { describe, it, expect } from "vitest";
import { PlaneApiClient, extractNextCursor, type PaginatedResponse } from "./client.js";

function page(extra: Partial<PaginatedResponse<unknown>>): PaginatedResponse<unknown> {
  return { results: [], ...extra };
}

function client(): PlaneApiClient {
  return new PlaneApiClient({
    server: { base_url: "https://plane.example.com", workspace_slug: "acme" },
    apiKey: "k",
  });
}

describe("workspacePath", () => {
  it("builds a workspace-scoped path from segments", () => {
    expect(client().workspacePath("projects", "p1", "issues")).toBe(
      "/workspaces/acme/projects/p1/issues",
    );
  });

  it("encodes segments so they cannot alter the URL structure", () => {
    // A segment trying to traverse or inject query/fragment is neutralized.
    expect(client().workspacePath("projects", "../../admin")).toBe(
      "/workspaces/acme/projects/..%2F..%2Fadmin",
    );
    expect(client().workspacePath("issues", "x?y#z")).toBe("/workspaces/acme/issues/x%3Fy%23z");
  });
});

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
