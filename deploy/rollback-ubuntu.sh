#!/usr/bin/env bash
# Restore latest 7.1 app directory from upgrade-ubuntu.sh backup.
set -Eeuo pipefail
[[ ${EUID:-99} -eq 0 ]] || { echo '需要 root';exit 1; }
shopt -s nullglob
arr=(/opt/azhi71.backup.*)
[[ ${#arr[@]} -gt 0 ]] || { echo '找不到 /opt/azhi71.backup.* 備份';exit 1; }
BACKUP="$(printf '%s\n' "${arr[@]}" | sort -r | head -n1)"
[[ -f "$BACKUP/server.js" && -f "$BACKUP/package.json" ]] || { echo '備份不完整';exit 1; }
echo "將以 $BACKUP 還原 /opt/azhi71（只會短暫中斷 azhi71 服務）。"
read -r -p '輸入 YES 確認：' answer
[[ "$answer" == YES ]] || exit 1
systemctl stop azhi71
mv /opt/azhi71 "/opt/azhi71.rollback.terminal.$(date +%Y%m%d_%H%M%S)"
mv "$BACKUP" /opt/azhi71
systemctl start azhi71
systemctl is-active --quiet azhi71
echo '完成，已還原上一版。'
