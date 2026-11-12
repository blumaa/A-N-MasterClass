#!/usr/bin/env bash
# Run the CI verify job locally, the way GitHub runs it: a clean checkout of HEAD
# (no .env.local, no build cache) with only the env set in .github/workflows/ci.yml.
# Run before every push. Commit first: uncommitted changes are not checked.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
dir="$(mktemp -d)"
trap 'git -C "$root" worktree remove --force "$dir" >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT

git -C "$root" worktree add --detach "$dir" HEAD >/dev/null
cd "$dir"
pnpm install --frozen-lockfile --prefer-offline >/dev/null

# Same env as the CI verify job in .github/workflows/ci.yml (keep in sync), nothing else from this shell.
env -i PATH="$PATH" HOME="$HOME" PLATFORM_HOST=localhost DATA_SOURCE=fake CI=true pnpm verify
