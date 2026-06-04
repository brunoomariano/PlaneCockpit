# Edit an issue's title and description in the TUI

## Motivation

The edit modal (`e`) already covers **state**, **assignee**, **priority** and
**labels** (see [action-edit.md](action-edit.md)). The remaining everyday edits
are the issue's **title** and **description**. Both already exist on the CLI
(`plc issue edit`), so the domain side is in place; this item brings them into
the same in-dashboard modal so the user never has to drop back to the shell to
fix a typo or rewrite a body.

## Design

Extend the existing edit modal rather than adding new ones. The form grows two
text fields, reusing the building blocks already shipped:

| Field         | Editor                                                             |
| :------------ | :----------------------------------------------------------------- |
| `title`       | single-line text buffer (reuse `text-buffer` / the comment editor) |
| `description` | multiline text buffer (the comment editor is already multiline)    |

- Title/description edit in place: `enter` on the focused field opens an inline
  text editor over the modal (the description reuses the multiline buffer that
  `comment-editor` already drives); `ctrl+s` there returns to the form, `esc`
  cancels the field edit.
- The single-PATCH save in `useIssueEditor` already carries `name` and
  `description` through `buildUpdatePatch` / `toApiBody`; only the new fields
  need wiring into the draft and the form.
- Description is stored as HTML on Plane. Decide the round-trip: edit the
  Markdown we render and convert back to HTML on save, or edit raw — record the
  decision here before implementing so we do not lose formatting silently.

## Implementation sketch

- Extend `EditorDraft` / `editorOriginal` / `isDraftDirty` / `buildUpdatePatch`
  in `src/tui/issue-editor-draft.ts` with `name` and `description`.
- Add the two text fields to `IssueEditor` and the focus cycle in
  `useIssueEditor` (`EDIT_FIELDS`).
- Reuse `TextBuffer` for the inline title/description editors; keep key handling
  in the hook, mirroring `useCommentEditor`.
- Settle the description HTML↔Markdown round-trip (reuse `html-to-markdown` and
  add the inverse, or store the edited text as-is).

## Acceptance checklist

- [ ] The edit modal exposes title and description alongside the existing fields.
- [ ] Title and description edit inline and feed the same single-PATCH save.
- [ ] `buildUpdatePatch` still sends only changed fields; an unchanged field is
      omitted from the PATCH.
- [ ] The description round-trip preserves formatting (no silent data loss).
- [ ] Dirty tracking and the exit confirmation account for the new fields.
- [ ] Tests: dirty/patch for the new fields and the description round-trip.

## References

- [action-edit.md](action-edit.md) — the modal this extends (state, assignee,
  priority and labels already shipped).
- `src/commands/issue/index.ts` — the CLI `issue edit` that already mutates
  title/description.
