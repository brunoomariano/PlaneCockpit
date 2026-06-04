# Action: edit state, assignee and priority

## Motivation

The CLI can already edit issues (`plc issue edit`, `plc issue assign`), but the
**TUI is read-only** — list, detail, open-in-browser. The most-requested theme in
the gh-dash backlog is "act on items without leaving the dashboard". The three
cheapest, highest-value mutations are **state**, **assignee** and **priority**,
because the domain functions already exist:

- `ctx.issues.update(key, { state_id, priority, assignee_ids })` (a single PATCH)
- `ctx.users.list()` to populate the assignee picker
- project states, which are project-scoped and need a small `StatesService`

This item covers only those three transitions. Commenting and headless creation
already shipped (see the index in [README.md](README.md)).

## Design

A single **edit modal** (`e`), styled like the detail modal, shows the issue's
read-only context (project, key, `updated_at`) and its three **editable fields**
(state, assignee, priority). The user navigates between the editable fields with
the arrows / `j` / `k`; `enter` on a field opens a `SelectModal` to pick a value.
Changes accumulate in a **draft** and are written in one PATCH on `ctrl+s` — the
same save gesture as the comment editor.

Prefer behaviour-named actions over generic setters (per `AGENTS.md`):
`transitionState`, `assignIssue`, `setPriority` compose the single
`issues.update()` call.

### Edit modal UX

- Opened with `e` from the list and from the detail modal, over the selected
  issue. Does nothing when there is no selection.
- Layout mirrors the detail modal (double border, accent color, status bar kept).
  A read-only header (project · key · `updated_at`) sits above three field rows:
  `state`, `assignee`, `priority`. The focused field is highlighted; only the
  three editable rows take focus.
- `enter` on the focused field opens its `SelectModal`:
  - **state** — the issue's **project** states, grouped (backlog / unstarted /
    started / completed / cancelled). Single-select: `enter` confirms.
  - **priority** — urgent / high / medium / low / none. Single-select.
  - **assignee** — workspace members plus `me`. **Multi-select**: `enter`
    toggles a member's mark without closing; `ctrl+s` confirms the whole set
    (an empty set means "unassign everyone").
- `esc` **inside a `SelectModal`** closes only the select and returns to the
  form, leaving the draft untouched.
- `esc` **in the form** closes the editor — but if the draft has pending changes
  it first asks for confirmation ("discard changes?"); confirming discards and
  closes, cancelling returns to the form with the draft intact.
- `ctrl+s` saves: one `issues.update()` carrying only the changed fields
  (`state_id`, `priority`, `assignee_ids`). A save with no changes is a no-op and
  just closes. On success the editor closes; on failure it stays open with the
  draft preserved and a status-bar message (issue key + reason) — never a silent
  failure.
- After a successful save the row is **patched in place** and the view refreshed
  for that issue only; selection and scroll are preserved (gh-dash #735).

### Reusable `SelectModal`

A single Ink component drives all three pickers (title, options, `single` /
`multi` mode, `onConfirm`, `onCancel`). Arrow / `j` / `k` move the cursor;
`enter` confirms (single) or toggles (multi); `ctrl+s` confirms a multi set;
`esc` cancels back to the caller. Key handling lives in a small controller hook
so the component stays a pure view, mirroring `comment-editor` + `text-buffer`.

## Implementation sketch

- `src/plane/states.ts` — `StatesService.list(project)` fetching project-scoped
  states, cached per project id (`cacheKeys.states`). Wired into `AppContext`.
- `src/tui/select-modal.tsx` + a controller hook — the reusable picker.
- `src/tui/use-issue-editor.ts` — holds the draft (`state_id`, `priority`,
  `assignee_ids`), tracks dirty (vs. the original), owns field navigation and the
  active inner picker, and runs the single-PATCH save through `onSubmit`.
- `Dashboard` wires the `e` keybinding, routes keys to the editor while open,
  pauses auto-refresh, shows the exit-confirmation, and patches the row in place
  on save.
- New keybinding actions in `src/keybindings/registry.ts` under an `edit`
  context (`edit.open` on `e`, plus the in-modal navigation / save / close ids).

## Acceptance checklist

- [x] `e` opens the edit modal over the selected issue in list and detail.
- [x] Arrows / `j` / `k` move focus across the three editable fields only.
- [x] State picker lists the **selected issue's project** states, grouped, cached.
- [x] Assignee picker is multi-select (`enter` toggles, `ctrl+s` confirms) and
      supports unassigning everyone.
- [x] Priority picker is single-select over the five priorities.
- [x] `ctrl+s` sends one `issues.update()` with only the changed fields; a save
      with no changes is a no-op.
- [x] `esc` in a picker returns to the form; `esc` in the form with pending
      changes asks for confirmation before discarding.
- [x] On success the row updates in place; selection and scroll are preserved
      (the dashboard refreshes the view, re-anchoring the cursor on the saved key).
- [x] Auto-refresh is paused while the editor is open.
- [x] Failures surface in the status bar with context (issue key + reason); no
      silent failure.
- [x] Help modal lists the new bindings.
- [x] Tests: state grouping/caching, assignee multi-select toggle, priority
      transition, dirty tracking + exit confirmation, single-PATCH save payload,
      and that selection is preserved after a mutation.

## References

- gh-dash issues: #748 (`a` does nothing in Issues view), #745 (reviewers not
  updated after `r`/`R`), #735 (view jumps to top on refresh) — all argue for
  in-place updates and preserved selection.
