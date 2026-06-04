# Harden `me` resolution against the members payload variance

## Motivation

While fixing the assignee picker we learned that this self-hosted Plane returns
workspace members in shapes the original code did not expect (sometimes wrapped
as `{ member: {...} }`, sometimes flattened, sometimes with null rows).
`UsersService.list` now normalizes those, but `UsersService.me` still calls
`/users/me` and trusts the response shape directly. If `/users/me` (or the
member lookup that backs `resolveAssignee` for a non-`me` spec) returns a shape
without a top-level `id`, assignee resolution can silently produce a user with no
usable id — the same class of bug that made the picker appear empty.

## Design

- Route `me()` and the member match in `resolveAssignee` through the same
  normalization used by `list()`, so every path that yields an `IssueUser`
  guarantees a non-empty `id`.
- When `me()` cannot be resolved to a user with an id, fail loudly with a
  contextual error (which profile, which workspace) instead of returning a
  half-populated user — assignment built on a missing id would PATCH nothing.
- Confirm the actual `/users/me` payload on a real deployment before locking the
  shape; record it here so future changes have a reference.

## Implementation sketch

- Extract the row→`IssueUser` normalization in `src/plane/users.ts` so `me()`,
  `list()` and the `resolveAssignee` match all share it.
- Throw a `NotFoundError`/`AuthError` with profile + workspace context when
  `me()` yields no id, rather than returning a partial object.
- Add tests for `me()` across the payload shapes, and for `resolveAssignee`
  rejecting a spec that resolves to an id-less user.

## Acceptance checklist

- [ ] `me()` returns a user with a non-empty `id`, or throws with context.
- [ ] `resolveAssignee` never returns a user without a usable `id`.
- [ ] The normalization is shared with `list()` (no duplicated mapping).
- [ ] Tests cover `me()` and `resolveAssignee` against the nested, flattened and
      partial shapes.

## References

- `src/plane/users.ts` — `list()` already normalizes; `me()` does not yet.
- The members-payload fix that motivated this (commit normalizing the workspace
  members payload across Plane releases).
