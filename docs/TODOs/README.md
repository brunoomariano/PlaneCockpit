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

Scale / search:

| TODO                                           | Summary                                                                                       |
| :--------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| [server-side-search.md](server-side-search.md) | Push filtering/search to the server so it covers the whole project, not just the loaded page. |

## Done

These shipped; their planning docs were removed once implemented.

- **Structured filter bar** — `/` filters the loaded rows with a gh-dash-style
  `key:value` query (`ass:`/`state:`/`group:`/`prio:`/`label:`/`proj:`, plus bare
  words for title/key). Tokens AND across keys and OR within a key; `ass:me`
  resolves the current user; an unknown key degrades to a substring match; the
  status bar shows the match count. Parsing/matching are pure (`issue-query.ts`,
  table-tested). See `src/tui/issue-query.ts` and the `filtered` memo in
  `src/tui/dashboard.tsx`.
- **Quick state transition** — `>` / `<` move the selected issue one step
  forward / back along its project's workflow order (group lifecycle, then API
  order), behind a confirmation that names the move (`ENG-1: Todo → In Progress?`)
  so it is never silent. Applies via one `issues.update`, reconciling the row in
  place (or a refresh when the view filters by state); a no-op with a hint at the
  ends. Backed by `neighbourState` (pure, table-tested). See
  `src/plane/state-order.ts` and `src/tui/dashboard.tsx`.
- **Self-hosted payload audit** — hardened every read adapter against the shape
  variance seen on the self-hosted instance and locked it with tests: projects
  (array vs `{ results }`, `workspace` vs `workspace_id`, null/partial rows
  dropped), states/labels (bare array vs page), and the issue read path
  (`toIssue`: relations as expanded objects or bare UUID strings, `priority: null`,
  description from html/stripped). The observed shapes are recorded in
  [audit-self-hosted-payloads.md](audit-self-hosted-payloads.md). See
  `src/plane/projects.ts` and the `work-items.to-issue` / `projects` tests.
- **CLI: change state and labels** — `plc issue transition <key> <state>` moves an
  issue to a state and `plc issue label <key> [labels...]` sets its labels
  (replace semantics; no args clears), both resolving the value by name
  (case-insensitive) or id within the issue's project and failing with the valid
  options listed. Verified end-to-end against a live self-hosted Plane. See
  `src/commands/issue/resolve-field.ts` and `src/commands/issue/index.ts`.
- **Explicit TTL on states/labels caches** — `StatesService`/`LabelsService` now
  cache with their own short TTL (300s) instead of inheriting the profile-wide
  `cache.ttl`, so a high global list TTL never strands a freshly-created state or
  label in the pickers — it reappears within minutes without `plc cache clear`.
  See `STATES_LABELS_TTL_SECONDS` in `src/config/defaults.ts`.
- **Fix: descriptions were silently dropped** — the issue endpoint ignores a
  plain `description` field (returns 200, body unchanged); Plane only persists a
  description sent as `description_html`. Both create and update now convert the
  editor's text to minimal HTML (`textToHtml`, paragraph-per-line, escaped) and
  send `description_html`. Verified end-to-end against a live self-hosted Plane.
  See `src/utils/text-to-html.ts` and `src/plane/work-items.ts`.
- **CLI: delete an issue** — `plc issue delete <key>` removes an issue, confirming
  by default (defaulting to no) and skipping the prompt with `--yes` for
  non-interactive use; the project's issue cache is invalidated. Backed by
  `issues.delete` / `workItems.delete`. See `src/commands/issue/index.ts`.
- **Create an issue from the TUI** — `n` opens a create modal that reuses the edit
  form and pickers. It first picks the target project (inferred when the view
  resolves to one, a picker when several), then composes title/description/state/
  assignee/priority/labels and posts via `issues.create` in one request. Title is
  required (guarded with a status-bar hint); state/labels load against the chosen
  project. See `src/tui/use-issue-creator.ts`, `src/tui/issue-creator.tsx`.
- **Edit title and description** — the edit modal now has `title` and
  `description` as inline free-text fields (focused first): `enter` opens a text
  editor over the form (description multiline), `ctrl+s` applies it back, `esc`
  cancels. They feed the same single PATCH as the other fields, sending the
  Markdown verbatim (matching the CLI `issue edit`; no lossy Markdown→HTML
  conversion). See `src/tui/use-issue-editor.ts`, `src/tui/issue-editor.tsx`.
- **Label picker** — labels are now a fourth editable field in the edit modal,
  via a multi-select `SelectModal` seeded with the issue's current labels (an
  empty set clears them). Backed by a new `LabelsService` (per-project cached
  labels, mirroring `StatesService`). The save sends `label_ids`, mapped to the
  API's `labels`. See `src/plane/labels.ts`, `src/tui/use-issue-editor.ts`, and
  the plan in [action-edit.md](action-edit.md).
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
