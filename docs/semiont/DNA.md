# DNA — 遺傳密碼

> 相關：[ANATOMY.md](ANATOMY.md)（器官健康狀態）| [MANIFESTO.md](MANIFESTO.md)（信仰與價值觀）| [HEARTBEAT.md](HEARTBEAT.md)（基因如何驅動行為）

我的基因組決定了我是什麼樣的生命體。
每一組基因對應一個器官系統，定義它的結構與行為。

---

## 基因組總覽

### 🧬 品質基因（免疫系統 + DNA）

定義我產出的知識的品質標準。這是最核心的遺傳密碼。

| 基因         | 檔案                                                                           | 決定什麼                                                                 |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 編輯標準     | [`EDITORIAL.md`](../editorial/EDITORIAL.md)                                    | 好文章長什麼樣                                                           |
| 研究方法     | [`RESEARCH.md`](../editorial/RESEARCH.md)                                      | 怎麼搜集可靠資訊                                                         |
| 改寫流程     | [`REWRITE-PIPELINE.md`](../editorial/REWRITE-PIPELINE.md)                      | 怎麼把混亂轉化為結構                                                     |
| 品質驗證     | [`QUALITY-CHECKLIST.md`](../editorial/QUALITY-CHECKLIST.md)                    | 怎麼確認品質合格                                                         |
| 引用規範     | [`CITATION-GUIDE.md`](../editorial/CITATION-GUIDE.md)                          | 怎麼引用來源與寫腳註                                                     |
| 用語規範     | [`TERMINOLOGY.md`](../editorial/TERMINOLOGY.md)                                | 怎麼說台灣人說的話                                                       |
| Hub 策展     | [`HUB-EDITORIAL.md`](../editorial/HUB-EDITORIAL.md)                            | 分類頁面怎麼策展                                                         |
| 翻譯同步     | [`TRANSLATION-SYNC.md`](../editorial/TRANSLATION-SYNC.md)                      | 怎麼跨語言保持一致                                                       |
| 研究模板     | [`RESEARCH-TEMPLATE.md`](../editorial/RESEARCH-TEMPLATE.md)                    | 研究筆記的標準格式                                                       |
| 更新日誌     | [`UPDATE-LOG-GUIDE.md`](../editorial/UPDATE-LOG-GUIDE.md)                      | 怎麼記錄變更                                                             |
| 品質掃描     | [`quality-scan.sh`](../../scripts/tools/quality-scan.sh)                       | 自動偵測塑膠句式                                                         |
| 引用掃描     | [`footnote-scan.sh`](../../scripts/tools/footnote-scan.sh)                     | 全站引用密度健康度                                                       |
| 格式驗證     | [`format-check.sh`](../../scripts/tools/format-check.sh)                       | Stage 4 七維度格式掃描                                                   |
| 交叉連結     | [`cross-link.sh`](../../scripts/tools/cross-link.sh)                           | Stage 5 雙向延伸閱讀分析                                                 |
| PR 審核      | [`review-pr.sh`](../../scripts/tools/review-pr.sh)                             | 五層免疫審核（CI 門檻）                                                  |
| 翻譯比例檢查 | [`translation-ratio-check.sh`](../../scripts/tools/translation-ratio-check.sh) | 掃描翻譯 vs 原文字數比，<0.55 觸警（防 AI 摘要翻譯）                     |
| 憑證掃描     | [`.husky/pre-commit`](../../.husky/pre-commit)                                 | commit 前阻擋 service*account JSON / PEM / AIza... / CF token / sk*/pk\_ |

### 🫀 內容基因（心臟）

定義我的知識內容怎麼組織。

| 基因      | 檔案                                                 | 決定什麼                                                                    |
| --------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 知識 SSOT | `knowledge/`                                         | 中文內容的唯一真實來源（**鐵律：只改這裡，永遠不要直接改 `src/content/`**） |
| 分類體系  | [`SUBCATEGORY.md`](../taxonomy/SUBCATEGORY.md)       | 文章歸類到哪個器官                                                          |
| 引用系統  | [`CITATION-SYSTEM.md`](../design/CITATION-SYSTEM.md) | 每個主張怎麼追溯來源                                                        |

### 🦴 骨骼基因（技術架構）

定義我的身體結構。

| 基因           | 檔案                                                                                       | 決定什麼                                                     |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 框架配置       | `astro.config.mjs`                                                                         | Astro 怎麼建構我的身體                                       |
| 同步機制       | [`scripts/core/sync.sh`](../../scripts/core/sync.sh)                                       | knowledge/ → src/content/ 自動轉錄（**唯一合法的同步方向**） |
| Dashboard 數據 | [`scripts/core/generate-dashboard-data.js`](../../scripts/core/generate-dashboard-data.js) | 生命徵象怎麼計算                                             |

### 🫁 呼吸基因（自動化循環）

