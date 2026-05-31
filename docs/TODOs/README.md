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

| TODO | Summary |
| :--- | :--- |
| [declarative-column-layout.md](declarative-column-layout.md) | Make the issue-list columns (`width` / `grow` / `align` / `hidden`) configurable per view instead of hardcoded. |
| [action-edit.md](action-edit.md) | TUI/CLI action to edit an issue's **state**, **assignee** and **priority**. |
| [action-comment.md](action-comment.md) | TUI/CLI action to **comment** on an issue. |
| [action-create-from-file.md](action-create-from-file.md) | Create an issue with the **body read from a file** (or stdin), for agent/MCP-driven flows. |
| [json-schema-from-zod.md](json-schema-from-zod.md) | Publish a JSON Schema generated from the Zod config schema, with editor-autocomplete docs. |
| [themes.md](themes.md) | Themeable colors with built-in presets (catppuccin, gruvbox, tokyonight, …). |

## Explicitly out of scope (for now)

- **Custom keybindings that shell out to commands** — not planned.
- **Repo-local config discovery** (`.plane-cli.yaml` in the repo root) — not planned.
