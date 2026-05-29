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

All configuration lives in these two files — there are **no environment variable
overrides**. The only runtime selector is the `--profile` flag, which picks the
active profile for a single invocation.

> **Note:** the on-disk directory is `plane-cli` (not `plc`), kept for stability
> while the binary rename settles. State and cache live elsewhere
> (`~/.local/state/plane-cli/`, `~/.cache/plane-cli/`).

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

The recommended path is `plc auth login`, which writes the key to `hosts.yaml`.
The only `auth` field is an inline key, for cases where a private config file
holds the key directly.

| Field     | Type   | Notes                                                         |
| --------- | ------ | ------------------------------------------------------------- |
| `api_key` | string | the API key inline (prefer `hosts.yaml` via `plc auth login`) |

API key resolution order: `auth.api_key` (inline) → `hosts.yaml` entry.

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

| Field         | Type                                                 | Required | Notes                                                                    |
| ------------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `name`        | non-empty string                                     | yes      | shown in the TUI navbar and used by `--view`                             |
| `projects`    | list of strings                                      | no       | absent ⇒ inherits `defaults.projects`; present ⇒ a subset                |
| `filters`     | **Filters** (see below)                              | no       | narrows the issue set                                                    |
| `sort`        | `priority` \| `updated_at` \| `created_at` \| `name` | no       | server-side per project; merged set re-sorted client-side                |
| `query_limit` | positive integer                                     | no       | caps the API fetch per project; does **not** cap state_search refinement |

A view with `projects` must reference identifiers that exist in
`defaults.projects`. In the CLI this is a hard error; in the TUI invalid
projects are ignored and the view is flagged with a red `*`.

#### Filters

All filter fields are optional and combine with AND.

| Filter                 | Type                             | Accepted values                                             |
| ---------------------- | -------------------------------- | ----------------------------------------------------------- |
| `assignee`             | string or list                   | user identifier(s); `me` for the current user               |
| `state_group`          | list                             | `backlog`, `unstarted`, `started`, `completed`, `cancelled` |
| `labels`               | list of strings                  | label names                                                 |
| `priority`             | list                             | `urgent`, `high`, `medium`, `low`, `none`                   |
| `cycle`                | string                           | cycle identifier — **single-project views only**            |
| `module`               | string                           | module identifier — **single-project views only**           |
| `state_search`         | list of strings                  | state names matched by slug; refines all projects           |
| `project_state_search` | list of `{ name, state_search }` | per-project state-name search                               |

`cycle` and `module` identify a single project, so they are rejected on a view
that resolves to more than one project.

##### State search

`state_search` and `project_state_search` refine results **client-side** by
state name — the Plane API only filters by `state_group`, so these run over the
issues already fetched. Names are matched by slug (lowercased, whitespace
removed), so `"In Review"`, `"in review"`, and `"InReview"` are equivalent.

They combine by **union**: an issue from a project listed in
`project_state_search` is kept if its state matches the global `state_search`
**or** that project's list. An issue from a project not listed falls back to the
global list only (and passes through untouched if there is no global list).
Unlike `cycle`/`module`, these are allowed on multi-project views.

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

  # Multi-project view with client-side state refinement.
  - name: "Critical bugs"
    projects: ["ENG", "OPS"]
    filters:
      labels: [bug]
      priority: [urgent, high]
      state_search: ["In Review"] # applies to ENG and OPS
      project_state_search:
        - name: ENG
          state_search: ["Blocked"] # ENG also keeps "Blocked"
    query_limit: 50
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
