# Label picker — list and assign labels in the edit modal

## Motivation

Labels are one of the most common ways teams triage issues, but the TUI cannot
set them. The edit modal already has a reusable multi-select picker (used for
assignees) and a per-project cached service pattern (`StatesService`), so a
label picker is a small, well-shaped addition that unblocks
[edit-issue-full.md](edit-issue-full.md).

## Design

- Labels are **project-scoped** in Plane (each project defines its own), exactly
  like states. A `LabelsService` mirrors `StatesService`: `list(project)` fetches
  the project's labels and caches them per project id (`cacheKeys.labels`).
- The picker is a multi-select `SelectModal`, seeded with the issue's current
  labels — the same shape as the assignee picker, so no new UI is required.
- The save path already supports it: `toApiBody` maps `label_ids → labels`, and
  `UpdateIssuePatch` already carries `label_ids`. The picker only needs to feed
  `draft.label_ids`.
- Render labels with their color where the terminal allows, reusing the theme's
  approach for priority colors.

## Implementation sketch

- `src/plane/labels.ts` — `LabelsService.list(project)`, cached per project id;
  add `cacheKeys.labels(slug, projectId)` next to `cacheKeys.states`.
- Wire `labels` into `AppContext` (`app.ts`), beside `states`.
- A `loadLabels` dep on `useIssueEditor`, opening a multi-select picker seeded
  from `draft.label_ids` (the assignee path is the template).
- Add `labels.ts` to the coverage `include` list and cover list + caching.

## Acceptance checklist

- [ ] `LabelsService.list(project)` returns the project's labels and caches them
      per project id (independent entries per project).
- [ ] The label row opens a multi-select picker seeded with the current labels.
- [ ] Confirming the picker updates `draft.label_ids`; the save sends `labels`.
- [ ] An empty set clears all labels.
- [ ] Tests: per-project caching/isolation and the multi-select toggle/confirm.

## References

- `src/plane/states.ts` — the service this mirrors.
- [action-edit.md](action-edit.md) — the multi-select picker (assignee) it reuses.
- [edit-issue-full.md](edit-issue-full.md) — the consumer that needs this.
