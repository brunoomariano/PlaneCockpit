// resolveTheme builds the effective Theme from a profile's optional `theme`
// block: start from the selected preset (default when absent), then apply
// per-token overrides on top, deep-merging the priority.* map so a partial
// priority override does not erase the preset's other priority colors.

import type { Theme } from "./tokens.js";
import type { ThemeConfigInput } from "../../types/config.js";
import { PRESETS } from "./presets.js";

// resolveTheme merges the validated `theme` config (ThemeConfigInput) onto the
// selected preset.
export function resolveTheme(config: ThemeConfigInput | undefined): Theme {
  const base = PRESETS[config?.preset ?? "default"];
  const overrides = config?.colors;
  if (!overrides) return base;
  return {
    selection: overrides.selection ?? base.selection,
    accent: overrides.accent ?? base.accent,
    danger: overrides.danger ?? base.danger,
    warning: overrides.warning ?? base.warning,
    success: overrides.success ?? base.success,
    muted: overrides.muted ?? base.muted,
    priority: { ...base.priority, ...overrides.priority },
  };
}
