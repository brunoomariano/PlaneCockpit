/**
 * Schema and config validation for multi-project views.
 *
 * These cases cover the change from the `project` field (single string) to
 * `projects` (always a list of strings) in both `defaults` and each view, plus
 * the rule that `cycle`/`module` — which identify a specific project — cannot be
 * used when the view resolves to more than one project.
 */

import { describe, it, expect } from "vitest";
import { profileSchema, planeConfigSchema } from "./schema.js";

const serverBlock = {
  base_url: "https://plane.example.com",
  workspace_slug: "acme",
};

function profile(overrides: Record<string, unknown>): Record<string, unknown> {
  return { server: serverBlock, ...overrides };
}

describe("projects schema (plural, list of strings)", () => {
  it("should accept a view with a single-item projects list", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "Eng", projects: ["ENG"] }] }),
    );
    expect(result.success).toBe(true);
  });

  it("should accept a view with a multi-item projects list", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "Cross", projects: ["ENG", "OPS"] }] }),
    );
    expect(result.success).toBe(true);
  });

  it("should accept a view without projects (inherits the profile universe)", () => {
    const result = profileSchema.safeParse(
      profile({
        defaults: { projects: ["ENG", "OPS"] },
        views: [{ name: "All", filters: { priority: ["urgent"] } }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should reject a view whose projects is a bare string", () => {
    const result = profileSchema.safeParse(profile({ views: [{ name: "Eng", projects: "ENG" }] }));
    // Must fail because of the projects field TYPE (expected array), not
    // because of an unknown field in the strictObject.
    expect(result.success).toBe(false);
    const onProjects = result.success
      ? []
      : result.error.issues.filter((i) => i.path.includes("projects"));
    expect(onProjects.length).toBeGreaterThan(0);
  });

  it("should reject a projects list with non-string items", () => {
    const result = profileSchema.safeParse(profile({ views: [{ name: "Eng", projects: [1, 2] }] }));
    expect(result.success).toBe(false);
    const onProjects = result.success
      ? []
      : result.error.issues.filter((i) => i.path.includes("projects"));
    expect(onProjects.length).toBeGreaterThan(0);
  });

  it("should accept defaults.projects as a list and reject it as a bare string", () => {
    const asList = profileSchema.safeParse(
      profile({ defaults: { projects: ["ENG", "OPS"] }, views: [] }),
    );
    expect(asList.success).toBe(true);

    const asString = profileSchema.safeParse(profile({ defaults: { projects: "ENG" }, views: [] }));
    expect(asString.success).toBe(false);
  });
});

describe("cycle/module forbidden on multi-project views", () => {
  it("should reject a multi-project view that uses filters.cycle", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [{ name: "Cross", projects: ["ENG", "OPS"], filters: { cycle: "current" } }],
      }),
    );
    // Must fail because of the multi-project cycle rule, not an extra field:
    // the error must point at the cycle filter.
    expect(result.success).toBe(false);
    const onCycle = result.success
      ? []
      : result.error.issues.filter((i) => i.path.includes("cycle"));
    expect(onCycle.length).toBeGreaterThan(0);
  });

  it("should reject a multi-project view that uses filters.module", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [{ name: "Cross", projects: ["ENG", "OPS"], filters: { module: "auth" } }],
      }),
    );
    expect(result.success).toBe(false);
    const onModule = result.success
      ? []
      : result.error.issues.filter((i) => i.path.includes("module"));
    expect(onModule.length).toBeGreaterThan(0);
  });

  it("should still accept a single-project view that uses cycle/module", () => {
    const result = planeConfigSchema.safeParse({
      active_profile: "p",
      profiles: {
        p: profile({
          views: [{ name: "Sprint", projects: ["ENG"], filters: { cycle: "current" } }],
        }),
      },
    });
    expect(result.success).toBe(true);
  });
});
