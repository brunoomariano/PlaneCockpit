# Structured filter bar in the TUI (gh-dash-style `key:value`)

## Motivation

The TUI's `/` filter only matches issue title/key as a substring. gh-dash's
defining feature is a **structured filter bar** where you type `author:joe
is:open label:bug` and the list narrows live. Bringing a `key:value` mini-syntax
to the dashboard filter lets the user slice the already-loaded issues by
assignee, state, priority, label and project without editing the YAML view —
the single highest-value navigation upgrade for the dashboard.

## Design

Extend the existing `/` filter input to parse a small query language and refine
the loaded rows client-side (no refetch — it filters what `useViewsData` already
holds). Bare words keep their current meaning (substring match on title/key).

| Token     | Matches                                 | Example         |
| :-------- | :-------------------------------------- | :-------------- |
| `ass:`    | assignee display name / `me`            | `ass:joe`       |
| `state:`  | state name (substring)                  | `state:prog`    |
| `group:`  | state group                             | `group:started` |
| `prio:`   | priority                                | `prio:high`     |
| `label:`  | label name (substring)                  | `label:bug`     |
| `proj:`   | project identifier                      | `proj:ENG`      |
| bare word | title/key substring (current behaviour) | `login`         |

- Tokens combine with **AND**; repeating a key is an **OR** within that key
  (`label:bug label:ui` = bug OR ui). Matching is case-insensitive substring for
  names, exact for enums (group/priority/project).
- `ass:me` resolves against the current user (already available via the assignee
  flow). Unknown keys fall back to a bare substring match so a stray colon does
  not eat the query.
- Parsing and matching live in a **pure module** so they are unit-tested without
  the TUI; the filter box only feeds the raw string in.
- The status bar / filter box shows how many of N rows match, so an
  over-narrow query is obvious.

## Implementation sketch

- `src/tui/issue-query.ts` — `parseQuery(input)` → structured terms, and
  `matchesQuery(issue, terms, { meId })` → boolean. Pure, table-tested.
- Wire it into the dashboard's `filtered` memo, replacing the current substring
  filter (keeping bare-word behaviour as one term type).
- Resolve `me` once (reuse the users flow) and thread it into the matcher.
- Document the syntax in [`docs/CONFIGURATION.md`](../CONFIGURATION.md) and the
  README keybindings/usage section.

## Acceptance checklist

- [ ] `/` accepts `key:value` tokens and bare words, refining loaded rows live.
- [ ] `ass`, `state`, `group`, `prio`, `label`, `proj` filter as specified.
- [ ] Tokens AND across keys; repeated keys OR within a key.
- [ ] `ass:me` resolves to the current user.
- [ ] Unknown `key:` does not crash — it degrades to a substring match.
- [ ] The match count is visible so an empty result is not mistaken for "no data".
- [ ] Tests: `parseQuery` and `matchesQuery` table-driven, including combinations
      and `me` resolution.

## References

- gh-dash's filter bar — the inspiration for the syntax.
- `src/tui/dashboard.tsx` — the current substring `filtered` memo to replace.
- `src/plane/assignee-match.ts` / `state-group-match.ts` — existing client-side
  refinement helpers to mirror.
