# Action: edit state, assignee and priority

## Motivation

The CLI can already edit issues (`plc issue edit`, `plc issue assign`), but the
**TUI is read-only** — list, detail, open-in-browser. The most-requested theme in
the gh-dash backlog is "act on items without leaving the dashboard". The three
cheapest, highest-value mutations are **state**, **assignee** and **priority**,
because the domain functions already exist:

- `ctx.issues.update(key, { state_id })` / priority via the same patch
- `ctx.issues.assign(key, [userId])`
- `ctx.users.resolveAssignee(spec)`

This item covers only those three transitions. Commenting and headless creation
already shipped (see the index in [README.md](README.md)).

## Design

Add three list/detail keybindings that open a small in-place picker over the
current issue. Prefer behaviour-named actions over generic setters (per
`AGENTS.md`): `assignIssue`, `setPriority`, `transitionState`.

| Key | Action id            | Picker                                                                                    |
| :-- | :------------------- | :---------------------------------------------------------------------------------------- |
| `s` | `issue.set-state`    | select from the project's states (grouped: backlog/unstarted/started/completed/cancelled) |
| `a` | `issue.assign`       | select a workspace member (or `me`); supports unassign                                    |
| `p` | `issue.set-priority` | select urgent / high / medium / low / none                                                |

### Picker UX

- Reuse an Ink select overlay (same modal pattern as the help modal: replace
  content, keep the status bar). One column, arrow/`j`/`k` to move, `enter` to
  confirm, `esc` to cancel.
- States must be **fetched per project** (states are project-scoped in Plane);
  cache them via the existing `CacheStore` keyed by project id.
- After a successful mutation, **optimistically patch the row in place** and
  refresh just that issue (do not reset selection or reload the whole view — see
  the refresh-selection fix in the responsive work / gh-dash #735).
- Show a transient status-bar message on success/failure; never swallow the error.

## Implementation sketch

- New keybinding actions in `src/keybindings/registry.ts`: `issue.set-state`,
  `issue.assign`, `issue.set-priority` (list + detail contexts).
- A reusable `<SelectModal>` component in `src/tui/` (title, options, onConfirm,
  onCancel) — the state/assignee/priority pickers are thin wrappers over it.
- `Dashboard` handlers call the existing domain functions and update local state
  on resolve.
- A `StatesService` (or extend `ProjectsService`) to list + cache project states,
  since the picker needs them and the list currently only renders `state.name`.

## Acceptance checklist

- [ ] `s` / `a` / `p` open their pickers over the selected issue in list and detail.
- [ ] State picker lists the **selected issue's project** states, grouped, cached.
- [ ] Assignee picker resolves `me` and supports unassigning.
- [ ] On success the row updates in place; selection and scroll are preserved.
- [ ] Failures surface in the status bar with context (issue key + reason); no
      silent failure.
- [ ] Help modal lists the three new bindings.
- [ ] Tests: state grouping/caching, assignee resolution, priority transition,
      and that selection is preserved after a mutation.

## References

- gh-dash issues: #748 (`a` does nothing in Issues view), #745 (reviewers not
  updated after `r`/`R`), #735 (view jumps to top on refresh) — all argue for
  in-place updates and preserved selection.
