// Theme injection for the TUI. ThemeProvider supplies a resolved Theme; useTheme
// reads it. No global singleton (AGENTS.md): the theme is injected through the
// provider and useTheme throws when used outside one, so a missing provider
// fails loudly instead of silently yielding undefined.

import React from "react";
import type { Theme } from "./tokens.js";

// Exported so class components (which cannot use the useTheme hook) can read the
// theme via a Context.Consumer.
export const ThemeContext = React.createContext<Theme | null>(null);

interface ThemeProviderProps {
  theme: Theme;
  children: React.ReactNode;
}

// ThemeProvider makes `theme` available to every descendant via useTheme.
export function ThemeProvider({ theme, children }: ThemeProviderProps): React.ReactElement {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// themeFromContext enforces the "provider required" invariant: a null context
// value (no ThemeProvider above) is a programming error and throws loudly.
// Extracted from the hook so the guard is unit-testable without a renderer.
export function themeFromContext(value: Theme | null): Theme {
  if (value === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}

// useTheme returns the theme from the nearest ThemeProvider. Throws when no
// provider is present so the missing injection surfaces immediately.
export function useTheme(): Theme {
  return themeFromContext(React.useContext(ThemeContext));
}
