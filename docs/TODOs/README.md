# TODOs

Planned improvements for Plane Cockpit, distilled from analysing
[`dlvhdr/gh-dash`](https://github.com/dlvhdr/gh-dash) (the GitHub-CLI TUI this
project is modelled after) — its merged PRs, closed issues, feature backlog and
config surface.

Each file is one self-contained work item: motivation, design, and a checklist.
They are proposals, not committed scope. Keep them in sync with
[`docs/CONFIGURATION.md`](../CONFIGURATION.md) and `src/config/schema.ts` when an
item lands.

## Index

| TODO                                                         | Summary                                                                                                         |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| [declarative-column-layout.md](declarative-column-layout.md) | Make the issue-list columns (`width` / `grow` / `align` / `hidden`) configurable per view instead of hardcoded. |
| [action-edit.md](action-edit.md)                             | TUI/CLI action to edit an issue's **state**, **assignee** and **priority**.                                     |
| [themes.md](themes.md)                                       | Themeable colors with built-in presets (catppuccin, gruvbox, tokyonight, …).                                    |

## Done

These shipped; their planning docs were removed once implemented.

- **Multi-level sort** — `sort` is an ordered list of `{ field: direction }` keys
  (`project`, `priority`, `state`, `created_at`, `updated_at`, `assign`), with a
  profile-wide `defaults.sort` and a built-in fallback (`project asc`,
  `priority desc`, `state asc`, `updated_at desc`). The legacy scalar form still
  parses. See `src/plane/sort-issues.ts` (chained comparator + `resolveSort` +
  `serverOrderBy`), `src/config/schema.ts`, and
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md#multi-level-sort).
- **Create from file/stdin** — `plc issue create` runs headless with `--body-file`
  (and `-` for stdin) and `--priority`. See `src/commands/issue/index.ts`.
- **Comment on an issue** — a multiline editor in the TUI (`c`) and `--body-file`
  on `plc issue comment`. See `src/tui/comment-editor.tsx` and
  `src/commands/issue/index.ts`.
- **JSON Schema from Zod** — `schema/config.schema.json` generated from the config
  schema with a CI drift gate; editor autocomplete documented in
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md#editor-autocomplete-json-schema).

## Explicitly out of scope (for now)

- **Custom keybindings that shell out to commands** — not planned.
- **Repo-local config discovery** (`.plane-cli.yaml` in the repo root) — not planned.
