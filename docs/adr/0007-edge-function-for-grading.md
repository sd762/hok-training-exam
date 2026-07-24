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
