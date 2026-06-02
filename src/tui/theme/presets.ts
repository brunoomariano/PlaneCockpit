// Built-in theme presets. `default` reproduces the colors hardcoded across the
// TUI today, so a profile without a `theme` block looks unchanged. The other
// three mirror gh-dash's shipped palettes (Catppuccin Mocha, Gruvbox dark,
// Tokyo Night), sourced from each project's official palette.

import type { Theme, ThemePreset } from "./tokens.js";

// Reproduces today's literals: cyan accent/selection, red/yellow/green scale,
// orange high priority, gray for none/muted.
const defaultTheme: Theme = {
  selection: "cyan",
  accent: "cyan",
  danger: "red",
  warning: "yellow",
  success: "green",
  muted: "gray",
  priority: {
    urgent: "red",
    high: "#ff8700",
    medium: "yellow",
    low: "green",
    none: "gray",
  },
};

// Catppuccin Mocha: blue accent, red/peach/yellow/green scale, overlay0 muted.
const catppuccin: Theme = {
  selection: "#89b4fa", // blue
  accent: "#89b4fa", // blue
  danger: "#f38ba8", // red
  warning: "#f9e2af", // yellow
  success: "#a6e3a1", // green
  muted: "#6c7086", // overlay0
  priority: {
    urgent: "#f38ba8", // red
    high: "#fab387", // peach
    medium: "#f9e2af", // yellow
    low: "#a6e3a1", // green
    none: "#6c7086", // overlay0
  },
};

// Gruvbox dark: aqua accent, bright red/orange/yellow/green scale, gray muted.
const gruvbox: Theme = {
  selection: "#83a598", // blue/aqua
  accent: "#83a598", // blue/aqua
  danger: "#fb4934", // bright red
  warning: "#fabd2f", // bright yellow
  success: "#b8bb26", // bright green
  muted: "#928374", // gray
  priority: {
    urgent: "#fb4934", // bright red
    high: "#fe8019", // bright orange
    medium: "#fabd2f", // bright yellow
    low: "#b8bb26", // bright green
    none: "#928374", // gray
  },
};

// Tokyo Night: blue accent, red/orange/yellow/green scale, comment-gray muted.
const tokyonight: Theme = {
  selection: "#7aa2f7", // blue
  accent: "#7aa2f7", // blue
  danger: "#f7768e", // red
  warning: "#e0af68", // yellow/orange
  success: "#9ece6a", // green
  muted: "#565f89", // comment
  priority: {
    urgent: "#f7768e", // red
    high: "#ff9e64", // orange
    medium: "#e0af68", // yellow
    low: "#9ece6a", // green
    none: "#565f89", // comment
  },
};

// PRESETS maps each preset name to its fully-resolved palette.
export const PRESETS: Record<ThemePreset, Theme> = {
  default: defaultTheme,
  catppuccin,
  gruvbox,
  tokyonight,
};
