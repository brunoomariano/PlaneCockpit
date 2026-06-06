# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-06-05

First public release. CLI and TUI for Plane (Cloud and self-hosted): issues,
projects, dashboards, multi-profile config, pluggable cache, and a themeable
`ink` TUI. See the [README](README.md) for the full command surface.

### Added

- Packaging metadata for npm publishing (`repository`, `homepage`, `bugs`,
  `keywords`, `author`) and an MIT `LICENSE` file.
- `prepublishOnly` gate so every publish runs the full CI pipeline first.
- Secret scanning (gitleaks) wired into the CI pipeline and a GitHub Actions
  workflow that runs the quality gates on every push and pull request.
- Project documentation: `ARCHITECTURE.md`, `SECURITY.md`, this `CHANGELOG.md`,
  and issue / pull-request templates.

### Changed

- The published npm tarball no longer ships the source map (`dist/cli.js.map`),
  which embedded the full source.
- `AGENTS.md` logging guidance now names the in-house `FileLogger` instead of the
  absent `pino`, and the `infra/` mention reflects that the area does not exist
  yet.
- The `ci` script builds before running the test suite so the e2e tests no longer
  run against a stale binary.

[unreleased]: https://github.com/brunoomariano/PlaneCockpit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/brunoomariano/PlaneCockpit/releases/tag/v0.1.0
