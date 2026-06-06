# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-06-06

### Fixed

- The list status bar now reports `0 of N` when a filter matches nothing, instead
  of an empty count that read as "no data".

### Changed

- Internal: the Dashboard was decomposed from a single container into per-feature
  hooks (`useTerminalSize`, `useIssueFilter`, `useQuickTransition`,
  `useDetailPanel`) with the overlay precedence and key routing isolated; no
  user-facing behavior change.
- CI: branch and release-tag rulesets, and environment-independent end-to-end
  tests (isolated config, width-robust assertions) so the suite is deterministic.

## [0.1.0] - 2026-06-05

First public release. Plane Cockpit (`plc`) is a CLI and TUI for Plane, for both
Cloud and self-hosted deployments. See the [README](README.md) for the full
command surface and [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) for every
config option.

### CLI

- Manage authentication per profile, storing the API key in a separate
  `hosts.yaml` with `0600` permissions (`plc auth login` / `logout` / `status`).
- List and view projects, and list, view, and open issues by key (`ENG-123`).
- Create issues interactively or headlessly, with the body read from a file or
  stdin; comment on an issue inline, from a file, or interactively.
- Edit an issue's title, description, and priority; assign it (including `me`);
  transition its state and set its labels by name or id; delete it behind a
  confirmation guard.
- Inspect and switch profiles, inspect/warm/clear the cache, and locate, tail, or
  clear the TUI log.
- JSON output on mutating commands, showing resolved names instead of raw ids.

### TUI (`plc dash`)

- Interactive dashboard on the alternate screen buffer, responsive to terminal
  size, with per-view data, live counts, and a resilient auto-refresh on a
  configurable interval.
- Create, edit (state, assignee, priority, title, description, labels), comment
  on, and quick-transition issues (`>` / `<`) without leaving the dashboard, with
  named confirmations and in-place row patching.
- A structured `key:value` filter bar over the loaded rows and a scrollable issue
  detail modal with Markdown rendering.
- Configurable keybindings with a help modal, a themeable palette (semantic color
  tokens with built-in presets), and a configurable per-view column layout.
- Graceful degradation against a slow Plane instance instead of an empty view.

### Configuration & Plane adapter

- YAML-first config validated with `zod`, with multiple profiles, multi-project
  views, multi-level sort, and client-side filters (assignee, state group,
  state search).
- A published JSON Schema generated from the Zod config for editor autocomplete.
- A thin, isolated Plane API client over native `fetch`: per-attempt timeouts,
  trailing-slash paths to avoid 301 redirects, URL path-segment encoding to
  prevent path injection, and read adapters hardened against self-hosted payload
  variance across Plane releases.
- A pluggable cache (`memory`, `sqlite`, `redis`, `noop`) with a short dedicated
  TTL for states and labels so freshly created entries appear quickly.

### Fixes of note

- Persist issue descriptions via `description_html` (a plain `description` was
  silently dropped by the API).
- Send the API field names when updating an issue, and resolve the current user
  through the shared members normalizer.
- Explain auth and network failures in client errors instead of opaque messages.
- Several TUI rendering fixes: preserve list selection across refresh, lock the
  detail modal height, re-open ANSI styles across wrapped lines, and stop the
  browser launcher from corrupting the dashboard.

### Project & release hygiene

- npm packaging metadata (`repository`, `homepage`, `bugs`, `keywords`,
  `author`), an MIT `LICENSE`, and a `prepublishOnly` gate running the full CI.
- The published tarball no longer ships the source map (`dist/cli.js.map`), which
  embedded the full source.
- GitHub Actions running the quality pipeline and a gitleaks secret scan over the
  whole history on every push and pull request.
- Project documentation: `ARCHITECTURE.md`, `SECURITY.md`, this `CHANGELOG.md`,
  issue / pull-request templates, Dependabot, `.editorconfig`, and `.nvmrc`.

[unreleased]: https://github.com/brunoomariano/PlaneCockpit/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/brunoomariano/PlaneCockpit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/brunoomariano/PlaneCockpit/releases/tag/v0.1.0
