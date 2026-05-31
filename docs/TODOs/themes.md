# Themeable colors with built-in presets

## Motivation

Colors are scattered as literals across the TUI (`color="cyan"` for selection /
active, `color="red"` for urgent/errors, `#ff8700` for high priority, `yellow`,
`green`, `gray`, plus `dimColor`/`inverse`). There is no way for a user to retheme
without editing source. `gh-dash` ships a `theme` config block and presets
(catppuccin, gruvbox, tokyonight) and gets recurring requests around it (#770
ANSI indices, #147 markdown theme, #844 fang theme).

A theme layer (a) removes magic color literals, (b) lets users match their
terminal, and (c) makes priority/state colors meaningful and consistent across
the CLI table and the TUI.

## Design

### Semantic tokens, not raw colors

Define a small palette of **roles**, and map roles → colors in a theme. Components
reference roles, never literals.

| Token | Used by (today) |
| :---- | :-------------- |
| `selection` | selected row (currently `cyan` + `inverse`) |
| `accent` | active view, keys, position (`cyan`) |
| `danger` | errors, urgent priority (`red`) |
| `warning` | loading, medium priority (`yellow`) |
| `success` | low priority (`green`) |
| `priority.urgent\|high\|medium\|low\|none` | priority column (`red`/`#ff8700`/`yellow`/`green`/`gray`) |
| `muted` | hints, dim text (`dimColor`) |

### Config surface

```yaml
theme:
  preset: catppuccin        # built-in preset, optional
  colors:                   # optional overrides on top of the preset
    accent: "#89b4fa"
    priority:
      urgent: "#f38ba8"
```

- `preset` selects a built-in palette; `colors` overrides individual tokens.
- Support hex (`#rrggbb`), named colors, and **ANSI 256 indices** (gh-dash #770)
  so it works on limited terminals.
- Ship presets: `catppuccin` (mocha), `gruvbox`, `tokyonight`, and a `default`
  that reproduces today's look (so existing users see no change).

### Plumbing

- A `Theme` type + `resolveTheme(config)` that merges `preset` ← `colors`.
- Provide it via React context (`ThemeProvider`) so components read
  `useTheme().priority.urgent` instead of literals. Avoid a global singleton
  (`AGENTS.md`: no global singletons; inject it).
- The CLI table (`src/utils/formatting.ts`) reads the same theme for priority
  colors so CLI and TUI agree.

## Implementation sketch

- `src/tui/theme/` — `tokens.ts` (token type), `presets.ts` (the palettes),
  `resolve.ts` (preset + overrides merge, validated by Zod).
- Extend `src/config/schema.ts` with a `theme` block.
- `ThemeProvider` + `useTheme()`; replace literals in `issue-list.tsx`,
  `view-selector.tsx`, `status-bar.tsx`, `dashboard.tsx`, `help-modal.tsx`.
- Map tokens for the CLI table renderer too.
- Mirror the `theme` block in `CONFIGURATION.md`.

## Acceptance checklist

- [ ] `Theme` tokens defined; no raw color literals left in TUI components.
- [ ] `theme.preset` + `theme.colors` parsed and validated by Zod.
- [ ] Presets shipped: `default` (no visual change), `catppuccin`, `gruvbox`,
      `tokyonight`.
- [ ] Hex, named, and ANSI-256 index colors all accepted.
- [ ] Theme injected via context (no global singleton); CLI table shares it.
- [ ] `CONFIGURATION.md` documents `theme` and lists tokens + presets.
- [ ] Tests: preset+override merge, invalid color rejected, token coverage.

## References

- gh-dash `configuration/theme.mdx` and preset files
  (`theme-catppuccin.yml`, `theme-gruvbox.yml`, `theme-tokyonight.yml`).
- gh-dash issues: #770 (ANSI color indices), #147 (markdown reader theme),
  #844 (fang theme).
