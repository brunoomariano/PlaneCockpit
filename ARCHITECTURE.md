# Architecture

This is a map of how Plane Cockpit (the `plc` binary) is organized and why.
For the functional contract — config shape, command surface, domain language —
see [`docs/`](docs/) and [`AGENTS.md`](AGENTS.md), which remain the source of
truth. This document explains structure and boundaries, not behavior.

## Shape

Plane Cockpit is a TypeScript CLI + TUI on Node.js. One entry point (`cli.ts`)
parses arguments with `commander` and dispatches to commands; `plc dash` mounts
the `ink` TUI. Everything talks to Plane through a single thin HTTP adapter so
the rest of the code never touches `fetch` directly.

The guiding rule is a one-way dependency arrow:

```
commands / tui  →  domain (plane, config)  →  adapters (client, cache, fs, clock)
```

The domain does not depend on the HTTP transport, the cache driver, the terminal
renderer, or the real clock. Those are injected, which is what keeps the units
testable with local fakes.

## Layout

| Path               | Responsibility                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli.ts`       | argument parsing and command registration; the process entry point                                                                                    |
| `src/app.ts`       | composition root for the TUI (`plc dash`)                                                                                                             |
| `src/commands/`    | one folder per command group (`auth`, `issue`, `project`, `cache`, `config`, …); thin orchestration over the domain                                   |
| `src/plane/`       | the Plane domain + the API adapter (`client.ts`) and per-resource services (`issues.ts`, `work-items.ts`, `projects.ts`, `states.ts`, `labels.ts`, …) |
| `src/config/`      | YAML loading, the `zod` schema, profile/credential resolution                                                                                         |
| `src/cache/`       | the `CacheStore` interface and its backends (`memory`, `sqlite`, `redis`, `noop`)                                                                     |
| `src/tui/`         | `ink` components, hooks, and the theme system                                                                                                         |
| `src/keybindings/` | key-spec parsing and the dispatcher that routes keystrokes                                                                                            |
| `src/utils/`       | small cross-cutting helpers (logger, paths, html↔markdown, async, urls)                                                                               |
| `src/types/`       | shared domain types                                                                                                                                   |
| `src/tests/`       | integration / e2e tests (unit tests live next to their module as `*.test.ts`)                                                                         |

## Key boundaries

- **The Plane API client is isolated** behind `plane/client.ts` (a thin wrapper
  over native `fetch`). Per-resource services build on it; commands depend on the
  services, never on the transport. We deliberately do **not** depend on
  `@makeplane/plane-node-sdk` (it pulled a vulnerable `axios` transitively).
- **Cache is optional and pluggable** behind `CacheStore`. The CLI works fully
  with no cache (`noop`) and without Redis. TTLs for states/labels are a short
  fixed cap so freshly created entries reappear in pickers quickly.
- **Configuration is YAML-first**, read from a single path
  (`~/.config/plane-cli/config.yaml`, overridable with `--config`). Credentials
  live separately in `hosts.yaml`. There are no environment-variable overrides.
- **The TUI cannot write to stderr**, so structured logs go to a file via the
  in-house `FileLogger` (JSON Lines, secrets redacted). Human-facing CLI output
  is plain text.
- **Cancellation is explicit**: long-running flows, timers, and concurrent
  fetches use `AbortController` / `AbortSignal`.

## Resilience notes

- Multi-project views fetch each project independently
  (`IssuesService.listResilient`, `Promise.allSettled`) and report the ones that
  failed, so one slow project never empties the view.
- Read adapters tolerate the payload-shape variance observed on self-hosted Plane
  (array vs `{ results }`, expanded objects vs bare UUIDs, `null` fields); the
  observed shapes are recorded in
  [`docs/TODOs/audit-self-hosted-payloads.md`](docs/TODOs/audit-self-hosted-payloads.md).

## Build & distribution

`tsup` bundles `src/cli.ts` into a single ESM `dist/cli.js` with a Node shebang,
published to npm with a `bin` field (`plc`). `better-sqlite3` ships a prebuilt
native binding, so end users need no compiler. See the `ci` script in
`package.json` for the full quality pipeline and
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for the workflow.
