/**
 * Schema for the state_search / project_state_search view filters and the
 * limit -> query_limit rename.
 *
 * `state_search` is a global list of state names; `project_state_search` is a
 * per-project list of `{ name, state_search }`. Both refine client-side and are
 * allowed on multi-project views (unlike cycle/module). The view's old `limit`
 * field is renamed to `query_limit`.
 */

import { describe, it, expect } from "vitest";
import { profileSchema } from "./schema.js";

const serverBlock = { base_url: "https://plane.example.com", workspace_slug: "acme" };

function profile(overrides: Record<string, unknown>): Record<string, unknown> {
  return { server: serverBlock, ...overrides };
}

describe("state_search / project_state_search schema", () => {
  it("should accept a view with a global state_search list", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [{ name: "Review", filters: { state_search: ["In Review", "Blocked"] } }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should accept a view with project_state_search", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [
          {
            name: "Per project",
            projects: ["ENG", "OPS"],
            filters: {
              project_state_search: [{ name: "ENG", state_search: ["In Review"] }],
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should reject a state_search that is not a list of strings", () => {
    // Must fail because of the state_search field type, not because it is an
    // unknown field in the strictObject.
    const rawString = profileSchema.safeParse(
      profile({ views: [{ name: "X", filters: { state_search: "In Review" } }] }),
    );
    expect(rawString.success).toBe(false);
    const onString = rawString.success
      ? []
      : rawString.error.issues.filter((i) => i.path.includes("state_search"));
    expect(onString.length).toBeGreaterThan(0);

    const numbers = profileSchema.safeParse(
      profile({ views: [{ name: "X", filters: { state_search: [1, 2] } }] }),
    );
    expect(numbers.success).toBe(false);
    const onNumbers = numbers.success
      ? []
      : numbers.error.issues.filter((i) => i.path.includes("state_search"));
    expect(onNumbers.length).toBeGreaterThan(0);
  });

  it("should accept both state_search and project_state_search together", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [
          {
            name: "Both",
            projects: ["ENG", "OPS"],
            filters: {
              state_search: ["Done"],
              project_state_search: [{ name: "ENG", state_search: ["In Review"] }],
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should allow state_search on a multi-project view (unlike cycle/module)", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [
          { name: "Multi", projects: ["ENG", "OPS"], filters: { state_search: ["In Review"] } },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("limit -> query_limit rename", () => {
  it("should accept a view with query_limit", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "Capped", projects: ["ENG"], query_limit: 50 }] }),
    );
    expect(result.success).toBe(true);
  });

  it("should reject a view using the old limit field", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "Old", projects: ["ENG"], limit: 50 }] }),
    );
    expect(result.success).toBe(false);
  });
});
