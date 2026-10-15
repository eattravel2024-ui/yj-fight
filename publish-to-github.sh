#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
REMOTE="https://github.com/eattravel2024-ui/yj-fight.git"
if [[ "${1:-}" != "--prepare-only" ]]; then
  command -v git >/dev/null || { echo 'Please install Git first.' >&2; exit 1; }
  echo "Connecting to $REMOTE to verify that the repository is empty..."
  remote_heads="$(git ls-remote --heads "$REMOTE")" || { echo 'GitHub connection failed. Check network, repo URL, or Git authentication.' >&2; exit 1; }
  if [[ -n "$remote_heads" ]]; then
    echo 'Remote GitHub repository has branches. Refusing to overwrite an existing repo.' >&2
    exit 1
  fi
fi
if [[ ! -d .git ]]; then git init; fi
if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
  echo 'Git identity missing. Example:' >&2
  echo '  git config --global user.name "Your GitHub name"' >&2
  echo '  git config --global user.email "you@example.com"' >&2
  exit 1
fi
git branch -M main
git add .
if ! git diff --cached --quiet; then git commit -m 'chore: import Azhi Fighting 8.6 Codex baseline'; fi
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "$REMOTE"; fi
if [[ "${1:-}" == "--prepare-only" ]]; then
  echo 'Local git commit ready. Run again without --prepare-only on a machine with GitHub access.'
  exit 0
fi
if [[ "$(git remote get-url origin)" != "$REMOTE" ]]; then
  echo 'Unexpected existing origin; refusing to push.' >&2
  exit 1
fi
git push -u origin main
printf '\nPublished: https://github.com/eattravel2024-ui/yj-fight\n'
