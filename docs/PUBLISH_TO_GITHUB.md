# 發布至 GitHub（8.6 開發基準）

已確認目標倉庫：`eattravel2024-ui/yj-fight`，目前為公開倉庫。
請確認五位人物肖像與插畫有權公開。

1. Mac 下載本壓縮檔並解壓縮。
2. 開啟 Terminal，`cd` 到 `azhi-fight` 專案資料夾（Finder 可拖曳資料夾進終端機補路徑）。
3. 若尚未設定 git 使用者名稱／email，先執行 `git config --global user.name "你的 GitHub 名稱"` 和 `git config --global user.email "你的 GitHub 郵箱"`。
4. 使用 GitHub CLI `gh auth login`（若已安裝），或使用 Mac 的 GitHub Desktop 管理登入。
5. `bash publish-to-github.sh`。此指令先檢查遠端分支是否為空，僅在空倉庫建立初版，不使用 `--force`。
6. 打開 https://github.com/eattravel2024-ui/yj-fight 確認有 `public/core.js`, `server.js`, `AGENTS.md`, `public/sprites/*.png`。
7. 在 Codex 開啟這個倉庫並閱讀 `AGENTS.md`、`docs/CODEX_STARTER.md`。

## 注意
- GitHub 原始碼與 VPS 是獨立環境；推送不等於部署。
- 公開倉庫中正式 IP 已替換為 `YOUR_VPS_IP`。
- 不要在 PR 中直接執行 VPS 部署命令。
- 本包不包含 GitHub 登入憑證；必須由你在自己的 Mac 上完成授權。
