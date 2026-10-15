# 阿志向錢衝 8.6 — 玩家命名／房間命名／觀戰姓名

## 本版變更

- 1v1：進入「好友對戰」輸入個人暱稱，進房後會在血量 HUD 與對手名單顯示玩家名稱，並可按「更新暱稱」。
- 2v2：在 `/team.html` 建立／加入前輸入暱稱。玩家席位、血量 HUD 與角色頭頂均顯示玩家暱稱；角色名字依然分開顯示。
- 觀戰：從 `/team.html?room=ROOM&watch=1` 可以自訂觀戰名稱，觀眾名單與席次列表分離；觀眾不會改變對戰數值。
- 房間名稱：建立房間時可填寫 2–24 字自訂名稱；第一個加入的選手是房主，只有房主能改房間名稱。房主離開時會移交給剩下的第一位選手。
- 名稱限制：2–16 字，中英文、數字、空格、底線、句點、連字號；不能重名；拒絕特殊控制符號與常見官方名稱；修改頻率 1.5 秒內不可重複。舊客戶端如果沒有送暱稱，伺服器仍可產生預設名稱。
- 本地暱稱：使用 `localStorage` 儲存 `azhi_player_nickname`，1v1、2v2共用；不代表登入或具備保護身分的能力。
- 60Hz 及 Rollback 計算資料未改變，姓名只存在房間 roster 訊息，不參與狀態 hash。

## VPS 更新（與 8.5 同一服務／Port）

在 Mac：

```bash
scp ~/Downloads/*8.6*.zip root@YOUR_VPS_IP:/tmp/azhi86.zip
ssh root@YOUR_VPS_IP
```

在 VPS：

```bash
unzip -tq /tmp/azhi86.zip
mkdir -p /tmp/azhi86-deploy
unzip -q /tmp/azhi86.zip -d /tmp/azhi86-deploy
bash /tmp/azhi86-deploy/azhi71/deploy/upgrade-ubuntu.sh --check
# 檢查通過後，安排無比賽時段（目前對局會斷線）：
bash /tmp/azhi86-deploy/azhi71/deploy/upgrade-ubuntu.sh
curl -fsS http://127.0.0.1:31071/healthz
```

預期回傳 `"version":"8.6.0"`。前端繼續使用 `/team.html` 及首頁的 1v1 模式，Nginx 18071 保持不變。更新會先備份 `/opt/azhi71`，只重新啟動 `azhi71.service`。**未驗證你的 VPS 實際環境，執行前務必先 `--check`。**

## 更新後手動驗收清單

1. 兩位玩家開 1v1 房，填不同暱稱，確認雙方血量 HUD 顯示名稱；中途改名後同步更新。
2. 四位玩家開 2v2 房，查看席位、HP HUD、角色頭頂是否都顯示新名稱。
3. 房主改名與更改房間名稱，其餘選手應即時看見；非房主不能修改房名。
4. 觀眾選擇自訂暱稱並中途加入，玩家和觀眾應看到名單；觀眾無法出招。
5. 相同暱稱／違規字元應提示錯誤、不得加入或修改。
6. 雙方再戰後姓名／房名應保留，同場 60Hz 延遲與回滾值維持可觀測。
7. 正常登出再加入相同房間時，瀏覽器應記住上次暱稱。

## 其他仍待實作的事項

本次「暱稱」不含帳號、密碼、排行榜；訪客可以改名，**不具身分驗證**。目前也沒有重連保席、房間密碼／邀請 token、全員 Ready；完整改善建議參見 `AUDIT_8.6_全面健檢.md`。
