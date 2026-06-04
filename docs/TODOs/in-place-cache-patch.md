# Patch an edited issue in place instead of refetching the view

## Motivation

After a successful edit, the dashboard calls `load(true)`, which refetches the
whole active view to reflect the change. It works and preserves selection, but
on a slow self-hosted Plane (where the list fetch already times out — see
[self-hosted-timeout-resilience.md](self-hosted-timeout-resilience.md)) a full
refetch after every single-field edit is wasteful and can make a just-saved
change appear to "flicker" or briefly revert while the refetch is in flight.
The action-edit plan explicitly called for an in-place row update; this item
delivers the real thing.

## Design

- After `issues.update` resolves, it returns the updated `Issue`. Patch that row
  directly into the per-view cache (`useViewsData`) and into the rendered list,
  instead of refetching — selection and scroll stay put because the row identity
  (key) does not change.
- Keep a refetch as a fallback only when the edit can move the issue out of the
  view's filter (e.g. changing state to one the view excludes); in that case a
  targeted reload is justified, but it should be the exception, not the default.
- Reconcile with the cache layer: the edit already invalidates the project's
  issue cache; the in-place patch must not be undone by a racing auto-refresh
  (auto-refresh is paused during edit, so the window is small, but the ordering
  must be deliberate).

## Implementation sketch

- Expose a `patchIssue(viewIdx, updated)` on `useViewsData` that replaces the row
  with matching key in `byView[viewIdx].issues`.
- In the dashboard `onSave`, use the `Issue` returned by `issues.update` to call
  `patchIssue` rather than `load(true)`.
- Detect the "row no longer matches the view filter" case and fall back to a
  targeted reload there only.

## Acceptance checklist

- [ ] A successful edit updates the row from the `update()` result without a
      full view refetch.
- [ ] Selection and scroll are preserved, with no flicker/revert window.
- [ ] An edit that removes the issue from the view's filter still reconciles
      (targeted reload), without leaving a stale row.
- [ ] Tests: `patchIssue` row replacement by key, and the filter-exit fallback.

## References

- [action-edit.md](action-edit.md) — the in-place-update intent (gh-dash #735).
- `src/tui/use-views-data.ts` — owns the per-view rows to patch.
- `src/tui/dashboard.tsx` — `onSave` currently calls `load(true)`.
