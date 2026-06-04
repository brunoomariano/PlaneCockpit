# Server-side search / filtering

## Motivation

Today both filter surfaces work on **already-fetched** rows:

- A view's `filters` are largely refined **client-side**. `state_group` is the
  only one passed as a server query param that this deployment honors; assignee,
  labels, priority and `state_search` are applied after fetching (see
  `IssuesService.list` and the `refineBy*` helpers). The per-project fetch still
  pulls up to `query_limit` (default 100) rows and filters them locally.
- The TUI `/` filter (the structured `key:value` query) only narrows the rows the
  active view already loaded.

That is fine for small projects but does not scale: on a large project the view
only ever sees the first page, so an issue matching the filter but sitting beyond
`query_limit` is invisible, and a free-text search across all issues is
impossible. Pushing the search to the server (where Plane can index it) makes the
filter authoritative over the whole project, not just the loaded page.

## Design

This is exploratory until the API surface is pinned — **do not invent the
endpoint shape**; capture it from the live instance first (see
[audit-self-hosted-payloads.md](audit-self-hosted-payloads.md) for the capture
approach). Likely pieces:

- **Confirm which query params the deployment actually honors.** The code already
  notes that this self-hosted Plane ignores `assignees` / `state_search`; re-check
  against the current release, because a server that filters by assignee/label/
  priority lets us drop the client-side refinement for those and trust the page.
- **A search endpoint for free text.** Plane exposes a workspace search; wire a
  `plc issue search <text>` (CLI) and/or feed the TUI `/` bar's bare-word terms to
  it, so a query reaches issues beyond the current page. Keep the structured
  tokens (`ass:`/`label:`/…) mapping to server filters where supported, falling
  back to the existing client-side refinement where not.
- **Pagination awareness.** When a filter is server-side the result is no longer
  bounded by a single page's `query_limit`; decide how the TUI presents "more
  results available" vs. the current "N of M loaded" count.
- Keep the client-side path as the fallback so the product still works against a
  deployment (or endpoint) that does not support a given server filter — never
  silently return fewer results than asked.

## Implementation sketch

- Capture real responses for the workspace/project search and the list endpoint's
  filter params from the live instance; record them (redacted) before coding.
- Extend `normalizeFilters` / `WorkItemsService.list` to send the confirmed params
  and stop refining those client-side; leave the unsupported ones on the client.
- Add a search path (CLI `issue search`, and optionally route the TUI bare-word
  terms) that queries the server and maps results to `Issue`.
- Surface "results may exceed the loaded page" in the TUI status bar.

## Acceptance checklist

- [ ] The honored server filter params are confirmed against the live instance
      and recorded; client-side refinement is dropped only for those.
- [ ] A free-text search reaches issues beyond the current page's `query_limit`.
- [ ] Unsupported filters still fall back to client-side refinement (no silent
      under-fetch).
- [ ] The TUI distinguishes "filtered the loaded page" from "searched the server".
- [ ] Tests: param mapping for the supported filters, the search result mapping,
      and the client-side fallback path.

## References

- `src/plane/issues.ts` / `src/plane/filters.ts` — current client-side refinement.
- `src/plane/work-items.ts` — the list query that already sends `state_group`.
- `src/tui/issue-query.ts` — the structured `/` filter to extend toward the server.
- [audit-self-hosted-payloads.md](audit-self-hosted-payloads.md) — the capture
  approach for confirming real API shapes.
