# Multi-level sort

## Motivation

A view's `sort` is a single field today (`priority | updated_at | created_at |
name`), applied client-side over the merged multi-project set in
`src/plane/sort-issues.ts`. There is no way to declare a secondary key: the only
tie-breaker is the order projects were queried in, which falls out of the stable
sort by accident rather than by intent.

Real triage wants more than one key at once — e.g. group by project, then by
priority, then by where the issue sits in its workflow, then by recency. This
item turns `sort` into an ordered list of `field: direction` keys and gives the
profile a sensible global default so existing single-key views keep working.

## Design

`sort` becomes an **ordered list** of single-key maps. The list reads
top-to-bottom: the first key is the primary sort, each following key breaks ties
of the ones above it. Every key carries an explicit direction.

```yaml
views:
  - name: "Triage"
    sort:
      - project: asc # group by project identifier (A→Z)
      - priority: desc # urgent first within each project
      - state: asc # backlog → … → cancelled within each priority
      - updated_at: desc # most recently touched first within each state
```

This is backward compatible by accepting the legacy scalar form too: `sort:
priority` is read as `[{ priority: desc-by-default-for-that-field }]` (see
default directions below), so configs that predate this change do not break.

### Sortable fields

| Field        | Sorts by                                                | Natural / default direction |
| :----------- | :------------------------------------------------------ | :-------------------------- |
| `project`    | `project_identifier` (alphabetical)                     | `asc`                       |
| `priority`   | urgent → high → medium → low → none (existing rank)     | `desc` (urgent first)       |
| `state`      | workflow group: backlog → unstarted → started → completed → cancelled | `asc`     |
| `created_at` | creation timestamp                                      | `desc` (newest first)       |
| `updated_at` | last-update timestamp                                   | `desc` (newest first)       |
| `assign`     | first assignee's `display_name`; unassigned issues last | `asc`                       |

`name` is intentionally **dropped** as a sort key: alphabetical-by-title is
rarely the relevant order when project, priority, state and recency exist. (It
stays available as the in-TUI text filter, which is a different feature.)

#### Direction semantics

- `asc` / `desc` are accepted per key.
- `priority` `desc` means urgent → none (the high-urgency end first); `asc`
  reverses it. The internal `PRIORITY_RANK` already encodes urgent=0, so `asc` on
  the rank is "urgent first" — the comparator must invert when the key is `desc`,
  not the other way round. Document the user-facing meaning, not the rank.
- `state` `asc` follows the lifecycle order in the table (a fixed
  `STATE_GROUP_RANK`, mirroring `PRIORITY_RANK`), not the state's name.
- `assign`: unassigned issues sort **after** all assigned ones regardless of
  direction (they are a "no value" bucket, pinned last), and the assigned ones
  order by first-assignee `display_name` per the direction.

### Global default

A profile-level `defaults.sort` supplies the order for any view that does not
declare its own `sort`. A view's `sort`, when present, **replaces** the default
wholesale (no merging of keys — simpler to reason about).

```yaml
defaults:
  projects: ["ENG", "OPS"]
  sort:
    - project: asc
    - priority: desc
    - state: asc
    - updated_at: desc
```

If neither the view nor `defaults` declares `sort`, the same four-key order
above is the built-in fallback baked into the comparator, so the documented
global default holds even for a config that sets nothing.

## Implementation sketch

- **Schema** (`src/config/schema.ts`): replace `sortEnum` with a
  `sortKeyEnum` (`project`, `priority`, `state`, `created_at`, `updated_at`,
  `assign`) and a `sortSpecSchema` = array of single-key maps
  `{ <field>: "asc" | "desc" }`. Accept the legacy scalar via a Zod union that
  normalises it to the list form. Validate that each map has exactly one key.
- **Types** (`src/types/views.ts`, `src/types/config.ts`): `sort?: SortKey[]`
  on the view; add `defaults.sort?: SortKey[]`. A `SortKey` is
  `{ field: SortField; direction: "asc" | "desc" }` after normalisation.
- **Comparator** (`src/plane/sort-issues.ts`): turn `sortIssues` into a
  chained comparator that walks the key list and returns on the first non-zero
  comparison. Add `STATE_GROUP_RANK` next to `PRIORITY_RANK`. Keep the sort
  stable so equal-on-all-keys issues retain query order. Export the built-in
  `DEFAULT_SORT` constant for the fallback.
- **Resolution** (`src/plane/issues.ts`): resolve the effective sort once as
  `view.sort ?? defaults.sort ?? DEFAULT_SORT` and pass it to `sortIssues`.
- **Server hint** (`src/plane/work-items.ts:141`): `order_by` only takes one
  field. Send the **first** key's field as the per-project `order_by` (best
  effort); the client-side chained sort is authoritative for the merged set.
  Drop the param when the first key has no server equivalent (`project`,
  `state`, `assign`).
- **Docs**: rewrite the `sort` row and add a "Multi-level sort" subsection in
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md); update
  [`examples/config.yaml`](../../examples/config.yaml) with a multi-key view.
  Regenerate `schema/config.schema.json` (`pnpm run gen:schema`).

## Acceptance checklist

- [ ] `sort` accepts an ordered list of `{ field: direction }` maps, validated by
      Zod, with the legacy scalar form still parsing.
- [ ] `defaults.sort` sets the profile default; a view's `sort` replaces it
      wholesale; absent both, the built-in
      `project asc, priority desc, state asc, updated_at desc` applies.
- [ ] `name` is rejected as a sort key (clear validation error pointing at it).
- [ ] Chained comparator returns on the first differing key and is stable on full
      ties; table-driven tests cover each field, both directions, and tie-break
      cascades.
- [ ] `state` sorts by workflow group rank, `priority` `desc` puts urgent first,
      `assign` pins unassigned issues last in either direction — each has a test.
- [ ] `created_at` / `updated_at` honour direction; `project` sorts by
      `project_identifier`.
- [ ] Per-project `order_by` sends the first key's field when it has a server
      equivalent and is omitted otherwise.
- [ ] `docs/CONFIGURATION.md` and `examples/config.yaml` document the list form,
      per-field default directions, and the global default; JSON Schema
      regenerated and the CI drift gate passes.

## References

- Current single-field sort: `src/plane/sort-issues.ts`, `sortEnum` in
  `src/config/schema.ts`.
- Stable-sort tie-break behaviour relied on today: `src/plane/issues.ts`
  (`perProject.flat()` order) and the `Array.prototype.sort` note in
  `sort-issues.ts`.
- Related config-surface items: [declarative-column-layout.md](declarative-column-layout.md).
