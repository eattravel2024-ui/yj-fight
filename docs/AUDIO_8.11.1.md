# 原創 OST 與 Audio Manager — 8.11.1

日期：2026-10-16（UTC+8）。基準 Phase 2／`8088cc2`。使用者明確授權本次獨立音訊整合；沒有新增完整任務／選圖頁、第四張地圖，沒有開始其他 Phase 3–5 功能或操作正式 VPS。

## 來源與格式

`BIG_TALK_OST_21_tracks.zip` 已可在工作區讀取，大小 5,402,615 bytes。46 個來源檔案均逐位元組與 ZIP 核對：21 段 OGG、21 份 MIDI、原始 manifest／CSV／README／音樂提示詞。全部保留於 `assets/source-audio/ost/`，不將附件文件文字當成開發指令。

原 OGG 為 Vorbis、24kHz、雙聲道，合計 5,451,894 bytes。`public/audio/ost/` 包含 21 個原封不動的 OGG 與 21 個 96kbps AAC／M4A 備援，合計 13,690,781 bytes；沒有新作曲、拉伸、改音高或覆寫原檔。MIDI 保留作編曲來源，不在瀏覽器額外加入 MIDI 合成器。

`public/audio/manifest.json` 是安全整理後的 runtime 清單；`assets/source-audio/ost/asset-manifest.json` 記錄各來源、衍生檔、SHA256、bytes、時長與聲道。重建使用 `python tools/build_ost.py`，作者環境需 FFmpeg／ffprobe；工具驗證來源路徑，原圖／音檔不覆寫，來源或衍生 hash 改變才重建 AAC。VPS 部署使用已備好的音檔，不需要額外工具。

## 21 首對應

| track ID | 現有用途／接口 |
| --- | --- |
| `menu` | 主選單、房間等待、設定／說明 |
| `character_select` | Phase 2 選角頁 |
| `mission_select` | 街機模式關閉選單、尚未開始比賽的既有任務待戰畫面；另有未來任務頁接口 |
| `stage_select` | 未來選圖頁接口與設定內試聽，目前沒有正式選圖頁 |
| `stage_night_market` | `night`：嘴砲夜市戰鬥 |
| `stage_casino` | `garage`：金沙賭城戰鬥 |
| `stage_square` | `harbor`：天安門廣場戰鬥；保留原曲名「廣場坦克戰場」 |
| `stage_fur_lab` | `fur_lab` 音樂映射與試聽；絨毛禁區地圖尚不存在 |
| `training` | 自由練習；優先於地圖音樂 |
| `final_boss` | 街機最後一關；優先於地圖音樂 |
| `results` | 本機／線上／觀戰的正式比賽結束；回房間時仍沿用 |
| `credits` | 未來製作名單接口與試聽，目前沒有新增製作名單頁 |
| `vs` | 有登場倒數的新比賽；與既有倒數銜接播放前 0.85 秒 |
| `round_start` | 實際登場倒數結束／新回合開始，每回合一次；中途觀戰不補播 |
| `ko` | 有倒地選手的回合結束，最長 1.6 秒，讓後續勝敗短曲清楚 |
| `victory` | 正式結果為自己／自己隊伍勝利；觀戰採勝方慶祝短曲 |
| `defeat` | 正式結果為自己／自己隊伍敗北；平手不冒充勝敗 |
| `intro_azhi` | 真正上場角色 `azhi`：阿志登場 |
| `intro_saizi` | 真正上場角色 `sezi`：塞子登場；明確處理 manifest ID 差異 |
| `intro_gambler` | 真正上場角色 `gambler`：金沙賭神登場 |
| `intro_winnie` | 真正上場角色 `winnie`：維尼登場 |

四首場景曲都可使用，但實際三張地圖只自動觸發前三首。不能將準備第四首配樂說成已加入第四張地圖。設定的 OST 清單能完整試聽全部 21 首，試聽短曲會播完整原檔，不受 VS／KO 播報長度限制。

## 管理與事件

`audio-manager.js` 建立單一 Web Audio context 與 master／BGM／SFX 音量匯流排；現有按鈕音、拳腳打擊合成音也走共同 SFX bus，不留繞過音量滑桿的舊 context。`audio-director.js` 負責目前場景與比賽事件；戰鬥引擎沒有依賴它。

