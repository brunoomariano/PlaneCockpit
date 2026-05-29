# Configuration reference

Complete reference for every Plane Cockpit configuration option. The
authoritative source is the Zod schema in
[`src/config/schema.ts`](../src/config/schema.ts); this document mirrors it.

For a ready-to-edit starting point, see
[`examples/config.yaml`](../examples/config.yaml).

## Files

Plane Cockpit keeps configuration and credentials in separate files, modeled
after `gh`:

| File          | Purpose                                       | Safe to commit? |
| ------------- | --------------------------------------------- | --------------- |
| `config.yaml` | profiles, server URLs, defaults, cache, views | yes             |
| `hosts.yaml`  | API keys per host + profile (`chmod 0600`)    | **no**          |

### Search paths

`config.yaml` is read from a single canonical location:

`~/.config/plane-cli/config.yaml`

The `--config <path>` flag overrides it. There is no secondary fallback path, so
there is no ambiguity about which file is loaded.

`hosts.yaml` is read from `~/.config/plane-cli/hosts.yaml` (written by
`plc auth login`).

> **Note:** the on-disk directory is `plane-cli` (not `plc`), kept for stability
> while the binary rename settles. State and cache live elsewhere
> (`~/.local/state/plane-cli/`, `~/.cache/plane-cli/`).

## Environment variable overrides

When present, these override the YAML of the active profile:

| Variable               | Effect                                       |
| ---------------------- | -------------------------------------------- |
| `PLANE_PROFILE`        | selects the active profile                   |
| `PLANE_BASE_URL`       | overrides `server.base_url`                  |
| `PLANE_WORKSPACE_SLUG` | overrides `server.workspace_slug`            |
| `PLANE_TIMEOUT_MS`     | overrides `server.timeout_ms`                |
| `PLANE_API_KEY`        | overrides the resolved API key (CI-friendly) |

## Top-level structure

```yaml
active_profile: production # must reference an existing profile
profiles:
  production: { ... } # see "Profile" below
  staging: { ... }
```

| Field            | Type                      | Required | Notes                                         |
| ---------------- | ------------------------- | -------- | --------------------------------------------- |
| `active_profile` | string                    | yes      | must match a key under `profiles`             |
| `profiles`       | map of name → **Profile** | yes      | at least the `active_profile` must be defined |

## Profile

```yaml
server: { ... } # required
auth: { ... } # optional
defaults: { ... } # optional
cache: { ... } # optional
views: [...] # optional
```

### `server` (required)

| Field                     | Type              | Required | Default | Notes                                            |
| ------------------------- | ----------------- | -------- | ------- | ------------------------------------------------ |
| `base_url`                | URL string        | yes      | —       | Plane Cloud or self-hosted base URL              |
| `workspace_slug`          | string            | yes      | —       | workspace slug                                   |
| `timeout_ms`              | positive integer  | no       | `30000` | request timeout in milliseconds                  |
| `headers`                 | map string→string | no       | —       | extra HTTP headers (e.g. behind a reverse proxy) |
| `tls.reject_unauthorized` | boolean           | no       | `true`  | set `false` only for internal CAs                |

```yaml
server:
  base_url: https://plane.internal.company.com
  workspace_slug: acme
  timeout_ms: 10000
  headers:
    X-Forwarded-Proto: https
  tls:
    reject_unauthorized: false
```

### `auth` (optional)

The recommended path is `plc auth login`, which writes to `hosts.yaml`. `auth`
is a backwards-compatible fallback for driving the CLI purely from environment
variables (e.g. CI).

| Field         | Type   | Notes                                                  |
| ------------- | ------ | ------------------------------------------------------ |
| `api_key_env` | string | name of an env var holding the API key                 |
| `api_key`     | string | the API key inline (avoid; prefer `hosts.yaml` or env) |

API key resolution order: `PLANE_API_KEY` → `hosts.yaml` entry →
`auth.api_key_env` → `auth.api_key`.

### `defaults` (optional)

