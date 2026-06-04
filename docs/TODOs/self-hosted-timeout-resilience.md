# Resilience to slow self-hosted Plane (timeouts and degraded views)

## Motivation

Debug logs from a real self-hosted deployment (`plane.senfio.com.br`) show
repeated 10s `timeout` errors on the per-project issue fetch, with several
projects timing out on the same refresh. When that happens the view either shows
stale rows or an error, and the only signal is a status-bar message that is easy
to miss. The product already targets "self-hosted behind a reverse proxy", so it
should degrade gracefully when one project is slow instead of failing the whole
view.

## Design

- **Per-project failure isolation.** `IssuesService.list` currently uses
  `Promise.all`, so the first project to fail (or time out) rejects the whole
  merged set. Switch to a settle-and-merge strategy: return the projects that
  succeeded, and mark the view as **partial** with the names of the projects that
  failed.
- **Visible degraded state.** Show a clear "N of M projects failed" indicator in
  the navbar/status bar for a partial view, distinct from a clean empty view, so
  the user knows the data is incomplete rather than genuinely empty.
- **Timeout tuning.** Surface and document `server.timeout_ms` guidance for slow
  hosts, and consider a longer default just for the aggregate list fetch. Keep
  the existing retry policy (timeouts are not retried, by design).
- Do not silently swallow the failures — they must remain in the log with the
  project and URL, as they do today.

## Implementation sketch

- Replace `Promise.all` in `src/plane/issues.ts` `list()` with
  `Promise.allSettled` (or `mapWithConcurrency` capturing per-project results),
  merging the fulfilled sets and collecting the rejected project identifiers.
- Thread a `partial`/`failedProjects` signal through `useViewsData` into the
  navbar/status bar.
- Document `server.timeout_ms` tuning for slow self-hosted clusters in
  [`docs/CONFIGURATION.md`](../CONFIGURATION.md).

## Acceptance checklist

- [ ] A single project timing out no longer empties the whole view; the
      reachable projects still render.
- [ ] A partial view is visually distinct from a clean empty view and names the
      failed projects.
- [ ] Failures stay in the log with project + URL context.
- [ ] `server.timeout_ms` tuning for slow hosts is documented.
- [ ] Tests: partial-failure merge in `IssuesService.list` and the degraded
      indicator state.

## References

- `src/plane/issues.ts` — the `Promise.all` per-project fetch to make resilient.
- `src/tui/use-views-data.ts` — already isolates per-view errors; extend to
  per-project partials.
- `src/plane/client.ts` — timeout/retry policy (timeouts intentionally not retried).
