# STAGE 04 — 立法院

預期原圖：`立法院議場對決舞台.png`。本次對話附圖沒有同步成可存取的檔案；目前資料夾沒有該 PNG，不以其他地圖或重新生成的圖片代替。

取得原圖後，於專案根目錄執行：

```bash
python3 tools/import_legislature_stage.py /實際路徑/立法院議場對決舞台.png
npm run check
npm test
node --test test/browser/phase4.test.cjs
```

匯入完成後重新啟動開發伺服器並重新整理瀏覽器。工具保留原始 PNG，產生完整 WebP、640×360 內等比預覽、背景專用降噪版及 SHA-256／尺寸 manifest，最後才啟用 registry。場景為單層、固定 960×540 世界、地面 Y=448、出生點 274／686。啟用後選圖、最後一關、VS、戰鬥與伺服器隨機場景使用同一資料來源。配樂暫用現有原創 `stage_fur_lab`，沒有宣稱為新作立法院配樂。
