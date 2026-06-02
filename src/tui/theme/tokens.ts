// Theme tokens: semantic color roles the UI references instead of raw color
// literals. A Theme maps every role to a concrete color string (hex, named, or
// an ANSI-256 index as a string). Components read tokens (theme.danger), never
// literals, so a preset or user override retheme the whole UI consistently.

import type { IssuePriority } from "../../types/issue.js";

// A color is any string Ink/chalk accepts: hex (#rrggbb), a named color (red),
// or an ANSI-256 index as a string ("203"). Validation lives in the schema.
export type ThemeColor = string;

export type PriorityColors = Record<IssuePriority, ThemeColor>;

// Theme is the fully-resolved palette: every token has a concrete color.
export interface Theme {
  // Selected row background/foreground anchor.
  selection: ThemeColor;
  // Active view, keys, position, focused borders.
  accent: ThemeColor;
  // Errors and the urgent end of the scale.
  danger: ThemeColor;
  // Loading and mid-scale emphasis.
  warning: ThemeColor;
  // The low/positive end of the scale.
  success: ThemeColor;
  // Hints and de-emphasised text that still needs a color.
  muted: ThemeColor;
  // Per-priority colors for the PRIORITY column (CLI and TUI).
  priority: PriorityColors;
}

// Names of the built-in presets. `default` reproduces today's look.
export type ThemePreset = "default" | "catppuccin" | "gruvbox" | "tokyonight";
