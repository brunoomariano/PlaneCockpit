# Align commit/process conventions and resolve AGENTS.md self-contradictions

## Motivation

The sweep found process- and doc-level drift (not code behavior): commit
messages that break `AGENTS.md`, an internal contradiction in `AGENTS.md` about
logging, and a structural area the guide lists but the repo does not have. These
are cheap to fix and keep the guide trustworthy as the source of truth.

## Findings

### Commits violate the commit rules

`AGENTS.md` (Commits) says: _"Do not include prompt, LLM session, tool
co-authorship, or operational notes in the commit text"_, and English-only
applies to commit messages. The history has:

- ~35 commits carrying a `Co-Authored-By: Claude …` trailer (tool co-authorship).
- A few titles in Portuguese (e.g. `docs(readme): trocar o logo…`, `feat(tui):
layout de colunas configurável…`).

Rewriting history is destructive and out of scope; the fix is forward-looking:
**stop adding the trailer and keep titles/bodies in English** from now on. If the
team wants the history clean, that is a separate, explicit decision.

### AGENTS.md contradicts itself on logging

The Logs section mandates _"structured logs (`pino`)"_, while the Stack section
endorses the in-house `FileLogger` because _"the TUI cannot write to stderr"_ —
and `pino` is not a dependency. The code follows `FileLogger`; the guide should
say so instead of demanding `pino`. Reconcile the two sections (FileLogger is the
sanctioned logger; CLI commands still log human-readable text to stderr).

### `infra/` is listed but absent

`AGENTS.md` lists `infra/` as a top-level area. There is no infra yet. Either add
a placeholder with a README describing intent, or soften the guide to "when infra
exists" so the structure section matches reality.

## Design

- **Process:** adopt commit messages with no co-authorship trailer and
  English-only titles/bodies, per `docs/CONTRIBUTING.md`. Optionally add a commit
  hook or a CONTRIBUTING note that calls this out explicitly.
- **Docs:** edit `AGENTS.md` so the logging guidance names `FileLogger` as the
  sanctioned structured logger (with the stderr rationale) rather than `pino`,
  and adjust the `infra/` mention to match the current repo.

## Acceptance checklist

- [ ] New commits carry no tool co-authorship trailer and are English-only.
- [ ] `AGENTS.md` logging guidance is self-consistent (FileLogger, not pino) and
      matches the code.
- [ ] The `infra/` mention matches reality (placeholder added or wording softened).

## References

- `AGENTS.md` — Commits, Logs and observability, Project structure sections.
- `docs/CONTRIBUTING.md` — the commit/PR reference the guide points to.
- `src/utils/file-logger.ts` — the in-house logger the code actually uses.
