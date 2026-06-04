# Break up the Dashboard god-component

## Motivation

`src/tui/dashboard.tsx` has grown to ~914 lines, with the `Dashboard` function
itself spanning ~597 of them. `AGENTS.md` targets ~20–30-line functions and
~150-line files; this is the single biggest structural smell in the codebase. It
accreted as each in-dashboard action landed (detail, comment, edit, create,
quick transition, structured filter), each adding state, an effect, handlers and
an overlay branch to the same component. The existing `eslint-disable complexity`
justifies the branch count of a single interactive container, but not the sheer
size — the state and wiring are now hard to follow and risky to change.

## Design

Keep `Dashboard` as the thin composition root and extract cohesive slices behind
hooks/components, mirroring what already works (`useIssueEditor`,
`useIssueCreator`, `useViewsData`):

- **Per-feature state+key-handling into hooks.** The quick-transition state and
  its `start`/`apply`/key handling, and the `me`-resolution + structured-filter
  memo, are self-contained and can move into `useQuickTransition` /
  `useIssueFilter` hooks the way edit/create already did.
- **Overlay routing into one place.** The cascading `creator ? … : editor ? … :
comments ? …` overlay selection and its status-bar `loading`/`position`
  bookkeeping is a single concern — a small `useActiveOverlay` (or a pure
  `selectOverlay(...)`) can own the precedence so the component body shrinks.
- **Key dispatch table.** The `useInput` callback fans out to per-context
  handlers; the routing order (which overlay consumes the keystroke) can be a
  small data-driven dispatcher instead of an `if` ladder.
- Move the extracted pieces into their own files so `dashboard.tsx` drops back
  toward the ~150-line guideline. No behavior change — this is a structural
  refactor guarded by the existing e2e tests.

## Acceptance checklist

- [ ] `Dashboard` is a thin composition root; the per-feature state machines
      live in named hooks/files.
- [ ] `dashboard.tsx` is materially smaller (target: well under the current 914),
      and no single function carries the whole container.
- [ ] No behavior change: the dashboard e2e suite (comment/edit/create/transition/
      filter/refresh) passes unchanged.
- [ ] The `eslint-disable complexity` is removed or its justification narrows to
      what genuinely remains.

## References

- `AGENTS.md` — function/file size guidance (SRP, ~20–30 lines, ~150-line files).
- `src/tui/dashboard.tsx` — the component to decompose.
- `src/tui/use-issue-editor.ts`, `use-issue-creator.ts`, `use-views-data.ts` —
  the extraction pattern to follow.
