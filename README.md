# plane — CLI + TUI for Plane (Cloud and self-hosted)

`plane` is a terminal client for [Plane](https://plane.so), inspired by `gh` and `gh dash`.
It provides a fast CLI for daily operations on projects, issues (work items), and dashboards,
plus a TUI (`plane dash`) for visual exploration. It supports both Plane Cloud and Plane
self-hosted deployments behind reverse proxies, custom TLS, and custom headers.

## Install

The published package exposes a `plane` binary:

```bash
npm install -g plane-cli
# or
npx plane-cli --help
```

End users do not need `mise`; the published artifact is a plain Node binary.

## Quick start

1. Drop a config file at `~/.config/plane-cli/config.yaml` (or `~/.plane/config.yaml`).
   See [`examples/config.yaml`](examples/config.yaml). This file is safe to commit.

2. Authenticate:

   ```bash
   plane auth login
   ```

   The API key is prompted (masked) and stored at `~/.config/plane-cli/hosts.yaml`
   with `0600` permissions — separate from `config.yaml` so the latter can live in
   version control.

   For non-interactive use (CI), set `PLANE_API_KEY` instead.

3. Run:

   ```bash
   plane auth status
   plane project list
   plane issue list --view "Current sprint"
   plane dash
   ```

## Configuration

`plane` keeps two files apart, modeled after `gh`:

| File          | Purpose                                      | Safe to commit? |
| ------------- | -------------------------------------------- | --------------- |
| `config.yaml` | profiles, server URLs, views, cache settings | yes             |
| `hosts.yaml`  | API keys per host + profile (`chmod 0600`)   | **no**          |

The config file is YAML-first and validated with `zod`; invalid configs fail at
startup with the offending path.

Search order for `config.yaml`:

1. `--config <path>` flag
2. `~/.config/plane-cli/config.yaml`
3. `~/.plane/config.yaml`

`hosts.yaml` is always read from `~/.config/plane-cli/hosts.yaml`.

Environment variables override the YAML when present:

| Variable               | Effect                                            |
| ---------------------- | ------------------------------------------------- |
| `PLANE_BASE_URL`       | overrides `server.base_url` of the active profile |
| `PLANE_WORKSPACE_SLUG` | overrides `server.workspace_slug`                 |
| `PLANE_API_KEY`        | overrides the resolved API key (CI-friendly)      |
| `PLANE_TIMEOUT_MS`     | overrides `server.timeout_ms`                     |
| `PLANE_PROFILE`        | selects the active profile                        |

### API key resolution

In priority order:

1. `PLANE_API_KEY` env var.
2. Entry in `~/.config/plane-cli/hosts.yaml` (written by `plane auth login`).
3. Env var named by `profile.auth.api_key_env` (legacy fallback; `auth` is optional).

`plane auth logout` removes the stored entry for the active profile.

### Profiles

A single config can declare multiple environments (e.g. `production`, `staging`).
Switch per invocation with `--profile`:

```bash
plane --profile staging issue list
```

Or persist a new active profile:

```bash
plane profile use staging
```

### Self-hosted

`plane` normalizes trailing slashes, supports custom headers, configurable timeouts, and
relaxed TLS for self-hosted clusters behind a reverse proxy:

```yaml
server:
  base_url: https://plane.internal.company.com
  workspace_slug: acme
  timeout_ms: 10000
  headers:
    X-Forwarded-Proto: https
  tls:
    reject_unauthorized: false # only for internal CAs
```

## Cache

The cache is optional and pluggable. Providers:

- `memory` — in-process, the default.
- `sqlite` — local persistent cache, file at `~/.cache/plane-cli/cache.sqlite` by default.
- `redis` — shared cache (declare `cache.redis.url`).
- `noop` — disables caching entirely.

The CLI works fully without Redis. To bypass cache for a single invocation, pass
`--no-cache`.

Common subcommands:

```bash
plane cache status
plane cache warm
plane cache clear --prefix plane:acme:project
```

## Views

Declare views in YAML and reference them from the CLI or TUI:

```yaml
views:
  - name: "My open"
    project: ENG
    filters:
      assignee: me
      state_group: [unstarted, started]
    sort: priority
```

```bash
plane issue list --view "My open"
```

## TUI usage

`plane dash` opens a multi-panel dashboard.

### Keybindings

Press `?` inside the TUI to open the help modal — it lists every binding grouped
by context (Global, Issue list, Views, Filter, Help) and supports incremental
search by description, action id, or key.

Default bindings:

| Key                | Action                                 |
| ------------------ | -------------------------------------- |
| `?`                | toggle help modal                      |
| `j` / `k` / arrows | navigate the issue list                |
| `g` / `G`          | jump to top / bottom                   |
| `PgUp` / `PgDn`    | scroll one page                        |
| `[` / `]`          | switch view                            |
| `Enter`            | open issue detail modal (Markdown)     |
| `Esc` (in modal)   | close current modal back to list       |
| `o`                | open the selected issue in the browser |
| `r`                | refresh                                |
| `/`                | textual filter                         |
| `q`                | quit                                   |

Issue descriptions are stored as HTML on Plane and rendered inline with
Markdown formatting (headings, lists, code, links) by `marked-terminal`.

### Customizing keybindings

Drop a `~/.config/plane-cli/keybindings.yaml` file. Each entry maps an action id
to a key spec. See [`examples/keybindings.yaml`](examples/keybindings.yaml).

```yaml
list.next: down
list.prev: up
list.refresh: ctrl+r
global.help: "?"
```

The `?` modal flags overridden bindings with a green `*`.

## Logs

The TUI cannot print to stderr without corrupting the canvas, so `plane dash` writes
JSON Lines to `$XDG_STATE_HOME/plane-cli/log.jsonl` (default
`~/.local/state/plane-cli/log.jsonl`). Render errors caught by the React error boundary
go to the same file. Rotated to `log.jsonl.1` at ~1 MB.

```bash
plane log path        # print the log file path
plane log tail -n 100 # last 100 entries
plane log clear       # remove the file
plane --debug dash    # raise log level to debug for the next run
```

CLI commands (everything other than `dash`) continue to log to stderr via `pino`.

## Output formats

Every list / view command supports `--json`, `--yaml`, and `--limit`. `--debug` enables
verbose logging and full stack traces.

## Development

The dev toolchain is managed by [`mise`](https://mise.jdx.dev):

```bash
mise install        # node + pnpm versions pinned in mise.toml
make bootstrap      # install dev toolchain + project deps
make ci             # full pipeline: fmt-check + lint + typecheck + test-cov + build
```

Common targets:

| Target                   | Description                             |
| ------------------------ | --------------------------------------- |
| `make bootstrap`         | install dev toolchain and dependencies  |
| `make dev ARGS="..."`    | run the CLI from source                 |
| `make build`             | build the production bundle             |
| `make test`              | run unit tests                          |
| `make test-cov`          | run tests with coverage (95% threshold) |
| `make fmt` / `make lint` | format / lint                           |
| `make ci`                | full pipeline                           |
| `make clean`             | remove build artifacts                  |

Run `make help` for the full list.

## Troubleshooting

- **`api key not found`** — run `plane auth login` for the active profile, or export
  `PLANE_API_KEY` for non-interactive use.
- **`config validation failed`** — run `plane config validate` to see the offending path
  reported by `zod`.
- **TLS errors against self-hosted** — set `server.tls.reject_unauthorized: false` only
  if you intentionally use a private CA.
- **Stale data** — re-run with `--no-cache` to bypass the cache, or `plane cache clear`.

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for commit, tag, and PR guidelines.
