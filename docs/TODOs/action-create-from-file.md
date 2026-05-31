# Action: create an issue with the body from a file

> **Status: done** (CLI). Implemented in `plc issue create`
> (`src/commands/issue/index.ts`) with `--body-file`/`--priority` and a shared
> stdin reader in `src/utils/input-source.ts`. The TUI create action is still
> future work; see [action-edit.md](action-edit.md) for the modal pattern.

## Motivation

`plc issue create` today is **interactive only** — it prompts for title,
description and priority. That blocks two important callers:

1. **Agents / MCP servers.** The way MCP-style tooling creates rich content is to
   write the markdown body to a file (or pipe it on stdin) and hand the command a
   *path*, rather than trying to pass a long, multi-line, markdown string as a
   shell argument (which mangles newlines, quoting and code fences). This mirrors
   `gh issue create --body-file <file>` (with `-` meaning stdin) and the existing
   `plc auth login --with-token` stdin reader in this repo.
2. **Scripts / templates.** Teams keep issue templates as files and want
   `plc issue create --body-file template.md`.

This item makes `create` non-interactive and file/stdin friendly. State, assignee
and priority editing live in [action-edit.md](action-edit.md); commenting in
[action-comment.md](action-comment.md).

## The "MCP way", concretely

There is no Plane MCP server wired into this repo today, but the pattern an
agent/MCP integration uses is provider-agnostic:

```
# the agent writes the composed markdown to a temp file…
$TMP=$(mktemp); printf '%s' "$body" > "$TMP"
# …then invokes the CLI with the path (never inlining the body as an argument)
plc issue create --project ENG --title "Fix login redirect" --body-file "$TMP"
```

or streams it on stdin without touching disk:

```
printf '%s' "$body" | plc issue create -p ENG -t "Fix login redirect" --body-file -
```

Key properties to preserve, because that is what makes it agent-safe:

- **Body comes from a path or stdin**, never required as an inline arg — newlines,
  quotes and code fences survive intact.
- **Fully non-interactive when title + project are supplied** — no prompt, so it
  works headless. Falls back to the interactive flow only when a required field
  is missing *and* stdin is a TTY.
- **Deterministic output** — print the created issue in the requested format
  (`--json` already supported via `renderObject`), so the caller can capture the
  new key/URL.

## Design

Extend `plc issue create` (`src/commands/issue/index.ts`):

| Flag | Meaning |
| :--- | :------ |
| `-p, --project <id>` | already exists |
| `-t, --title <title>` | already exists |
| `--body-file <path>` | read description from a file; `-` reads stdin |
| `--priority <p>` | set priority non-interactively (urgent\|high\|medium\|low\|none) |

Resolution rules:

- Description precedence: `--body-file` > interactive prompt. (No inline
  `--body` to discourage agents from arg-passing large markdown; add later only
  if a human asks.)
- If `--title` and project are present, **skip all prompts** (headless mode).
- `--body-file -` reads stdin via the shared `readAllStdin` helper (lift it out
  of `src/commands/auth/index.ts` into `src/utils/` so both commands share it —
  DRY per `AGENTS.md`).
- Empty title is rejected with a clear error (reuse the create domain validation;
  do not re-implement in the command).

## Implementation sketch

- Move `readAllStdin` to `src/utils/stdin.ts`; reuse in `auth login` and here.
- Add a small `readBodyFile(path)` util: `path === "-"` → stdin, else
  `fs.readFile`. Wrap fs errors with context (`createIssue: read body file: …`).
- Add `--body-file` / `--priority` to the `create` command; branch headless vs
  interactive on whether required fields are present and `process.stdin.isTTY`.
- Keep `ctx.issues.create` unchanged — it already accepts `{ name, description,
  priority }`.

## Acceptance checklist

- [x] `--body-file <path>` reads the description from a file.
- [x] `--body-file -` reads the description from stdin.
- [x] With `--title` + project (+ optional `--priority`/`--body-file`), the
      command runs **without any prompt**.
- [x] Missing required field + non-TTY stdin → clear error, not a hung prompt.
- [x] `readAllStdin` is shared between `auth login` and `issue create` (no dup).
- [x] fs/stdin read errors are wrapped with operational context.
- [x] `--json` output prints the created issue (key + url) for the caller.
- [x] Tests: file body, stdin body, headless path, empty-title rejection,
      shared stdin reader.

## References

- `gh issue create --body-file file` (and `-` for stdin) — the canonical CLI
  pattern this mirrors.
- gh-dash issue #689 (ability to create PRs and Issues from the dashboard).
- Existing precedent in-repo: `plc auth login --with-token` reads the key from
  stdin (`readAllStdin`).
