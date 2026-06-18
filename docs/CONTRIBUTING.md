# Contributing

This document consolidates the contribution guidelines for commits, the changelog, git tags, and pull requests in this repository.

## Commit Guidelines

- Use Conventional Commits.
- Write commit messages in English.
- Explain the change that was delivered, not the process used to produce it.
- Do not include prompts, LLM references, session IDs, or tool co-authorship.
- Sign commits with GPG whenever possible.

### Format

```text
<type>(<optional scope>): <short description>

<long description>
```

### Scope

- Use a scope when it helps locate the change.
- Prefer real project scopes: `api`, `config`, `settings`, `infra`, `docker`, `deps`, `tests`, `events-receiver`.
- Avoid generic scopes like `misc`, `stuff`, or `updates`.

### Description

- Use a short, objective sentence in the imperative mood.
- Start with a lowercase letter, except for proper nouns.
- Do not end with a period.
- Avoid filler terms like `tweaks`, `improvements`, `misc fixes`, or `wip`.

### Body

- Only use a body when the short description is not enough.
- Explain what changed, why it changed, and any relevant impacts.
- Do not list changed files without need.
- Version bump commits (`chore(release)`) are an exception and do not require a body.

### Breaking Changes

- Use `!` in the header when there is a contract break.
- Include a `BREAKING CHANGE:` footer explaining the migration.

Example:

```text
feat(api)!: change authentication contract

BREAKING CHANGE: clients must send the token in the Authorization header.
```

### Before Committing

- For code changes, prefer running `make ci`.
- If any check cannot be executed, state the reason when delivering the change.

## Changelog Guidelines

The repository keeps a `CHANGELOG.md` at the root in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, versioned with
the same SemVer rules as the git tags.

- A change that is visible to a user or operator (a new command, flag, key,
  config key, behavior, or a fix they would notice) adds an entry under the
  `[Unreleased]` section in the same commit that delivers it. Internal-only
  changes (refactors, tests, tooling) do not need an entry.
- Group entries under the Keep a Changelog headings: `Added`, `Changed`,
  `Fixed`, `Deprecated`, `Removed`, `Security`.
- Write entries in behavior language — what the user can now do or what no longer
  breaks — not in terms of files or functions. Keep the same English-only and
  no-process rules as commits (no prompts, LLM references, or session notes).
- Classify by impact the same way as tags: a new backward-compatible capability
  is a `MINOR` line, a fix is a `PATCH` line, a contract break is `MAJOR` and
  must be called out explicitly.
- At release time, the `chore(release)` commit renames `[Unreleased]` to the new
  `[X.Y.Z] - YYYY-MM-DD` section and re-adds an empty `[Unreleased]` above it.
  The released section is the source material for the annotated tag body (see
  `make tag_it` below); keep the two consistent rather than writing the tag from
  scratch.

## Git Tag Guidelines

- Use annotated tags.
- Write tag messages in English.
- Treat the text as a consolidated record of changes for the version.
- Do not turn the tag into a list of commits.
- Do not include prompts, LLM references, session IDs, or tool co-authorship.

### Name

- Use SemVer with a `v` prefix: `vMAJOR.MINOR.PATCH`.
- Examples: `v0.1.0`, `v1.4.2`, `v2.0.0`.

### Increment

- `MAJOR`: contract break.
- `MINOR`: new backward-compatible functionality.
- `PATCH`: fix or adjustment with no contract change.

### Content

- Group changes by theme.
- Use a narrative, deliberate style to describe the changes.
- Prioritize product, operational impacts, quality, and risks.
- Mention commands, environment variables, and migrations when they are required.
- Avoid hashes, PR IDs, and branch names if they do not help understand the version.
- Make contract breaks explicit.

### Suggested Structure

- `Summary`: short overview of the delivery.
- `Product`: endpoints, contracts, and API behavior.
- `Infrastructure`: Docker, mise, npm scripts, CI, and observability.
- `Quality`: tests, coverage, lint, type checking, and security.
- `Migration notes`: mandatory actions or `No migration actions`.

### Pre-release

- Use the `-beta.N` suffix while the project has not reached a stable release: `v4.0.0-beta.1`, `v4.0.0-beta.2`, etc.
- Only increment the `-beta.N` counter between releases of the same cycle.
- Advance `MINOR` or `MAJOR` when leaving the beta cycle (stable delivery or contract break).

### make tag_it

Do not use `git tag -a` directly. Use `make tag_it`.

The target is an interactive flow that:

- reads the version from `package.json` and derives the tag name (`vX.Y.Z-beta.N`);
- generates a temporary file with release metadata and the commits since the previous tag;
- opens a menu to create the tag, wait for manual edition of the body, or preview the draft;
- creates the annotated tag with the edited body and pushes it to the origin.

The generated body is a starting point — edit it before confirming, consolidating commits into a thematic narrative according to the content guidelines above.

```bash
make tag_it
git show v0.1.0-beta.1
```

## Pull Request Guidelines

Pull request descriptions should follow the structure below.

### Description

What changed and why. Focus on the delivered result, not the process.

### Related issues

`Closes #N` or `Related to #N`. Omit if there are none.

### Checklist

- [ ] `make ci` passed locally
- [ ] Migrations committed (if there is a model change)
- [ ] Tests added or adjusted for the change

### Notes

Design decisions, discarded alternatives, risks, or dependencies on other PRs. Omit if there are none.
