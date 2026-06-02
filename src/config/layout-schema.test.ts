/**
 * Bloco 1 — Schema for the per-view `layout` block and `defaults.layout`.
 *
 * A view's `layout` is a map keyed by column id (`key`, `priority`, `state`,
 * `title`, `assign`); each entry sets `width`, `grow`, `align` and/or `hidden`.
 * The same shape is allowed at `defaults.layout`. Validation rejects unknown
 * column ids, bad alignments, non-positive widths, and more than one column
 * marked `grow: true`. Zero grow columns is fine (TITLE grows at resolution).
 */

import { describe, it, expect } from "vitest";
import { profileSchema } from "./schema.js";

const serverBlock = { base_url: "https://plane.example.com", workspace_slug: "acme" };

function profile(overrides: Record<string, unknown>): Record<string, unknown> {
  return { server: serverBlock, ...overrides };
}

describe("column layout schema", () => {
  it("should accept a per-view layout block", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [
          {
            name: "My open",
            layout: {
              priority: { align: "center", width: 10 },
              state: { hidden: true },
              title: { grow: true },
              assign: { width: 20 },
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should accept defaults.layout with the same shape", () => {
    const result = profileSchema.safeParse(
      profile({ defaults: { layout: { assign: { width: 18 }, title: { grow: true } } } }),
    );
    expect(result.success).toBe(true);
  });

  // The following assert rejection. A strict-object layout keyed by a column-id
  // enum already rejects these today (unknown key / bad enum / wrong type), and
  // must keep rejecting them after the change. Not xfail — the observable
  // outcome is invariant; the multi-grow case pins the error to the layout path.
  it("should reject an unknown column id", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", layout: { foo: { width: 5 } } }] }),
    );
    expect(result.success).toBe(false);
  });

  it("should reject an invalid align", () => {
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", layout: { priority: { align: "diagonal" } } }] }),
    );
    expect(result.success).toBe(false);
  });

  it("should reject a non-positive width", () => {
    const zero = profileSchema.safeParse(
      profile({ views: [{ name: "X", layout: { assign: { width: 0 } } }] }),
    );
    expect(zero.success).toBe(false);
    const negative = profileSchema.safeParse(
      profile({ views: [{ name: "X", layout: { assign: { width: -3 } } }] }),
    );
    expect(negative.success).toBe(false);
  });

  it("should reject more than one column with grow:true", () => {
    const result = profileSchema.safeParse(
      profile({
        views: [{ name: "X", layout: { title: { grow: true }, assign: { grow: true } } }],
      }),
    );
    expect(result.success).toBe(false);
    const onLayout = result.success
      ? []
      : result.error.issues.filter((i) => i.path.includes("layout"));
    expect(onLayout.length).toBeGreaterThan(0);
  });

  it("should accept a layout with no grow column", () => {
    // No column grows; TITLE grows by default at resolution time.
    const result = profileSchema.safeParse(
      profile({ views: [{ name: "X", layout: { assign: { width: 18 } } }] }),
    );
    expect(result.success).toBe(true);
  });
});
