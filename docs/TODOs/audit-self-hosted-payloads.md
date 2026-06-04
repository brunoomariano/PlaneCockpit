# Audit self-hosted payload variance across endpoints

## Motivation

This self-hosted Plane returned shapes the code did not expect: the members list
came without the `{ member }` wrapper (and with null rows), which broke the
assignee picker until `UsersService` was hardened, and a separate bug had the
update PATCH silently ignored because it sent `state_id`/`assignee_ids` instead
of `state`/`assignees`. Those were found in production, one at a time. Other
endpoints likely have the same kind of variance lurking; this item is a
deliberate pass to find and normalize it before users hit it.

## Design

Audit every endpoint the client reads or writes for payload-shape assumptions,
and make each adapter defensive in the same way the members adapter now is:
accept the known shape variants, drop unusable rows, and never surface a
half-populated domain object.

Endpoints/adapters to review:

- `/users/me` (`UsersService.me`) — already routed through `normalizeMember`;
  confirm against a real payload and lock the shape with a recorded sample.
- Workspace members (`UsersService.list`) — done, but capture a sample here.
- Projects (`ProjectsService`) — `workspace` vs `workspace_id`, pagination shape.
- Project states / labels (`StatesService`, `LabelsService`) — array vs
  `{ results }`, `group` values, ordering field for "next/prev" (see
  [quick-state-transition.md](quick-state-transition.md)).
- Work items read (`toIssue`) — `state`/`assignees`/`labels` as expanded objects
  vs bare UUID strings (already partly handled); confirm `priority: null`.
- Work items write (`toApiBody`, `create`) — confirm the accepted field names for
  state/assignees/labels/description across releases.

For each: record an observed payload sample (redacted) in this doc, assert the
adapter handles it, and add a regression fixture. Where shapes diverge, normalize
at the adapter boundary — never in the domain or the UI.

## Implementation sketch

- A short capture step (debug logging already records request/response metadata)
  to collect one real sample per endpoint from the self-hosted instance.
- For each adapter, add/extend a fake-client unit test with the observed shape(s)
  and a defensive mapping that drops id-less / null rows.
- Centralize the row normalization where two adapters share a shape (members vs
  /users/me already share `normalizeMember`).

## Acceptance checklist

- [ ] Each listed adapter has a test covering the array and `{ results }` shapes.
- [ ] Adapters drop null/partial rows instead of emitting id-less domain objects.
- [ ] `/users/me` is verified against a real payload and the shape is recorded.
- [ ] The accepted write field names (state/assignees/labels) are confirmed and
      asserted by `toApiBody` tests.
- [ ] Observed payload samples (redacted) are recorded in this doc for reference.

## References

- `src/plane/users.ts` — the hardened members/`me` normalization (the template).
- `src/plane/work-items.ts` — `toIssue` (read) and `toApiBody`/`create` (write).
- `src/plane/projects.ts`, `src/plane/states.ts`, `src/plane/labels.ts`.
