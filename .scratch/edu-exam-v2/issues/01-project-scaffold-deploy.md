# 01 — 專案骨架與部署管線

**What to build:** 一個可以實際部署上線、能被瀏覽器打開的空白起點——Vite + React + TypeScript 專案，套用 Tailwind + shadcn/ui，帶入清福長照集團的品牌識別（深紅 `rgb(187,27,33)` 用於品牌/按鈕，不用於及格/不及格狀態色），系統標題為「清福長照集團教育訓練測考系統」。GitHub repo 設為 Public，透過 GitHub Actions 自動建置並部署到 GitHub Pages。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 專案可在本機開發模式執行，畫面顯示品牌化的空白首頁（含系統名稱、品牌色）
      → 這份 checklist 一直沒同步勾選，但實際上這是最早完成的工單——本機 `npm run dev` 全程正常，之後 11 張工單都是在這個基礎上疊加
- [x] 推送到 main 分支後，GitHub Actions 自動建置並部署到 GitHub Pages，公開網址可直接打開看到同樣的畫面
      → 整個開發過程數十次推送到 main，每次都自動建置部署成功，正式網址 https://sd762.github.io/hok-training-exam/ 全程可用
- [x] Tailwind 設定檔中已定義品牌色變數，且與「及格/不及格/待審核」等狀態色（標準綠/紅/黃）明確分開，不共用同一組色票
      → `src/index.css` 的 `--color-brand-*`（深紅品牌色）與 `--color-status-*`（及格綠/不及格紅/待核對黃/存疑保留紫）分開定義，工單12報表另外加了 `--color-chart-*`（國籍類別色），三組色票互不共用
- [x] repo 中沒有任何 Supabase service role key 或其他敏感金鑰的痕跡（確認 `.gitignore` 涵蓋本機環境變數檔）
      → service role key 只存在於 Supabase Edge Function 的環境變數（Dashboard 設定，不進 repo）；前端 `.env` 只含公開的 URL/publishable key（設計上會出現在打包後的 JS，安全性由 RLS 保障），`.gitignore` 已排除 `.env`
