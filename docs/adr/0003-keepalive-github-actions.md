# 0003: GitHub Actions 排程保活 Supabase 專案

## 狀態
已接受

## 背景
Supabase 免費專案連續 7 天沒有 API 活動會自動暫停（見 [0001](./0001-github-pages-supabase-over-flask-render.md)）。舊版系統曾用 `keepalive.py`（本機/長開機器上執行，每 10 分鐘呼叫一次 Render 網址）解決 Render 的休眠問題，但那支腳本解決的是不同的觸發原因（Render 閒置休眠），且需要一台自己控制、一直開著的機器來執行，不適合直接搬過來。

檢查過使用者另一個已上線的參考專案（`sd762/-`）的原始碼與 repo，沒有找到對應的保活機制（無 `.github/workflows`，`index.html` 內也沒有排程呼叫的程式碼），該專案的保活方式若存在，應是直接設定在 Supabase 後台（例如 pg_cron），對外部（repo）不可見。

## 決策
用 **GitHub Actions 排程工作流程**（`schedule` cron trigger）定期呼叫 Supabase REST API（例如對某張表做一次輕量 `select`），確保 7 天內一定有 API 活動。GitHub Actions 對排程工作流程免費（在免費方案分鐘數額度內，這種輕量任務用量可忽略不計），不需要額外服務或自己開機器。

## 後果
- 不需要使用者自己的電腦或另一台伺服器保持開機
- 需要在 GitHub repo 的 Secrets 中安全存放 Supabase 的 URL 與 anon key（或 service key，視呼叫的操作而定）供 workflow 使用
- 若 GitHub Actions 排程本身因故未觸發（GitHub 對排程 workflow 的觸發時間不保證精準，可能延遲），仍有極小機率超過 7 天觸發暫停；屆時只需手動到 Supabase 後台按「恢復」，資料不會遺失
