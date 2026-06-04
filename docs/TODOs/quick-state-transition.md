# Quick state transition with a confirmation of the move

## Motivation

Triaging a list often means nudging an issue one column forward (or back)
repeatedly. Opening the full edit modal, focusing `state`, opening the picker and
confirming is a lot of keystrokes for that one move. A quick transition binding
advances/retreats the selected issue's state directly from the list, with a
short confirmation that spells out the move so the user never changes state by
accident.

## Design

- Two bindings on the list (and detail): one to move the state **forward**, one
  **backward**, along the project's ordered states.
- "Forward/back" follows the project's state order (the same list the picker
  shows, ordered by Plane's `sequence`/group). The next/previous state in that
  order is the target; at the ends it is a no-op (with a brief hint).
- Before applying, show an **explicit confirmation that names the transition** —
  e.g. `ENG-123: Todo → In Progress?  (y/n)` — so the change is never silent.
  `y` applies, `n`/`esc` cancels.
- Apply via `issues.update({ state_id })` and reconcile the row the same way the
  edit modal does: patch in place, or refresh when the active view filters by
  state (reuse `patchTouchesViewFilter`).
- States are project-scoped, so resolving the neighbour needs the issue's project
  states — reuse `StatesService` (cached). Errors surface in the status bar.

## Implementation sketch

- A `nextState` / `prevState` pure helper over the ordered project states (pure,
  table-tested): given the current state id and the ordered list, return the
  neighbour or undefined at the ends.
- New keybinding actions (e.g. `list.state-next` / `list.state-prev`) in
  `src/keybindings/registry.ts`, routed in the dashboard.
- A small confirmation overlay (reuse the edit modal's confirm pattern) that
  renders the named transition and gates the mutation.
- Reuse the in-place/refresh reconciliation already in the dashboard `onSave`.

## Acceptance checklist

- [ ] A binding moves the selected issue to the next/previous project state.
- [ ] A confirmation names the exact transition (`from → to`) before applying.
- [ ] Confirming applies one `issues.update`; cancelling changes nothing.
- [ ] At the first/last state the binding is a no-op with a hint, not an error.
- [ ] The row reconciles (in place, or refresh when the view filters by state).
- [ ] Failures surface in the status bar with context; no silent failure.
- [ ] Help modal lists the new bindings.
- [ ] Tests: the neighbour helper (table-driven, including the ends) and that
      cancelling the confirmation makes no API call.

## References

- [action-edit.md](action-edit.md) — the state picker and confirmation pattern.
- `src/plane/states.ts` — ordered project states (cached).
- `src/tui/dashboard.tsx` — `patchTouchesViewFilter` and the reconcile-on-save logic.
