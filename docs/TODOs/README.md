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

In-dashboard editing (build on the shipped edit modal):

| TODO                                       | Summary                                                                         |
| :----------------------------------------- | :------------------------------------------------------------------------------ |
| [edit-issue-full.md](edit-issue-full.md)   | Add **title**, **description** and **labels** to the edit modal.                |
| [label-picker.md](label-picker.md)         | A per-project `LabelsService` + multi-select label picker (unblocks the above). |
| [create-issue-tui.md](create-issue-tui.md) | Create an issue from the TUI, reusing the edit form and pickers.                |

## Done

These shipped; their planning docs were removed once implemented.

- **Per-project failure isolation (degraded views)** — `IssuesService.listResilient`
  fetches each project independently (`Promise.allSettled`), merging the reachable
  ones and reporting the identifiers that failed, so a single slow/timing-out
  project no longer empties a multi-project view. The TUI shows a
  `partial: N project(s) unavailable` note (distinct from a clean empty view);
  `list` (CLI) still fails loudly. `timeout_ms` tuning for slow hosts is
  documented in [`docs/CONFIGURATION.md`](../CONFIGURATION.md#server-required).
  See `src/plane/issues.ts` and `src/tui/use-views-data.ts`.
- **In-place row patch on edit** — a successful edit updates the row from the
  `issues.update()` result via `useViewsData.patchIssue` instead of refetching
  the whole view, so selection/scroll are preserved with no refetch flicker. A
  `state` change (which can move the issue out of the view's filter) still falls
  back to a refresh to reconcile; priority/assignee edits stay a pure in-place
  patch. See `src/tui/use-views-data.ts` and `src/tui/dashboard.tsx`.
- **Robust `me` / assignee resolution** — `UsersService.me()` now runs `/users/me`
  through the same `normalizeMember` used by `list()`, accepting the nested and
  flattened payload shapes and failing loudly (with workspace context) when no
  usable id is present, instead of returning a half-populated user that would
  PATCH nothing. `resolveAssignee("me")` inherits this through `me()`. See
  `src/plane/users.ts`.
- **Edit action** — `e` opens an edit modal over the selected issue (list and
  detail) with three editable fields: **state**, **assignee** (multi-select) and
  **priority**. Arrows move focus; `enter` opens a per-field `SelectModal`;
  `ctrl+s` saves every change in one `issues.update()` PATCH; `esc` confirms
  before discarding a dirty draft. Backed by a new `StatesService` (per-project
  cached states), a reusable `SelectModal`, and `useIssueEditor`. Auto-refresh
  pauses while editing and the row refreshes in place on save. See
  `src/tui/use-issue-editor.ts`, `src/tui/select-modal.tsx`,
  `src/plane/states.ts`, and the plan in [action-edit.md](action-edit.md).
- **Themeable colors** — semantic tokens (`selection`, `accent`, `danger`,
  `warning`, `success`, `muted`, `priority.*`) replace the color literals across
  the TUI, driven by a `theme` block: a built-in `preset` (`default`,
  `catppuccin`, `gruvbox`, `tokyonight`) plus per-token `colors` overrides
  (hex, named, or ANSI-256). Injected via `ThemeProvider`/`useTheme` (no global
  singleton); the CLI `issue list` table shares the same theme for priority
  colors. See `src/tui/theme/`, `src/config/schema.ts`, and
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md#theme).
- **Declarative column layout** — a per-view `layout` block (and `defaults.layout`)
  sets `width` / `grow` / `align` / `hidden` per column (`key`, `priority`,
  `state`, `title`, `assign`) for the TUI list. The responsive solver stays the
  authority: it still drops STATE→ASSIGN and collapses PRIORITY to keep the grow
  column at a readable minimum, so a pinned width never forces a wrap. At most one
  column may grow (schema-enforced). TUI only — the CLI `table` output is
  unchanged. See `src/tui/issue-list.tsx` (`issueColumns` + `resolveLayout`),
  `src/config/schema.ts`, and
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md#column-layout).
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
