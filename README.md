# 清福長照集團教育訓練測考系統

清福長照集團旗下機構員工的教育訓練測考系統，取代第一代的 Flask + Render 版本
（[sd762/Employee-Education-and-Testing](https://github.com/sd762/Employee-Education-and-Testing)）。

**線上網址**：https://sd762.github.io/hok-training-exam/

## 架構

| 層 | 技術 | 說明 |
|---|---|---|
| 前端 | Vite + React + TypeScript + Tailwind v4 | 純靜態，部署於 GitHub Pages |
| 資料庫／認證／檔案 | Supabase（Postgres / Auth / Storage） | 專案代號 `hefiqjothowaplhqaqbl` |
| 業務邏輯 | Supabase Edge Functions | 出題、評分、到期通知（避免正解外洩到瀏覽器） |
| 排程 | GitHub Actions cron | 每日觸發到期通知，同時保活 Supabase 免費專案 |

沒有需要自行維運的伺服器，整體維運成本 US$0/月。
架構決策的完整理由見 [docs/adr/](docs/adr/)，規格書與工單見 [.scratch/edu-exam-v2/](.scratch/edu-exam-v2/)。

## 功能總覽（2026-07-26）

系統內建「使用說明」頁（登入後導覽列最右邊，依角色只顯示相關段落），這裡只列重點，供開發時快速定位對應的 feature 資料夾：

| 角色 | 功能 |
|---|---|
| 學員 | 應考提醒、25題隨機抽題作答（含音訊題/圖片題）、鏡頭監考、多語言介面、及格/不及格結果、重考與鎖定 |
| 機構管理者 | 自己機構的學員狀況、分析報表（範圍限自己機構） |
| 管理者 | 全機構分析報表，純查看不能寫入 |
| 平台管理者 | 學員/機構/題庫管理、及格審查、通知設定、建立機構管理者帳號 |
| 系統管理者 | 以上全部 + 建立/管理其他系統管理者/平台管理者/管理者帳號 |

對應 feature 資料夾：`src/features/{staff,institutions,questions,review,notifications,reports,admins,exam}/`。
題庫（`questions/`）支援三種題型：純文字、音訊題（僅越南文/印尼文，情境音效+文字選項，25題中固定5題）、
圖片題（三語言皆可，題目配圖或選項本身是圖片，隨機出現不保證題數）。
報表（`reports/`）依「機構」「國籍」雙篩選切換全院總況/跨機構比較/跨國籍比較/單一機構/單一國籍五種範圍，
圖表形式依任務自動切換（單一快照用甜甜圈圖、多群組比較用長條/柱狀圖），支援列印。

## 在新電腦上開始開發

### 1. 需要的工具

- [Node.js](https://nodejs.org/) 22 以上
- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/)（選用，用來操作 Actions／Pages）

### 2. 取得程式碼

```bash
git clone https://github.com/sd762/hok-training-exam.git
cd hok-training-exam
npm install
```

### 3. 建立 `.env`

`.env` 含連線設定，**不進 git**，需要在每台開發機各建一次：

```bash
cp .env.example .env
```

然後填入實際值。這兩個值可從 Supabase Dashboard → Project Settings 取得，
也可以直接從 GitHub repository variables 查（`gh variable list`）——
它們設計上就會出現在打包後的 JS 中，安全性由資料庫的 RLS 政策保障，不算機密。

> ⚠️ `sb_secret_` 開頭的金鑰可繞過所有權限控管，只能設定在 Supabase Edge Function
> 的環境變數，**絕不可**寫進 `.env`、前端程式碼或 repo。

### 4. 啟動

```bash
npm run dev
```

開 http://localhost:5173，用系統管理者帳號登入。

## 常用指令

```bash
npm run dev      # 開發模式
npm run build    # 建置（含型別檢查）
npm run lint     # 只做型別檢查
```

推送到 `main` 會自動觸發 GitHub Actions 建置並部署到 GitHub Pages。

## 資料庫

schema 變更以遷移檔管理，見 [supabase/migrations/](supabase/migrations/)。
目前流程是手動：把遷移檔內容貼到 Supabase Dashboard 的 SQL Editor 執行，
並將同一份 SQL 提交進 repo 留存版本紀錄。

## 不在 repo 內的檔案

以下內容刻意排除在版控之外，換電腦時需另外處理：

| 項目 | 位置 | 為何排除 | 如何取得 |
|---|---|---|---|
| `.env` | 專案根目錄 | 各機器環境設定 | 依上方步驟 3 重建 |
| `舊系統備份/` | 專案根目錄 | 含機構正式考題，不宜公開 | 從舊 repo 或 OneDrive 取得 |
| `.claude/skills/` | 專案根目錄 | 他人著作的翻譯版本 | 從 OneDrive 或原始來源取得 |
| `node_modules/` | 專案根目錄 | 可重新產生 | `npm install` |

## 帳號

登入一律使用**帳號代碼**（學員為工號），不使用 email。
程式會在背後轉換為 Supabase Auth 所需的內部信箱格式（`{代碼}@hok-exam.local`），
使用者全程不會接觸到 email。詳見 [ADR 0008](docs/adr/0008-unified-account-code-login.md)。

忘記密碼由管理者協助重設——內部信箱收不到信，Supabase 內建的寄信重設流程不適用。
