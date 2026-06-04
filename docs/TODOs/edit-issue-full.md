# Edit an issue's title, description and labels in the TUI

## Motivation

The edit modal (`e`) already covers **state**, **assignee** and **priority**
(see [action-edit.md](action-edit.md)). The remaining everyday edits are the
issue's **title**, **description** and **labels**. Title and description already
exist on the CLI (`plc issue edit`), so the domain side is mostly in place; this
item brings them — plus labels — into the same in-dashboard modal so the user
never has to drop back to the shell to fix a typo or re-tag an issue.

## Design

Extend the existing edit modal rather than adding new ones. The form grows two
text fields and one more picker, reusing the building blocks already shipped:

| Field         | Editor                                                             |
| :------------ | :----------------------------------------------------------------- |
| `title`       | single-line text buffer (reuse `text-buffer` / the comment editor) |
| `description` | multiline text buffer (the comment editor is already multiline)    |
| `labels`      | multi-select `SelectModal` (same pattern as assignee)              |

- Title/description edit in place: `enter` on the focused field opens an inline
  text editor over the modal (the description reuses the multiline buffer that
  `comment-editor` already drives); `ctrl+s` there returns to the form, `esc`
  cancels the field edit.
- Labels are **project-scoped** like states, so they need a `LabelsService`
  mirroring `StatesService` — this item depends on [label-picker.md](label-picker.md)
  (or lands together with it).
- The single-PATCH save in `useIssueEditor` already carries `name`,
  `description` and `label_ids`: `buildUpdatePatch` and `toApiBody` only need the
  new fields wired through; `toApiBody` already maps `label_ids → labels`.
- Description is stored as HTML on Plane. Decide the round-trip: edit the
  Markdown we render and convert back to HTML on save, or edit raw — record the
  decision here before implementing so we do not lose formatting silently.

## Implementation sketch

- Extend `EditorDraft` / `editorOriginal` / `isDraftDirty` / `buildUpdatePatch`
  in `src/tui/issue-editor-draft.ts` with `name`, `description`, `label_ids`.
- Add the two text fields and the label row to `IssueEditor` and the focus
  cycle in `useIssueEditor` (`EDIT_FIELDS`).
- Reuse `TextBuffer` for the inline title/description editors; keep key handling
  in the hook, mirroring `useCommentEditor`.
- A `LabelsService` (per-project, cached) — see [label-picker.md](label-picker.md).
- Settle the description HTML↔Markdown round-trip (reuse `html-to-markdown` and
  add the inverse, or store the edited text as-is).

## Acceptance checklist

- [ ] The edit modal exposes title, description and labels alongside the three
      existing fields.
- [ ] Title and description edit inline and feed the same single-PATCH save.
- [ ] Labels use the multi-select picker, scoped to the issue's project, cached.
- [ ] `buildUpdatePatch` still sends only changed fields; an unchanged field is
      omitted from the PATCH.
- [ ] The description round-trip preserves formatting (no silent data loss).
- [ ] Dirty tracking and the exit confirmation account for the new fields.
- [ ] Tests: dirty/patch for the new fields, label scoping/caching, and the
      description round-trip.

## References

- [action-edit.md](action-edit.md) — the modal this extends.
- [label-picker.md](label-picker.md) — the label source this depends on.
- `src/commands/issue/index.ts` — the CLI `issue edit` that already mutates
  title/description.
