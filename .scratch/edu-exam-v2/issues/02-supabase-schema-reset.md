# 02 — Supabase 基礎 schema 重置

**What to build:** 清空既有 Supabase 專案（`khkvqkbssngclojtxkuv`）裡舊系統（SQLAlchemy 時代）留下的資料表，重新設計基礎 schema：帳號與角色（對應五層角色：系統管理者/平台管理者/管理者/機構管理者/學員）、機構（可編輯的機構類別+機構名稱資料表，取代舊系統寫死的常數）。建立 RLS 的預設骨架（預設拒絕，逐步在後續工單開放）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 舊系統遺留的資料表已清空/移除
- [x] 新建的帳號/角色資料結構能表達五層角色，且角色是綁定在帳號上的固定屬性
- [x] 機構資料表可以新增/編輯/停用一筆機構類別+機構名稱的紀錄（先用 SQL 或 Supabase 後台手動驗證即可，UI 在工單 04 做）
- [x] 每張新建的資料表都已啟用 RLS，且預設政策是「無角色比對規則就一律拒絕」（避免忘記加政策而變成大家都能讀寫的漏洞）
- [x] Supabase 專案的 service role key 只存在於未提交 git 的本機/Secrets 環境變數中，不出現在任何前端程式碼
