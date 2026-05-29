# Plane Cockpit — CLI + TUI for Plane (Cloud and self-hosted)

Plane Cockpit is a terminal client for [Plane](https://plane.so), inspired by `gh` and `gh dash`,
distributed as a `plc` binary.
It provides a fast CLI for daily operations on projects, issues (work items), and dashboards,
plus a TUI (`plc dash`) for visual exploration. It supports both Plane Cloud and Plane
self-hosted deployments behind reverse proxies, custom TLS, and custom headers.

## Install

The published package exposes a `plc` binary:

```bash
npm install -g plc-cli
# or
npx plc-cli --help
```

End users do not need `mise`; the published artifact is a plain Node binary.

## Quick start

1. Drop a config file at `~/.config/plane-cli/config.yaml`.
   See [`examples/config.yaml`](examples/config.yaml). This file is safe to commit.

2. Authenticate:

   ```bash
   plc auth login
   ```

   The API key is prompted (masked) and stored at `~/.config/plane-cli/hosts.yaml`
   with `0600` permissions — separate from `config.yaml` so the latter can live in
   version control.

   For a config file that carries the key directly, set `auth.api_key` under the
   profile instead.

3. Run:

   ```bash
   plc auth status
   plc project list
   plc issue list --view "Current sprint"
   plc dash
   ```

## Configuration

Plane Cockpit keeps two files apart, modeled after `gh`:

| File          | Purpose                                      | Safe to commit? |
| ------------- | -------------------------------------------- | --------------- |
| `config.yaml` | profiles, server URLs, views, cache settings | yes             |
| `hosts.yaml`  | API keys per host + profile (`chmod 0600`)   | **no**          |

The config file is YAML-first and validated with `zod`; invalid configs fail at
startup with the offending path.

For the complete list of options — server, auth, defaults, cache, and every view
filter and its accepted values — see [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

`config.yaml` is read from a single location (after the `--config <path>` flag,
which overrides it):

`~/.config/plane-cli/config.yaml`

`hosts.yaml` is always read from `~/.config/plane-cli/hosts.yaml`.

All configuration lives in these two files — there are no environment variable
overrides. The active profile can be selected per invocation with `--profile`.

### API key resolution

In priority order:

1. `auth.api_key` inline in `config.yaml`.
2. Entry in `~/.config/plane-cli/hosts.yaml` (written by `plc auth login`).

`plc auth logout` removes the stored entry for the active profile.

### Profiles

A single config can declare multiple environments (e.g. `production`, `staging`).
Switch per invocation with `--profile`:

```bash
plc --profile staging issue list
```

Or persist a new active profile:

```bash
plc profile use staging
```

### Self-hosted

Plane Cockpit normalizes trailing slashes, supports custom headers, configurable timeouts, and
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
- `sqlite` — local persistent cache, file at `~/.cache/plc/cache.sqlite` by default.
- `redis` — shared cache (declare `cache.redis.url`).
- `noop` — disables caching entirely.

The CLI works fully without Redis. To bypass cache for a single invocation, pass
`--no-cache`.

Common subcommands:

```bash
plc cache status
plc cache warm
plc cache clear --prefix plc:acme:project
```

## Views

Declare the universe of projects once under `defaults.projects`, then declare
views in YAML and reference them from the CLI or TUI:

```yaml
defaults:
  # The universe of projects this profile can reach. The TUI scans all of them
  # by default; the CLI (`plc issue list` without `--project`) uses the first.
  projects: ["ENG", "OPS", "DESIGN"]

views:
  - name: "My open" # no `projects` => scans every project above
    filters:
      assignee: me
      state_group: [unstarted, started]
    sort: priority

  - name: "Eng sprint"
    projects: ["ENG"] # restricts to a subset of defaults.projects
    filters:
      cycle: current # cycle/module are only allowed on single-project views
      state_group: [started]
```

```bash
plc issue list --view "My open"
```

A view without `projects` inherits the full `defaults.projects` set and
aggregates issues across all of them, reordered by the view's `sort`. A view
with `projects` restricts to that subset, which must be contained in
`defaults.projects`. Because `cycle` and `module` identify a single project,
they may only be used on views that resolve to exactly one project.

The full list of filters (`assignee`, `state_group`, `labels`, `priority`,
`cycle`, `module`) and their accepted values is documented in
[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md#filters).

## TUI usage

`plc dash` opens a multi-panel dashboard.

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

Inside the detail modal, the same `j`/`k`/arrows/`PgUp`/`PgDn`/`g`/`G`
bindings scroll the Markdown description; `o` opens the issue in the
browser; `Esc` closes back to the list.

Issue descriptions are stored as HTML on Plane and rendered inline as
Markdown by a small custom renderer (headings, lists, code, links,
blockquotes, strikethrough).

### Customizing keybindings

Drop a `~/.config/plc/keybindings.yaml` file. Each entry maps an action id
to a key spec. See [`examples/keybindings.yaml`](examples/keybindings.yaml).

```yaml
list.next: down
list.prev: up
list.refresh: ctrl+r
global.help: "?"
```

The `?` modal flags overridden bindings with a green `*`.

## Logs

The TUI cannot print to stderr without corrupting the canvas, so `plc dash` writes
JSON Lines to `$XDG_STATE_HOME/plc/log.jsonl` (default
`~/.local/state/plc/log.jsonl`). Render errors caught by the React error boundary
go to the same file. Rotated to `log.jsonl.1` at ~1 MB.

```bash
plc log path        # print the log file path
plc log tail -n 100 # last 100 entries
plc log clear       # remove the file
plc --debug dash    # raise log level to debug for the next run
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

- **`api key not found`** — run `plc auth login` for the active profile, or set
  `auth.api_key` inline under the profile.
- **`config validation failed`** — run `plc config validate` to see the offending path
  reported by `zod`.
- **TLS errors against self-hosted** — set `server.tls.reject_unauthorized: false` only
  if you intentionally use a private CA.
- **Stale data** — re-run with `--no-cache` to bypass the cache, or `plc cache clear`.

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for commit, tag, and PR guidelines.
