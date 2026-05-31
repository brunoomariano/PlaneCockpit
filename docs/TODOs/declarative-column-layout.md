# Declarative column layout

## Motivation

The issue list (`src/tui/issue-list.tsx`) already reflows responsively:
`issueColumns(width)` computes the TITLE width, decides whether STATE / ASSIGN
fit, and collapses PRIORITY to a single letter on narrow terminals. But every
width and the drop order are **hardcoded constants** (`KEY_WIDTH`,
`PRIORITY_WIDTH`, `STATE_WIDTH`, `ASSIGN_WIDTH`, `MIN_TITLE_WIDTH`).

`gh-dash` exposes the same idea as config: each column declares `width`, `grow`,
`align` and `hidden`. We have the rendering mechanics; we lack the config
surface. Formalising it turns this session's responsive work into a documented,
user-tunable feature instead of magic numbers.

## Design

Add an optional `layout` block per view (and/or a profile-level default). Columns
are keyed by a stable id: `key`, `priority`, `state`, `title`, `assign`.

```yaml
views:
  - name: My open
    layout:
      priority: { align: center, width: 10 }
      state: { hidden: true } # never show STATE in this view
      title: { grow: true } # absorb leftover width (recommend exactly one)
      assign: { width: 20 }
```

### Per-column options (mirror gh-dash)

| Option   | Type    | Default | Meaning                                                                |
| :------- | :------ | :------ | :--------------------------------------------------------------------- |
| `width`  | integer | per-col | Fixed width in characters (monospace). Minimum 1.                      |
| `grow`   | boolean | `title` | Column expands to fill leftover space. Recommend exactly one per view. |
| `align`  | enum    | `left`  | `left` \| `center` \| `right`.                                         |
| `hidden` | boolean | `false` | Omit the column entirely.                                              |

### Responsive behaviour stays

Config sets _intent_; the responsive solver still decides what fits. Order of
operations when the terminal is too narrow for all configured columns:

1. Honour `hidden: true` (never rendered).
2. Lay out configured fixed-width columns; let the `grow` column take the rest.
3. If the `grow`/TITLE column would fall below `MIN_TITLE_WIDTH`, drop optional
   columns in the documented order (STATE, then ASSIGN — see
   [action backlog rationale](README.md)), then collapse PRIORITY to its letter.

So a user can _pin_ or _hide_ columns, but can't force an overflow that wraps
rows — the solver still guarantees a readable title.

## Implementation sketch

- Extend `src/config/schema.ts` with a `ColumnLayout` Zod object and a
  `layout?: Record<ColumnId, ColumnLayout>` on the view schema.
- Refactor `issueColumns()` to take `(width, layout)` and seed its fixed widths /
  visibility from `layout`, falling back to today's constants.
- Thread `layout` from the active view through `Dashboard` → `IssueList`.
- Apply `align` via the existing `padCenter` / `padRight` helpers (add a
  `padLeft`/right-align helper as needed).
- Mirror the new keys in [`docs/CONFIGURATION.md`](../CONFIGURATION.md).

## Acceptance checklist

- [ ] `ColumnLayout` schema + view `layout` field, validated by Zod at load.
- [ ] `issueColumns()` consumes layout; current behaviour is the default when no
      `layout` is set (no visual change for existing configs).
- [ ] `hidden`, `width`, `align`, `grow` each have a unit test (table-driven).
- [ ] Responsive drop-order still guarantees `MIN_TITLE_WIDTH`; covered by a test
      at a narrow width with all columns configured.
- [ ] `docs/CONFIGURATION.md` documents the `layout` block and per-column options.
- [ ] The CLI table (`src/utils/formatting.ts`) reuses the same column ids where
      it makes sense, so CLI and TUI stay consistent.

## References

- gh-dash layout docs: `configuration/layout/options.mdx` (`grow`, `width`,
  `hidden`, `align`).
- gh-dash issues #671 (configurable logo/columns), #843 (more PR-view fields).
