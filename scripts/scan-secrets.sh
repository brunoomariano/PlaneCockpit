#!/usr/bin/env bash
# Scan the full git history for committed secrets with gitleaks.
#
# Prefers a native `gitleaks` binary; falls back to the official Docker image.
# If neither is available, it warns and exits 0 so it never blocks a local
# `pnpm run ci` on a machine without the tool. The GitHub Action runs gitleaks
# unconditionally, so CI still enforces it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS_IMAGE="zricethezav/gitleaks:latest"

if command -v gitleaks >/dev/null 2>&1; then
  echo "scan-secrets: using native gitleaks ($(gitleaks version 2>/dev/null || echo '?'))"
  exec gitleaks detect --source="$REPO_ROOT" --redact --no-banner -v
fi

if command -v docker >/dev/null 2>&1; then
  echo "scan-secrets: using gitleaks via docker ($GITLEAKS_IMAGE)"
  exec docker run --rm -v "$REPO_ROOT:/repo" "$GITLEAKS_IMAGE" \
    detect --source=/repo --redact --no-banner -v
fi

echo "scan-secrets: neither gitleaks nor docker found; skipping (CI enforces this via GitHub Actions)." >&2
exit 0