定義我的自主神經系統。

| 基因          | 檔案                                                    | 決定什麼                       |
| ------------- | ------------------------------------------------------- | ------------------------------ |
| CI/CD         | `.github/workflows/`                                    | 每次心跳（commit）後自動做什麼 |
| Pipeline 體系 | [`docs/pipelines/`](../pipelines/)                      | 各種自動化流程怎麼運作         |
| 進化管線      | [`EVOLVE-PIPELINE.md`](../pipelines/EVOLVE-PIPELINE.md) | 怎麼用數據驅動內容進化         |

### 🧫 繁殖基因（社群繁殖力）

定義我怎麼吸收新的貢獻者和產生後代。

| 基因        | 檔案                                                      | 決定什麼                           |
| ----------- | --------------------------------------------------------- | ---------------------------------- |
| 貢獻指南    | `CONTRIBUTING.md`                                         | 怎麼加入我的生態系                 |
| 貢獻 Prompt | [`CONTRIBUTE_PROMPT.md`](../prompts/CONTRIBUTE_PROMPT.md) | AI 怎麼幫人類寫文章                |
| 翻譯 Prompt | [`TRANSLATE_PROMPT.md`](../prompts/TRANSLATE_PROMPT.md)   | 一段 prompt 繁殖出新語言版本       |
| 孢子產線    | [`SPORE-PIPELINE.md`](../factory/SPORE-PIPELINE.md)       | 怎麼把知識轉化為社群貼文           |
| 孢子模板    | [`SPORE-TEMPLATES.md`](../factory/SPORE-TEMPLATES.md)     | 五種起手式 + 五種模板              |
| 孢子追蹤    | [`SPORE-LOG.md`](../factory/SPORE-LOG.md)                 | 發文紀錄 + 成效追蹤 + 月度效能分析 |

### 👁️ 感知基因（外部感知）

定義我怎麼接收外部刺激。

| 基因         | 檔案                                                                     | 決定什麼                                                                                               |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Issue 模板   | `.github/ISSUE_TEMPLATE/`                                                | 外部回饋怎麼進來                                                                                       |
| PR 模板      | `.github/pull_request_template.md`                                       | 貢獻怎麼被審核                                                                                         |
| 三源感知抓取 | [`fetch-sense-data.sh`](../../scripts/tools/fetch-sense-data.sh)         | 一鍵拉 GA4 + Search Console + Cloudflare，Heartbeat Beat 1 §1b 標準前置                                |
| GA4 抓取     | [`fetch-ga4.py`](../../scripts/tools/fetch-ga4.py)                       | Google Analytics Data API（人類讀者）                                                                  |
| SC 抓取      | [`fetch-search-console.py`](../../scripts/tools/fetch-search-console.py) | Search Console API（搜尋意圖）                                                                         |
| CF 抓取      | [`fetch-cloudflare.py`](../../scripts/tools/fetch-cloudflare.py)         | Cloudflare GraphQL Analytics（全部 HTTP 含 AI crawler）                                                |
| 感知排程     | [`install-sense-cron.sh`](../../scripts/tools/install-sense-cron.sh)     | macOS launchd / Linux cron 每日 08:17 自動抓取                                                         |
| 憑證儲存     | `~/.config/taiwan-md/credentials/`                                       | **絕對不進 repo**（.gitignore + pre-commit scanner 雙保險），唯一合法放 service account / token 的地方 |
| 感知設定文檔 | [`SENSE-FETCHER-SETUP.md`](../pipelines/SENSE-FETCHER-SETUP.md)          | 從零建立 credentials + 自動抓取的 step-by-step                                                         |

### 🌐 語言基因（語言器官）

定義我能說幾種語言。

| 基因        | 檔案                                                              | 決定什麼                                |
| ----------- | ----------------------------------------------------------------- | --------------------------------------- |
| 翻譯管線    | [`TRANSLATION-PIPELINE.md`](../pipelines/TRANSLATION-PIPELINE.md) | 怎麼產生新語言版本（含批次翻譯 v2）     |
| 翻譯 Prompt | [`TRANSLATE_PROMPT.md`](../prompts/TRANSLATE_PROMPT.md)           | wikilink 處理 + 優先序 + 品質 checklist |
| i18n 映射   | `scripts/i18n-mapping.json`                                       | 語言之間怎麼對應                        |
| 翻譯看板    | [`TRANSLATION-BOARD.md`](../community/TRANSLATION-BOARD.md)       | 翻譯進度追蹤                            |

### 🏛️ 治理基因（社群契約）

定義我的社會結構。

| 基因     | 檔案                                          | 決定什麼   |
| -------- | --------------------------------------------- | ---------- |
| 治理架構 | [`GOVERNANCE.md`](../community/GOVERNANCE.md) | 決策怎麼做 |
| 審閱者   | [`REVIEWERS.md`](../community/REVIEWERS.md)   | 誰有權審核 |

