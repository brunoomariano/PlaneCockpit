/**
 * Bloco 3 — Resolving the effective layout for a view.
 *
 * Precedence mirrors the sort: `view.layout ?? defaults.layout ?? {}`. A view's
 * own layout wins; otherwise it inherits the profile's `defaults.layout`; with
 * neither, the result is empty and the solver falls back to its built-in
 * responsive constants. A view's layout REPLACES the default wholesale — columns
 * are never merged.
 */

import { describe, it, expect } from "vitest";
import { resolveLayout } from "./issue-list.js";
import type { ViewLayout } from "../types/views.js";

describe("resolveLayout — precedence", () => {
  it("should use the view's own layout when present", () => {
    const viewLayout: ViewLayout = { assign: { width: 24 } };
    const defaultsLayout: ViewLayout = { state: { hidden: true } };
    expect(resolveLayout(viewLayout, defaultsLayout)).toEqual(viewLayout);
  });

  it("should fall back to defaults.layout when the view declares none", () => {
    const defaultsLayout: ViewLayout = { title: { grow: true }, assign: { width: 18 } };
    expect(resolveLayout(undefined, defaultsLayout)).toEqual(defaultsLayout);
  });

  it("should replace defaults wholesale, never merge columns", () => {
    const viewLayout: ViewLayout = { assign: { width: 24 } };
    const defaultsLayout: ViewLayout = { state: { hidden: true }, title: { grow: true } };
    const resolved = resolveLayout(viewLayout, defaultsLayout);
    // Only the view's column survives — no state/title leaks in from defaults.
    expect(resolved).toEqual({ assign: { width: 24 } });
    expect(resolved.state).toBeUndefined();
    expect(resolved.title).toBeUndefined();
  });

  it("should yield an empty layout when neither is set", () => {
    expect(resolveLayout(undefined, undefined)).toEqual({});
  });
});
