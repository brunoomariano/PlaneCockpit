/**
 * Block 3 — Theme injection via React context.
 *
 * ThemeProvider provides a resolved Theme; useTheme() reads it. There is no
 * global singleton (AGENTS.md: inject dependencies) — a component outside any
 * provider must fail loudly rather than silently read undefined.
 */

import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, it, expect } from "vitest";
import { ThemeProvider, useTheme, themeFromContext } from "./context.js";
import { PRESETS } from "./presets.js";

// Probe component that renders the accent token so the test can read it back.
function AccentProbe(): React.ReactElement {
  const theme = useTheme();
  return React.createElement(Text, null, theme.accent);
}

describe("theme context", () => {
  it("should expose the provided theme through useTheme", () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, {
        theme: PRESETS.gruvbox,
        children: React.createElement(AccentProbe),
      }),
    );
    expect(lastFrame()).toContain(PRESETS.gruvbox.accent);
  });

  it("should throw a clear error when the theme is read outside a provider", () => {
    // The provider-required guard (what useTheme runs on a null context) must
    // fail loudly rather than yield undefined. Tested on the extracted guard so
    // it is deterministic without depending on the renderer's error handling.
    expect(() => themeFromContext(null)).toThrow(/ThemeProvider/i);
  });
});
