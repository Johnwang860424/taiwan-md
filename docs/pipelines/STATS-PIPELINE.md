# Stats Pipeline — 每日數據更新流程

> 每天 00:00 (Asia/Taipei) 由 Cron 自動執行

---

## 流程

```
git pull → update-stats.sh → git add (指定檔案) → commit → push
```

## 執行步驟

### 1. 拉最新

```bash
cd ~/taiwan-md && git pull
```

### 2. 跑腳本

```bash
bash scripts/tools/update-stats.sh
```

腳本做的事：

1. 從 GitHub API 抓 stars / forks / contributors 數字
2. 更新 `README.md` 的統計表格
3. 更新 `src/i18n/about.ts` 的 About 頁面數字（四捨五入到百位）
4. **Merge** GitHub 數據到 `public/api/stats.json`（保留既有欄位）
5. 跑 `generate-content-stats.js` 更新內容統計

### 3. Commit + Push

```bash
git add README.md src/i18n/about.ts public/api/stats.json src/data/content-stats.json
git diff --cached --quiet || (git commit -m "chore: daily stats update" && git push)
```

---

## ⚠️ 鐵律

### 絕對不要 `git add -A`

只 add 上面 4 個檔案。`git add -A` 會把其他人正在改的東西一起 commit。

### 絕對不要動 `about.template.astro`

Contributors grid 由另一個 Cron（Taiwan.md Contributors Update）管理。Stats cron 動到 about.template.astro = 破壞 Sponsors + Contact section。**已經發生過 3 次。**

### `stats.json` 是 merge 不是 overwrite

`public/api/stats.json` 由兩個來源共同維護：

- `generate-content-stats.js`：categories、tags、subcategories 等豐富內容（主要來源）
- `update-stats.sh`：stars、forks、contributors（GitHub API 即時數據）

腳本只更新 GitHub 欄位，**保留其他所有既有欄位**。如果整個覆寫 = Dashboard 資料全丟。

### `cd` 路徑

腳本在 `scripts/tools/`，用 `cd "$(dirname "$0")/../.."` 回到 repo root。不是 `..`（那只到 `scripts/`）。

---

## 相關檔案

| 檔案                                      | 用途                                       |
| ----------------------------------------- | ------------------------------------------ |
| `scripts/tools/update-stats.sh`           | 主腳本                                     |
| `scripts/tools/generate-content-stats.js` | 內容統計（categories/tags）                |
| `public/api/stats.json`                   | 統一 stats API（Dashboard + About 頁共用） |
| `src/i18n/about.ts`                       | About 頁面顯示數字                         |
| `src/data/content-stats.json`             | Build-time 內容統計                        |

## 相關 Cron

| Cron                          | 時間  | 職責                                |
| ----------------------------- | ----- | ----------------------------------- |
| Taiwan.md Daily Stats Update  | 00:00 | 本 pipeline                         |
| Taiwan.md Contributors Update | 03:30 | 更新 contributor 名單 + README 表格 |

---

_版本：v1.0 | 2026-03-29_
