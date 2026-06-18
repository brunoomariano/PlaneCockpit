/**
 * Bloco 1 — Schema for the multi-level `sort` field and `defaults.sort`.
 *
 * `sort` turns from a single enum value into an ordered list of single-key maps
 * `{ <field>: "asc" | "desc" }`. The list reads top-to-bottom: the first key is
 * the primary sort, each following key breaks ties of the ones above. The legacy
 * scalar form (`sort: priority`) still parses, normalised to the list form so
 * pre-existing configs keep working. A profile-level `defaults.sort` carries the
 * same list shape. `name` is dropped as a sortable field.
 */

import { describe, it, expect } from "vitest";
import { profileSchema } from "./schema.js";

const serverBlock = { base_url: "https://plane.example.com", workspace_slug: "acme" };

function profile(overrides: Record<string, unknown>): Record<string, unknown> {
  return { server: serverBlock, ...overrides };
}

describe("multi-level sort schema", () => {
  it("should accept a view whose sort is an ordered list of single-key maps", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [
          {
            name: "Triage",
            sort: [
              { project: "asc" },
              { priority: "desc" },
              { state: "asc" },
              { updated_at: "desc" },
            ],
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  // Not an xfail: `sort: "priority"` is already valid today (the legacy enum)
  // and must STAY valid after the change (via the normalising union). This guards
  // against a regression that would break pre-existing configs.
  it("should still accept the legacy scalar sort form", () => {
    const result = profileSchema.safeParse(profile({ views: [{ name: "Old", sort: "priority" }] }));
    expect(result.success).toBe(true);
  });

  it("should accept defaults.sort with the list shape", () => {
    const result = profileSchema.safeParse(
      profile({
        defaults: {
          projects: ["ENG", "OPS"],
          sort: [{ project: "asc" }, { priority: "desc" }],
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  // These three assert rejection. The result (success === false) holds both
  // today (the legacy enum rejects any list/object) and after the change (the
  // new rules reject them). Not xfail — the observable outcome is invariant. The
  // `name` case additionally pins the error to the `sort` path so it stays
  // meaningful once the list form is accepted in general.
  it("should reject `name` as a sort key", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", sort: [{ name: "asc" }] }] }),
    );
    expect(result.success).toBe(false);
    const onSort = result.success ? [] : result.error.issues.filter((i) => i.path.includes("sort"));
    expect(onSort.length).toBeGreaterThan(0);
  });

  it("should reject a sort item carrying more than one key", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", sort: [{ priority: "desc", state: "asc" }] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("should reject an invalid direction", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", sort: [{ priority: "sideways" }] }] }),
    );
    expect(result.success).toBe(false);
  });
});

describe("defaults.state_order schema", () => {
  it("should accept a list of state slugs", () => {
    const result = profileSchema.safeParse(
      profile({ defaults: { state_order: ["backlog", "in progress", "in review"] } }),
    );
    expect(result.success).toBe(true);
  });

  it("should reject an empty-string slug", () => {
    const result = profileSchema.safeParse(profile({ defaults: { state_order: ["backlog", ""] } }));
    expect(result.success).toBe(false);
  });

  // An empty list is valid: it means "no override", same as omitting the field.
  it("should accept an empty list", () => {
    const result = profileSchema.safeParse(profile({ defaults: { state_order: [] } }));
    expect(result.success).toBe(true);
  });

  it("should reject a non-array state_order", () => {
    const result = profileSchema.safeParse(profile({ defaults: { state_order: "backlog" } }));
    expect(result.success).toBe(false);
  });
});
