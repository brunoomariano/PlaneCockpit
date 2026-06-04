# Code hygiene: unused exports, the strict deadcode gate, and small drift

## Motivation

A repo sweep surfaced low-cost hygiene debt that the CI gates do not catch today,
plus a quality gate that is wired but never run (and currently red). None of it
breaks the product, but it is exactly the kind of drift `AGENTS.md` asks to keep
out (DRY, explicit types, TSDoc on exports, no dead code).

## Findings

### The strict deadcode gate is red and not in CI

`make check KIND=quality` runs `lint && deadcode:strict` (full `knip`), and the CI
runs only `deadcode` (`knip --include files,dependencies`). The strict run fails
with unused exports/types, so the `quality` gate is effectively dead:

- `PRIORITIES` — `src/tui/issue-field-options.ts` (used internally; export not needed)
- `TITLE_COLUMN_WIDTH` — `src/utils/formatting.ts`
- `QueryKey` (type) — `src/tui/issue-query.ts`
- `SelectOutcome` (type) — `src/tui/select-modal.tsx`
- `ThemeColor`, `PriorityColors` (types) — `src/tui/theme/tokens.ts`
- `ViewData` (interface) — `src/tui/use-views-data.ts`
- `ColumnLayout` (interface) — `src/types/views.ts`

### A duplicated magic number

`STATES_LABELS_TTL_SECONDS = 300` in `src/config/defaults.ts` duplicates
`DEFAULT_CACHE_TTL_SECONDS = 300`. The cache-TTL plan called for deriving the
states/labels TTL from the configured `cache.ttl`; it was hardcoded instead. Pick
one: derive it (and keep the per-field cap as a `Math.min`), or document why a
fixed constant is intentional.

### Exports missing TSDoc / explicit return types

`AGENTS.md` asks every exported symbol to carry a short TSDoc and domain code to
use explicit types. A few drift from that — notably `findView` in `src/app.ts`
(no TSDoc and an inferred return type). The fields-only types under `src/types/`
are fine per the "types declare only fields" rule but still want a one-line doc.

## Design

- Demote the unused exports to module-private, or delete them where nothing will
  consume them; keep an export only when a test or another module truly needs it.
- Decide the deadcode policy: either make `deadcode:strict` pass and add it to the
  CI pipeline, or drop the `quality`/`deadcode:strict` scripts so there is no red
  gate pretending to be green. Do not leave a gate that no one runs.
- Replace the duplicated TTL constant with a derived value (or a documented
  decision), removing the magic-number duplication.
- Add the missing TSDoc and an explicit return type to `findView`; sweep the
  other exported symbols for one-line docs where they aid the contract.

## Acceptance checklist

- [ ] `deadcode:strict` passes, and either runs in CI or the unused `quality`
      scripts are removed (no red gate outside CI).
- [ ] No duplicated TTL magic number; the states/labels TTL is derived or its
      fixed value is documented as intentional.
- [ ] `findView` has a TSDoc and an explicit return type; obvious export-doc gaps
      are filled.
- [ ] `make ci` stays green.

## References

- `AGENTS.md` — DRY, explicit types, TSDoc on exports, no dead code.
- `package.json` — `deadcode` vs `deadcode:strict` vs `quality` scripts.
- `src/config/defaults.ts` — the duplicated TTL constant.
