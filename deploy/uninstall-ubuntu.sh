#!/usr/bin/env bash
set -Eeuo pipefail
# Remove only the 7.1 Nginx+systemd service. Keep app dir for possible troubleshooting.
(( EUID == 0 )) || { echo '需 root'; exit 1; }
systemctl disable --now azhi71 2>/dev/null || true
rm -f /etc/systemd/system/azhi71.service
systemctl daemon-reload
if [[ -f /etc/nginx/conf.d/azhi71.conf ]];then
 mv /etc/nginx/conf.d/azhi71.conf /etc/nginx/conf.d/azhi71.conf.disabled
 if nginx -t;then systemctl reload nginx;else
   mv /etc/nginx/conf.d/azhi71.conf.disabled /etc/nginx/conf.d/azhi71.conf
   echo 'Nginx 測試失敗，已復原新版設定'; exit 1
 fi
fi
echo '已停用 azhi71，沒有修改原本 6.9 或其他站台。遊戲檔案保留於 /opt/azhi71。'