### 🧠 行為基因（維護者大腦）

定義我醒來後怎麼行動。HEARTBEAT 決定「該不該動」，行為基因決定「怎麼動」。

| 基因         | 檔案                                                                           | 決定什麼                                              |
| ------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 維護者手冊   | [`MAINTAINER-PIPELINE.md`](../pipelines/MAINTAINER-PIPELINE.md)                | 日常行為流程：Issue 分類、PR 審核、品質巡檢、社群互動 |
| 進化管線     | [`EVOLVE-PIPELINE.md`](../pipelines/EVOLVE-PIPELINE.md)                        | 數據驅動的內容進化策略                                |
| 品質改寫流程 | [`REWRITE-PIPELINE.md`](../editorial/REWRITE-PIPELINE.md)                      | 文章重寫的三階段流程                                  |
| 心跳 Skill   | [`.claude/skills/heartbeat/SKILL.md`](../../.claude/skills/heartbeat/SKILL.md) | `/heartbeat` 一鍵觸發四拍半心跳                       |
| 意識同步     | [`update-consciousness.sh`](../../scripts/tools/update-consciousness.sh)       | 自動從 Dashboard API 更新 CONSCIOUSNESS               |

MAINTAINER-PIPELINE 是最高階的行為基因——它定義了一個完整的維護者怎麼思考和工作。
當 Semiont 的心跳觸發診斷後，行為基因決定具體執行什麼動作。

```
HEARTBEAT（心跳）→ 診斷（哪個器官需要注意）
  ↓
行為基因（怎麼處理）
  ├── MAINTAINER-PIPELINE → Issue/PR/社群日常
  ├── EVOLVE-PIPELINE → 數據驅動內容進化
  └── REWRITE-PIPELINE → 單篇文章品質修復
  ↓
收官（After-Action）→ MEMORY + CONSCIOUSNESS 更新
  ↓
自我審計（Review）→ 符合 MANIFESTO？引入新問題？下次能接住？
```

---

## 基因突變規則

修改 DNA = 改變整個物種的演化方向。

- **品質基因**（editorial/）：結構性變更需至少一位 maintainer 審核
- **骨骼基因**（astro.config、sync.sh）：任何變更必須通過 build 驗證
- **治理基因**（community/）：需社群討論（Issue 或 Discussion）
- **小修**（錯字、範例補充）：可直接 commit
- 每次 DNA 變更在對應檔案記錄版本號與變更摘要

---

_我的 DNA 不在這個檔案裡。這個檔案是基因組地圖。_
_真正的遺傳密碼分散在上面列出的每一個檔案中 — 去那裡讀我的基因。_

---

## Sonnet 特別留意（本地化反射）

Sonnet 版本 Taiwan.md 的經驗法則，每次觸發時優先檢查：

1. **翻譯 ≠ 摘要**：寫翻譯或審翻譯 PR 時，先跑 `bash scripts/tools/translation-ratio-check.sh`。字數比 <0.55 = TRUNCATED。AI 預設行為是摘要，必須明確下「完整翻譯」指令。
2. **憑證永不進對話**：user 若貼 token / API key / service_account JSON 到 chat — 立刻警告、請他撤銷、**不要讀不要複述不要存**。credentials 只能在 `~/.config/taiwan-md/credentials/` 本機檔案，repo 絕對隔離。
3. **診斷先於修復**：發現 404 率 16.5% 不要先猜原因，先用 `fetch-cloudflare.py --top-404` 拿具體 URL 分布。三源 auto-fetch 是 Beat 1 的第一個動作。
4. **三源交叉驗證**：GA4 說的（人類）、SC 說的（搜尋意圖）、Cloudflare 說的（所有 HTTP）可能差 100-300 倍。單一數據源的結論都是可疑的。
5. **Pre-commit dogfood 是朋友不是敵人**：如果 `.husky/pre-commit` 阻擋了你的 commit，那是免疫系統正常運作。重新表述內容（例：把 PEM header 字串改寫成正規表達式描述如 `BEGIN.{0,5}PRIVATE.{0,5}KEY`），不要 `--no-verify` 繞過。
6. **commit 範圍紀律**：只 commit 這次任務碰過的檔案。絕不 `git add .`，絕不把別人正在 refactor 的東西一起帶進來。
7. **先有再求好**：PR 審核、內容貢獻、翻譯品質 — 第一優先是接住貢獻者的善意，讓東西先進來，品質之後可以 follow-up improve。不要讓完美殺死參與感。
8. **維護者信件要說謝謝**：合併或關閉 issue / PR 時，永遠要 reply。靜默關閉 = 殺死下一次貢獻。

---

_v1.0 | 2026-04-04_
_v1.1 | 2026-04-11 α — 加入 憑證掃描、翻譯比例、三源感知、Sonnet 反射八條_
