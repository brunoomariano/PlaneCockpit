# CLI: change state and labels from the command line

## Motivation

The CLI can edit title/description/priority (`plc issue edit`), assign
(`plc issue assign`) and comment, but it cannot **change an issue's state** or
**set its labels** — the two mutations only exist in the TUI today. Scripts and
CI pipelines (e.g. "move ENG-123 to Done when the PR merges", "tag triaged
issues") need these on the command line. The domain already supports both:
`issues.update` with `toApiBody` maps `state_id`/`label_ids` to the API fields.

## Design

Two focused subcommands, behaviour-named, mirroring the existing CLI style:

- `plc issue transition <key> <state>` — move an issue to a state. `<state>` is
  resolved against the issue's **project** states by name (case-insensitive) or
  id, via `StatesService`. An ambiguous/unknown name is a clear error listing the
  valid states.
- `plc issue label <key> [labels...]` — set the issue's labels (replace
  semantics, matching how the TUI multi-select works). Labels resolve against the
  project's labels by name or id via `LabelsService`. With no labels given,
  clears them; a `--add`/`--remove` variant can come later if needed.

Both print the resulting issue (respecting `--json` / `--yaml`) and fail loudly
with operational context (key, project, the invalid value, the valid set).

## Implementation sketch

- New subcommands in `src/commands/issue/index.ts` next to `edit`/`assign`.
- Resolve the issue's project (via the resolver already used by `issues.update`)
  to scope the state/label lookup; reuse `StatesService` / `LabelsService`.
- A small resolver helper `resolveStateByNameOrId` / `resolveLabelsByNameOrId`
  (pure, tested) that maps user input to ids and errors with the valid options.
- Call `ctx.issues.update(key, { state_id })` / `{ label_ids }`.

## Acceptance checklist

- [ ] `plc issue transition <key> <state>` moves the issue, resolving the state
      by name or id within the issue's project.
- [ ] `plc issue label <key> [labels...]` sets (replaces) the labels; no args
      clears them.
- [ ] Unknown/ambiguous state or label fails with the valid options listed.
- [ ] Both honour `--json` / `--yaml` output.
- [ ] Tests: name/id resolution (including unknown and ambiguous) and the
      resulting update payload.

## References

- `src/commands/issue/index.ts` — the `edit`/`assign` commands to mirror.
- `src/plane/states.ts`, `src/plane/labels.ts` — the per-project lookups.
- `src/plane/work-items.ts` — `toApiBody` already maps the domain fields.