- 首次可信點擊／按鍵內才建立／resume context；自動連線觀戰只記錄想播的 BGM，不強行自動播放，也不累積過期短曲。
- BGM 依 manifest 的 `kind`／`loop`，同一 desired ID 重複請求不重播；以 generation token 防止慢載入的舊場景蓋掉新場景。300ms 交叉淡化，最多兩個正在交接的 BGM 音源。
- 短曲以 match ID／round／事件 key 去重，播報、登場、KO、勝敗與試聽分通道；離開場景、換比賽或切背景會取消過期通道。短曲播放期間降低 BGM 音量，結束後恢復。
- 線上 KO 只接 confirmed `frames`／`watch_frame` 事件；勝敗只接 `match_complete`／正式觀戰完成。本機使用實際引擎事件。不能由 canvas redraw、預測擊倒或 rollback replay 重播 KO／勝敗。
- 選單重繪／500ms UI refresh 不重新建立播放器。回合開始只由倒數狀態跨界觸發一次；晚加入觀戰不重播舊 VS／登場。
- 預載選單／選角與短曲，以及下一場景需要的音樂；不預先解碼全部長曲。encoded 資料與解碼 promise 共用，PCM 快取最多 10 首／約 32MiB，活動音源另持有必要 buffer。
- 優先 OGG，抓取／解碼失敗則 AAC。兩者都失敗時保留遊戲與可用音訊，顯示可重試狀態；重繪不無限重抓。manifest 本身失敗也可按重試恢復，不必重整遊戲。
- 音量／總開關保存於 `azhi_audio_v1`，同步既有音效開關，保留 `azhi70_save` 進度。背景分頁暫停 context，回前景恢復；BFCache 往返保留已授權的 context，真正離頁時清理。

## 設定與未來接口

遊戲設定可調 BGM／SFX 各 0–100%、總開關、手動啟用、重試與 21 首試聽。設定試聽不會被相同面板的 refresh 蓋掉，離開設定會回到正常場景音樂。

後續頁面可使用：

```js
// 只能在真實使用者操作內要求解鎖；瀏覽器可能拒絕未授權播放。
await window.AzhiAudio.unlock();
window.AzhiAudioDirector.setScene('stage_select');
// 或使用相同頁面的場景事件。
window.dispatchEvent(new CustomEvent('azhi:audio-scene', {
  detail: { scene: 'mission_select' }
}));
window.AzhiAudio.preload(['stage_fur_lab']);
```

這些是音樂接口，不賦予畫面切換、選圖、戰鬥數值或線上權限。

## 驗證與保護

- `npm run check` 通過，`npm test` **190 通過、0 失敗／略過**。
- 新音訊瀏覽器 **5 項通過**：42 檔實際解碼／MIME／非靜音雙聲道；解鎖／獨立音量／保存／AAC 備援／背景暫停／去重；四角色與真實回合／KO／勝敗；四個真實網路客戶端及晚加入觀戰；手機布局與所有媒體失敗時仍可操作戰鬥。最後相關 UI／任務待戰路由重跑通過，不重複加總。
- 既有相關瀏覽器回歸 **9 項通過**：1v1＋唯讀觀戰、手機技能、經典冒險，以及完整 6 項 Phase 2 選角。沒有宣稱本次另跑整套 42 項瀏覽器套件。
- Node 驗證包含音樂載入競態、同 ID 不重啟、事件去重、過期取消、AAC／完全失敗與重試、音量與背景恢復、storage／AudioContext 不可用，以及 manifest 失敗後恢復。
- 原 21 個保護檔案中 **20 個逐位元組不變**；`server.js` 僅新增 `.ogg`／`.m4a`／`.mid` 的靜態 MIME 對應，保護 hash 已明確更新。伺服器房間、輸入驗證、60Hz、核心、Rollback、碰撞、數值、角色動作、攝影機與現有地圖都未變。
- 原始 46 個附件檔案直接與 ZIP 比對成功。沒有執行正式部署，也未宣稱實體 iPhone／硬體喇叭逐曲驗聽或專業無縫母帶處理。

截圖：`coverage/audio-settings-8111.png`、`coverage/audio-settings-mobile-8111.png`。內容需要時可在設定對話框內捲動。

## 交付

沿用 `feat/arcade-phase1`，固定檢查點 `checkpoint-audio-8.11.1`，不合併 main。手動部署見 [MANUAL_RELEASE.md](MANUAL_RELEASE.md)，前版可固定 `checkpoint-phase2-8.11.0` 回退。建議先試聽音量與場景切換，再審閱合併；任務／選圖頁與第四張地圖仍是後續工作。
