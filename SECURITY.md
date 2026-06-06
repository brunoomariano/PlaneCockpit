# Security Policy

## Supported versions

Plane Cockpit is pre-1.0. Security fixes land on the latest published version
only; please upgrade before reporting.

| Version        | Supported |
| -------------- | --------- |
| latest release | ✅        |
| older          | ❌        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub's
[private vulnerability reporting](https://github.com/brunoomariano/PlaneCockpit/security/advisories/new)
(Security tab → "Report a vulnerability"). Include:

- a description of the issue and its impact,
- steps to reproduce (a minimal case helps),
- affected version and environment (Plane Cloud or self-hosted).

You can expect an acknowledgement within a few days. Once a fix is available we
will coordinate a disclosure timeline with you.

## Handling of credentials

Plane Cockpit talks to the Plane API with a per-host API key. A few invariants
the project upholds, useful context when assessing a report:

- API keys are stored in `~/.config/plane-cli/hosts.yaml`, written with `0600`
  permissions, kept separate from `config.yaml` so the latter is safe to commit.
- Secrets (`api_key`, `token`, `authorization`, …) are redacted by the file
  logger and masked by `plc config show`.
- There are no environment-variable overrides for credentials; everything is
  read from the two config files.
- The git history is scanned for committed secrets on every push and pull
  request (gitleaks); see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

If you find a path that leaks a key to logs, the terminal, the cache, or a
published artifact, that is in scope and we want to hear about it.
