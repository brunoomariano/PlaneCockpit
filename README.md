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

1. Export your API key:

   ```bash
   export PLANE_API_KEY=plane_xxx
   ```

2. Drop a config file at `~/.config/plane-cli/config.yaml` (or `~/.plane/config.yaml`).
   See [`examples/config.yaml`](examples/config.yaml).

3. Run:

   ```bash
   plane auth status
   plane project list
   plane issue list --view "Current sprint"
   plane dash
   ```

## Configuration

`plane` is YAML-first. The schema is validated with `zod`; invalid configs fail at
startup with the offending path.

Search order:

1. `--config <path>` flag
2. `~/.config/plane-cli/config.yaml`
3. `~/.plane/config.yaml`

Environment variables override the YAML when present:

| Variable | Effect |
| --- | --- |
| `PLANE_BASE_URL` | overrides `server.base_url` of the active profile |
| `PLANE_WORKSPACE_SLUG` | overrides `server.workspace_slug` |
| `PLANE_API_KEY` | overrides the resolved API key |
| `PLANE_TIMEOUT_MS` | overrides `server.timeout_ms` |
| `PLANE_PROFILE` | selects the active profile |

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
    reject_unauthorized: false  # only for internal CAs
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

`plane dash` opens a multi-panel dashboard:

| Key | Action |
| --- | --- |
| `j` / `k` / arrows | navigate the issue list |
| `[` / `]` | switch view |
| `Tab` | toggle detail panel |
| `Enter` | open detail panel |
| `o` | open the selected issue in the browser |
| `r` | refresh |
| `/` | textual filter |
| `q` / `Esc` | quit |

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

| Target | Description |
| --- | --- |
| `make bootstrap` | install dev toolchain and dependencies |
| `make dev ARGS="..."` | run the CLI from source |
| `make build` | build the production bundle |
| `make test` | run unit tests |
| `make test-cov` | run tests with coverage (95% threshold) |
| `make fmt` / `make lint` | format / lint |
| `make ci` | full pipeline |
| `make clean` | remove build artifacts |

Run `make help` for the full list.

## Troubleshooting

- **`api key not found`** — the profile points to an env var that is not exported. Check
  `auth.api_key_env` in your config and export the value.
- **`config validation failed`** — run `plane config validate` to see the offending path
  reported by `zod`.
- **TLS errors against self-hosted** — set `server.tls.reject_unauthorized: false` only
  if you intentionally use a private CA.
- **Stale data** — re-run with `--no-cache` to bypass the cache, or `plane cache clear`.

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for commit, tag, and PR guidelines.
