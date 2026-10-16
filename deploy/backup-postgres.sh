#!/usr/bin/env bash
# Read-only database dump of this game's optional dedicated PostgreSQL container.
# No production deployment script calls this automatically.
set -Eeuo pipefail
umask 077
[[ $# -eq 1 ]] || { echo 'Usage: backup-postgres.sh PRIVATE_BACKUP_DIRECTORY' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker is required for this optional container backup' >&2; exit 1; }
DESTINATION=$1
[[ -d "$DESTINATION" && ! -L "$DESTINATION" ]] || { echo 'Use an existing private backup directory' >&2; exit 1; }
DESTINATION="$(cd "$DESTINATION" && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
ARCHIVE="$DESTINATION/azhi-$STAMP-$$.dump"
[[ ! -e "$ARCHIVE" && ! -e "$ARCHIVE.partial" ]] || { echo 'Backup target already exists' >&2; exit 1; }
trap 'rm -f -- "$ARCHIVE.partial"' EXIT
# Docker exec has no -t; the binary custom-format dump must remain unmodified.
# The local socket is available only inside this dedicated container.
docker exec azhi-db pg_dump --username=azhi_admin --dbname=azhi --format=custom --no-owner --no-privileges > "$ARCHIVE.partial"
[[ -s "$ARCHIVE.partial" ]] || { echo 'Database dump was empty' >&2; exit 1; }
docker exec -i azhi-db pg_restore --list < "$ARCHIVE.partial" >/dev/null
mv -- "$ARCHIVE.partial" "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
printf 'Database backup and checksum saved: %s\n' "$ARCHIVE"