| Field      | Type            | Notes                                                                |
| ---------- | --------------- | -------------------------------------------------------------------- |
| `projects` | list of strings | the profile's project universe (project identifiers, e.g. `["ENG"]`) |

The TUI scans all of `defaults.projects` by default; the CLI
(`plc issue list` without `--project`) uses the first one.

```yaml
defaults:
  projects: ["ENG", "OPS", "DESIGN"]
```

### `cache` (optional)

| Field              | Type                                      | Required | Default                           | Notes                               |
| ------------------ | ----------------------------------------- | -------- | --------------------------------- | ----------------------------------- |
| `provider`         | `memory` \| `sqlite` \| `redis` \| `noop` | yes      | —                                 | cache backend                       |
| `ttl`              | non-negative integer                      | no       | `300`                             | cache entry lifetime in seconds     |
| `sqlite_path`      | string                                    | no       | `~/.cache/plane-cli/cache.sqlite` | file path for the `sqlite` provider |
| `redis.url`        | string                                    | yes\*    | —                                 | required when `provider: redis`     |
| `redis.key_prefix` | string                                    | no       | —                                 | prefix for all cache keys in Redis  |

```yaml
cache:
  provider: sqlite
  ttl: 300
  sqlite_path: ~/.cache/plane-cli/cache.sqlite # default if omitted
  redis:
    url: redis://localhost:6379
    key_prefix: plc
```

### `views` (optional)

A list of named views. Each view selects a set of issues across one or more
projects.

| Field      | Type                                                 | Required | Notes                                                     |
| ---------- | ---------------------------------------------------- | -------- | --------------------------------------------------------- |
| `name`     | non-empty string                                     | yes      | shown in the TUI navbar and used by `--view`              |
| `projects` | list of strings                                      | no       | absent ⇒ inherits `defaults.projects`; present ⇒ a subset |
| `filters`  | **Filters** (see below)                              | no       | narrows the issue set                                     |
| `sort`     | `priority` \| `updated_at` \| `created_at` \| `name` | no       | server-side per project; merged set re-sorted client-side |
| `limit`    | positive integer                                     | no       | max issues; applied to the aggregated total               |

A view with `projects` must reference identifiers that exist in
`defaults.projects`. In the CLI this is a hard error; in the TUI invalid
projects are ignored and the view is flagged with a red `*`.

#### Filters

All filter fields are optional and combine with AND.

| Filter        | Type            | Accepted values                                             |
| ------------- | --------------- | ----------------------------------------------------------- |
| `assignee`    | string or list  | user identifier(s); `me` for the current user               |
| `state_group` | list            | `backlog`, `unstarted`, `started`, `completed`, `cancelled` |
| `labels`      | list of strings | label names                                                 |
| `priority`    | list            | `urgent`, `high`, `medium`, `low`, `none`                   |
| `cycle`       | string          | cycle identifier — **single-project views only**            |
| `module`      | string          | module identifier — **single-project views only**           |

`cycle` and `module` identify a single project, so they are rejected on a view
that resolves to more than one project.

```yaml
views:
  # No `projects`: inherits defaults.projects, aggregates across all of them.
  - name: "My open"
    filters:
      assignee: me
      state_group: [unstarted, started]
    sort: priority

  # Restricts to one project, so cycle/module are allowed.
  - name: "Current sprint"
    projects: ["ENG"]
    filters:
      cycle: current
      state_group: [started]

  # Multi-project view.
  - name: "Critical bugs"
    projects: ["ENG", "OPS"]
    filters:
      labels: [bug]
      priority: [urgent, high]
    limit: 50
```

## Validation

The config is validated with Zod at startup. Objects are **strict**: an unknown
field fails the load with the offending path. Invalid enum values, wrong types,
and an `active_profile` that does not match any profile are all reported with
the path to the problem.

## Related

- [`examples/config.yaml`](../examples/config.yaml) — annotated example
- [`examples/keybindings.yaml`](../examples/keybindings.yaml) — TUI keybindings
- [`README.md`](../README.md) — install, quick start, and usage
