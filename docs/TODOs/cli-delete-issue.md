# CLI: delete an issue

## Motivation

There is no way to delete an issue from `plc` — neither CLI nor TUI. The CLI is
the right first home for it: deletion is destructive and irreversible, so it
belongs in a deliberate, scriptable command with an explicit guard, not a single
TUI keystroke. This adds `plc issue delete <key>` with a confirmation.

## Design

- `plc issue delete <key>` resolves the issue (key → project + id, via the
  existing resolver) and deletes it through a new `issues.delete` domain method
  backed by `workItems.delete` (HTTP `DELETE` on the issue path).
- **Destructive guard:** prompt for confirmation by default
  (`Delete ENG-123 "<title>"? (y/N)`), defaulting to no. `--yes`/`-y` skips the
  prompt for non-interactive use (CI), the same pattern destructive CLIs use.
- On success print a plain confirmation; honour `--json` for a machine-readable
  result. Invalidate the project's issue cache so a subsequent list does not show
  the deleted row.
- Fail loudly with context (key, project) on a missing issue or an API error.

## Implementation sketch

- `WorkItemsService.delete(project, issueId)` — `DELETE` on
  `projects/:id/issues/:issueId`, then `invalidateProjectIssues`.
- `IssuesService.delete(key)` — resolve then delegate.
- `plc issue delete <key>` in `src/commands/issue/index.ts` with `--yes` and the
  confirmation prompt (reuse the existing prompt/input utilities).

## Acceptance checklist

- [ ] `plc issue delete <key>` deletes the issue after a confirmation.
- [ ] `--yes` skips the prompt for non-interactive use; the default answer is no.
- [ ] The project's issue cache is invalidated so the row disappears from `list`.
- [ ] A missing issue / API error fails loudly with key + project context.
- [ ] Tests: the resolve→delete path, cache invalidation, and that declining the
      prompt makes no API call.

## References

- `src/commands/issue/index.ts` — the command surface.
- `src/plane/work-items.ts` — where `delete` lives next to `update`/`create`.
- `src/plane/issues.ts` — the resolver-backed facade.
