/**
 * Block 2 — Theme resolution (preset ← overrides) and config validation.
 *
 * resolveTheme merges a selected preset with per-token overrides: no config ⇒
 * default; `preset` selects a built-in palette; `colors` overrides individual
 * tokens on top, deep-merging priority.*. The schema accepts hex, named, and
 * ANSI-256-index colors and rejects bad colors / unknown presets.
 */

import { describe, it, expect } from "vitest";
import { resolveTheme } from "./resolve.js";
import { PRESETS } from "./presets.js";
import { profileSchema } from "../../config/schema.js";

const serverBlock = { base_url: "https://plane.example.com", workspace_slug: "acme" };
function profile(overrides: Record<string, unknown>): Record<string, unknown> {
  return { server: serverBlock, ...overrides };
}

describe("resolveTheme — preset + overrides", () => {
  it("should return the default theme when no theme is configured", () => {
    expect(resolveTheme(undefined)).toEqual(PRESETS.default);
  });

  it("should select the named built-in preset", () => {
    expect(resolveTheme({ preset: "gruvbox" })).toEqual(PRESETS.gruvbox);
  });

  it("should override individual tokens on top of the preset", () => {
    const theme = resolveTheme({ preset: "catppuccin", colors: { accent: "#abcdef" } });
    expect(theme.accent).toBe("#abcdef");
    // Other tokens stay from catppuccin.
    expect(theme.danger).toBe(PRESETS.catppuccin.danger);
  });

  it("should deep-merge a partial priority override", () => {
    const theme = resolveTheme({
      preset: "tokyonight",
      colors: { priority: { urgent: "#000000" } },
    });
    expect(theme.priority.urgent).toBe("#000000");
    // The other priority colors survive from the preset.
    expect(theme.priority.high).toBe(PRESETS.tokyonight.priority.high);
    expect(theme.priority.none).toBe(PRESETS.tokyonight.priority.none);
  });
});

describe("theme schema validation", () => {
  it("should accept hex, named and ANSI-256 colors", () => {
    const result = profileSchema.safeParse(
      profile({
        theme: {
          preset: "catppuccin",
          colors: { accent: "#f38ba8", danger: "red", success: "203" },
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("should reject an invalid color", () => {
    for (const bad of ["#zzz", "256", "notacolor"]) {
      const result = profileSchema.safeParse(profile({ theme: { colors: { accent: bad } } }));
      expect(result.success, bad).toBe(false);
    }
  });

  it("should reject an unknown preset", () => {
    const result = profileSchema.safeParse(profile({ theme: { preset: "solarized" } }));
    expect(result.success).toBe(false);
  });
});
