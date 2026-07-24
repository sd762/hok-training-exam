# 0014: Repo 設為 Public，以使用免費 GitHub Pages

## 狀態
已接受

## 背景
GitHub Pages 免費方案只支援 Public repo；Private repo 要用 GitHub Pages 需升級付費方案（GitHub Pro，約 US$4/月）。目前舊系統 `sd762/Employee-Education-and-Testing` 是 Private repo，但參考專案 `sd762/-`（清福技術考稽核系統）是 Public repo，這也是它能免費用 GitHub Pages 的原因。

## 決策
2 代的 repo 設為 **Public**。真正敏感的資料（學員名單、考試紀錄、監考快照）都存在 Supabase 資料庫裡（受 RLS 政策保護），不會出現在 GitHub repo 裡；repo 裡只有前端程式碼與 Edge Function 邏輯，公開並不會洩漏員工個資。

## 後果
- 維持整體方案完全免費（US$0/月），不需要升級 GitHub Pro
- **絕對不能**把 Supabase 的 service role key（可繞過 RLS、擁有完整資料庫存取權的金鑰）寫進前端程式碼或提交進這個 public repo——只能設定在 Edge Function 的環境變數/Secrets 裡（Supabase 專案本身的環境變數，不進 git）；前端只能使用 anon key（受 RLS 限制）
- GitHub Actions 排程呼叫 Edge Function 用的 Secrets（見 [0003](./0003-keepalive-github-actions.md)）也要留意只放必要的、受限範圍的金鑰，不要誤放 service role key 到 GitHub Actions 的 log 輸出中
- 程式碼公開後，任何人都能看到系統的業務邏輯與 RLS 政策設計（如果政策寫在遷移檔裡一併公開），需要在設計 RLS 政策時假設「政策本身的邏輯是公開的」，安全性要建立在「金鑰保密」而非「邏輯保密」上
