# Action: comment on an issue

## Motivation

Commenting is the second write-action users expect from the dashboard (after
state/assign/priority — [action-edit.md](action-edit.md)). The domain function
already exists: `ctx.issues.comment(key, text)` (used by `plc issue comment`).
This item brings it into the TUI and rounds out the CLI flow.

## Design

### TUI

- Keybinding `c` (`issue.comment`) on the selected issue, in both list and
  detail contexts.
- Opens a multi-line input overlay (reuse the modal pattern; the existing
  single-line `FilterBox` is the closest reference for input handling).
  - `enter` inserts a newline; `ctrl+s` (or `esc`-then-confirm) submits;
    `esc` on an empty buffer cancels. Document the exact keys in the help modal.
  - Guard against empty/whitespace-only comments (the CLI already throws on
    empty — reuse that rule, do not duplicate it in the adapter).
- On submit: call `ctx.issues.comment`, show a transient status-bar confirmation,
  and — if the detail panel is open — append/refresh so the new comment is
  visible without a full reload.

### CLI (round out the existing command)

`plc issue comment <key>` already prompts or takes `-m/--message`. Add a
**body-from-file** option for consistency with
[action-create-from-file.md](action-create-from-file.md):

```
plc issue comment ENG-123 --body-file notes.md
plc issue comment ENG-123 --body-file -        # read from stdin
```

Reuse the stdin reader that already exists for `plc auth login --with-token`
(`readAllStdin` in `src/commands/auth/index.ts`) instead of writing a new one.

## Implementation sketch

- `issue.comment` keybinding action (list + detail) in the registry.
- A `<TextAreaModal>` (or extend the input handling from `FilterBox`) for
  multi-line entry; keep it small and reusable.
- `Dashboard` handler → `ctx.issues.comment` → status-bar feedback + optional
  detail refresh.
- CLI: add `--body-file <path>` to the `comment` command; `-` means stdin.

## Acceptance checklist

- [ ] `c` opens a multi-line comment editor over the selected issue.
- [ ] Empty/whitespace comments are rejected with a clear message; no silent no-op.
- [ ] Successful comment shows status-bar confirmation; detail view reflects it.
- [ ] CLI `--body-file <path>` (and `-` for stdin) works and shares the auth
      stdin reader.
- [ ] Tests: empty-comment guard, file/stdin body reading, success path.

## References

- gh-dash issue #490 (add/edit PR review comments) — top-voted write feature.
- gh-dash issue #751 (comment inputbox autocompletes labels with enter/tab) — a
  cautionary tale: keep the comment editor's keys unambiguous.
