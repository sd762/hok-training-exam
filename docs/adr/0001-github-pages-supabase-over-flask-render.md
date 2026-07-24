# 0001: GitHub Pages + Supabase 取代 Flask + Render

## 狀態
已接受

## 背景
舊版系統([sd762/Employee-Education-and-Testing](https://github.com/sd762/Employee-Education-and-Testing))用 Flask 伺服器部署在 Render 免費方案上。Render 免費方案的容器閒置一段時間會休眠，下次連線時會啟動一個全新容器，導致 `seed.py` 重新執行，管理者密碼、學員資料、考試紀錄全部被重置回初始狀態。要避免這個問題需升級付費方案（約 US$7.25/月）。

## 決策
改用純靜態前端（部署在 GitHub Pages）+ Supabase（Postgres + Auth）作為後端，前端直接透過 `supabase-js` 呼叫，不再有自架伺服器。這個模式參考使用者另一個專案 [sd762/-](https://github.com/sd762/-)（清福技術考稽核系統），該專案已長期在 Supabase 免費方案上穩定運作。

## 後果
- 沒有伺服器可以休眠，徹底消除「休眠喚醒清空資料」的問題
- Supabase 免費專案有自己的限制：連續 7 天無 API 活動會自動暫停（資料不會遺失，但需手動在後台恢復）→ 見 [0003](./0003-keepalive-github-actions.md)
- 一個 Supabase 帳號最多同時掛 2 個免費專案，使用者的兩個系統（本系統 + 清福技術考稽核系統）剛好各佔一個名額，之後若要開新的免費專案會超額
- 整體維運成本為 US$0/月
