# 0004: 沿用現有 Supabase 專案，但整個重新設計 schema

## 狀態
已接受

## 背景
使用者的 Supabase 帳號目前已有專案掛在 https://supabase.com/dashboard/project/hefiqjothowaplhqaqbl 上（即舊版工作人員教育訓練測考系統目前的正式資料庫）。一個免費帳號最多只能掛 2 個免費專案，另一個名額已被清福技術考稽核系統佔用（見 [0001](./0001-github-pages-supabase-over-flask-render.md)）。

## 決策
2代沿用同一個 Supabase 專案（`hefiqjothowaplhqaqbl`），不申請新專案。舊的 SQLAlchemy 對應表結構整個廢棄重新設計——架構已經從「Flask 後端 + ORM」換成「前端直連 Supabase + RLS 權限控管」，表設計方式本來就不一樣，沒有沿用舊 schema 的理由。

## 後果
- **沿用舊專案需先開啟 Data API**（2026-07-25 實際踩到）：第一代是 Flask 後端直連 Postgres，完全不經過 Data API，該專案的 **Enable Data API 是關閉狀態**。前端直連架構必須開啟它，否則 PostgREST 沒有任何可公開的 schema，所有 `/rest/v1/` 請求都會回 `PGRST002 Could not query the database for the schema cache`——這個錯誤訊息不會提到「Data API 沒開」，且重啟專案、`notify pgrst, 'reload schema'` 都無效，實際線索只在 Logs 的 `schema "pg_pgrst_no_exposed_schemas" does not exist`。
- 不會超過免費帳號 2 個專案的上限
- 需要確認舊專案裡是否有需要保留的正式資料（真實學員名冊、考試紀錄等），若有需要先匯出備份再清空重建 schema——**待確認，見後續討論**
