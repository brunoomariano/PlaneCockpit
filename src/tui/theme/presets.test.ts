/**
 * Block 1 — Built-in theme presets.
 *
 * Four presets ship: `default` (reproduces today's look so unconfigured users
 * see no change), `catppuccin` (mocha), `gruvbox` (dark), `tokyonight`. Each
 * preset must define every token (no holes) and have a distinct identity.
 */

import { describe, it, expect } from "vitest";
import { PRESETS } from "./presets.js";
import type { Theme, ThemePreset } from "./tokens.js";

const PRESET_NAMES: ThemePreset[] = ["default", "catppuccin", "gruvbox", "tokyonight"];
const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

function assertFullTheme(theme: Theme): void {
  for (const token of ["selection", "accent", "danger", "warning", "success", "muted"] as const) {
    expect(theme[token], token).toBeTruthy();
  }
  for (const p of PRIORITIES) expect(theme.priority[p], `priority.${p}`).toBeTruthy();
}

describe("theme presets", () => {
  it("should reproduce today's literals in the default preset", () => {
    const d = PRESETS.default;
    // The colors hardcoded across the TUI today.
    expect(d.accent).toBe("cyan");
    expect(d.selection).toBe("cyan");
    expect(d.danger).toBe("red");
    expect(d.warning).toBe("yellow");
    expect(d.success).toBe("green");
    expect(d.priority.urgent).toBe("red");
    expect(d.priority.high).toBe("#ff8700");
    expect(d.priority.medium).toBe("yellow");
    expect(d.priority.low).toBe("green");
    expect(d.priority.none).toBe("gray");
    expect(d.muted).toBe("gray");
  });

  it("should define every token in all four presets", () => {
    for (const name of PRESET_NAMES) {
      expect(PRESETS[name], name).toBeDefined();
      assertFullTheme(PRESETS[name]);
    }
  });

  it("should give each preset a distinct identity", () => {
    expect(PRESETS.catppuccin.accent).toBe("#89b4fa");
    expect(PRESETS.tokyonight.priority.urgent).toBe("#f7768e");
    expect(PRESETS.gruvbox.accent).toBe("#83a598");
    // Presets are not copies of one another.
    expect(PRESETS.catppuccin.accent).not.toBe(PRESETS.tokyonight.accent);
    expect(PRESETS.gruvbox.accent).not.toBe(PRESETS.default.accent);
  });
});
