# 0007: 出題與評分交給 Supabase Edge Function，不在前端做

## 狀態
已接受

## 背景
承 [0001](./0001-github-pages-supabase-over-flask-render.md)，整體架構是純靜態前端直連 Supabase，沒有自架伺服器。但考試的正確答案若整包下載到瀏覽器交由前端 JavaScript 自行評分，具備基本技術能力的學員只要打開瀏覽器開發者工具檢視網路請求，就能直接看到正確答案——監考鏡頭（見 [0005](./0005-webcam-proctoring-soft-flag.md)）解決的是「代考」問題，解決不了「看到正解」這種作弊方式。舊版 Flask 系統因為評分在伺服器端執行（`exam_logic.py`），正確答案從未送到瀏覽器，不存在這個問題。

## 決策
出題快照與評分邏輯改用 **Supabase Edge Function** 執行（Supabase 代管的無伺服器函式，非自架伺服器，符合免維運的核心目標）：

1. 開始測驗時，前端呼叫 Edge Function 取得該次隨機抽出的 25 題快照——**只含題目與選項，不含正確答案**
2. 學員作答後，前端把選擇的答案送到 Edge Function
3. Edge Function 在伺服器端比對正解、計算分數，寫回資料庫（使用 service role，略過一般前端的 RLS 限制），回傳分數與及格與否給前端顯示
4. 正確答案（`answer_json`）全程不透過一般前端可讀取的 Supabase 資料表/API 暴露；只有 Edge Function 內部邏輯能存取

## 後果
- 維持「不需自架伺服器」的核心目標——Edge Function 是 Supabase 代管的服務，沒有自己要維運的主機
- 需要額外學習/撰寫 Edge Function（Deno runtime，TypeScript），比純前端直連資料庫多一層開發複雜度
- Supabase 免費方案的 Edge Function 呼叫次數有額度限制，需留意用量（**確切額度待查證，屬於待確認事項**）
- 題庫資料表本身的 RLS 政策需設計成「一般前端連線讀不到 `answer_json` 欄位或整張表」，只有 Edge Function 用的 service role 金鑰能存取完整題目資料

## 部署與除錯踩雷紀錄（2026-07-25，第一支 Edge Function `admin-users`）

- **Dashboard 建立函式時務必先打對名稱再貼程式碼**：Settings 頁面的「Name」欄位只是顯示用別名，**不會改變已建立的網址 slug**（畫面上寫著「Your slug and endpoint URL will remain the same」）。名稱打錯只能刪掉重建，沒有事後改名的路。
- **一定要處理 CORS**，否則瀏覽器呼叫時的 OPTIONS 預檢請求會被直接擋在網路層，函式程式碼完全不會被執行到；前端會收到一個不是正常 HTTP 回應的錯誤物件，症狀難以判讀（在這個專案上實際出現的訊息是 `context.json is not a function`，來自我方前端的錯誤處理程式碼假設「錯誤一定有 Response 可以 `.json()`」，這個假設本身就不成立，一併修正）。每支要給瀏覽器呼叫的 Edge Function 都需要：
  - `OPTIONS` 方法直接回一個帶 `Access-Control-Allow-*` 標頭的空回應
  - 其餘所有回應（含錯誤與例外）也都要帶同一組標頭，否則「函式回了但沒有 CORS 標頭」一樣會被瀏覽器擋下、呈現跟網路失敗一樣的症狀
  - 整個處理邏輯包一層 `try/catch`，避免未預期例外讓 Deno 回傳一個沒有 CORS 標頭的預設錯誤頁
- 「Verify JWT with legacy secret」建議關閉（Dashboard 自己的建議），因為函式內部已經自己驗證呼叫者身分（反查 `profiles.role`），不需要平台再疊一層不透明的 JWT 檢查。
