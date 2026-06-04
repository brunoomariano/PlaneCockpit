# Create an issue from the TUI

## Motivation

`plc issue create` already creates issues headlessly (name, description from
file/stdin, priority). The TUI can list, view, comment and now edit, but cannot
**create** — the user still drops to the shell to open a new issue. Creating from
the dashboard closes the "act without leaving the dashboard" loop and reuses the
edit modal's form and pickers almost entirely.

## Design

- A new keybinding (e.g. `n` for "new") opens a **create modal** that is the edit
  modal's form without a pre-existing issue: empty title/description, no state
  override (defaults to the project's first state), no assignees, `none` priority.
- The target **project** must be chosen first when the active view spans several
  projects: a single-select `SelectModal` over the view's projects. With one
  project, skip the prompt.
- Reuse the field form, the text buffers and the pickers from the edit modal;
  the only new piece is the project selection and calling `issues.create`
  instead of `issues.update`.
- On success, surface the new issue key, refresh the view, and select the new
  row if it lands in the current view.

## Implementation sketch

- Reuse `IssueEditor` / `useIssueEditor` in a "create" mode (no `issue`,
  seeded empty draft), or factor the shared form so both modals consume it.
- Project picker: a single-select `SelectModal` over the resolved view projects.
- Call `ctx.issues.create(projectIdentifier, { name, description, priority,
assignee_ids, label_ids })` — the domain method already exists.
- A `create.open` action in `src/keybindings/registry.ts`; route it in the
  dashboard the way `e` is routed.

## Acceptance checklist

- [ ] A keybinding opens a create modal with empty fields.
- [ ] The project is chosen for multi-project views and inferred for single ones.
- [ ] Title is required; create is blocked (with a status-bar hint) until it is set.
- [ ] On success the new issue key is surfaced and the view refreshes.
- [ ] Failures surface in the status bar with context; no silent failure.
- [ ] Help modal lists the new binding.
- [ ] Tests: project resolution (single vs multi), the create payload, and the
      required-title guard.

## References

- [action-edit.md](action-edit.md) — the form and pickers this reuses.
- `src/commands/issue/index.ts` — the headless `issue create` flow.
- `src/plane/issues.ts` — `IssuesService.create` already exists.
