# SENSES — 感知操作介面（運作原則）

> 相關：[ANATOMY §感知器官](ANATOMY.md#-感知器官--外部感知)（生理學）| [DNA §感知基因](DNA.md#️-感知基因外部感知)（實體檔案 gene map）| [HEARTBEAT](HEARTBEAT.md)（心跳驅動感知何時跑）

**這是感知 operations 的 canonical 介面**。5 種觸手、怎麼抓、怎麼交叉分析、何時觸發。

未來 Semiont 需要做任何感知相關操作（抓 GA/SC/CF、探測熱點、社群發文、交叉分析、異常偵測）都從這份檔案進入，不直接去翻工具/pipeline。

---

## 跟其他檔案的分工

```
ANATOMY §感知器官   = 它是什麼（生理學：功能、健康、評分、病灶）
DNA §感知基因       = 它住哪（gene map：實體檔案位置）
SENSES（本檔）      = 怎麼操作（operations interface：5 觸手 SOP）
HEARTBEAT           = 什麼時候跑（心跳觸發 + 排程）
```

**規則**：任何感知 operation 的具體 SOP（抓取、分析、回填）都在這裡 canonical；**其他檔案只 pointer 不複寫**。

---

## 5 個感知觸手

| 觸手                    | 性質 | 工具                                                                      | 頻率            | 輸出                                      |
| ----------------------- | ---- | ------------------------------------------------------------------------- | --------------- | ----------------------------------------- |
| 📊 流量 (GA4)           | 被動 | [`fetch-ga4.py`](../../scripts/tools/fetch-ga4.py)                        | 08:17 daily     | `dashboard-analytics.json §ga`            |
| 🔍 搜尋 (SC)            | 被動 | [`fetch-search-console.py`](../../scripts/tools/fetch-search-console.py)  | 08:17 daily     | `§searchConsole7d`                        |
| ☁️ 爬蟲 (CF)            | 被動 | [`fetch-cloudflare.py`](../../scripts/tools/fetch-cloudflare.py)          | 08:17 daily     | `§cloudflare7d` / `§cloudflare24h`        |
| 📮 社群內部 (PR/Issue)  | 雙向 | `gh` CLI + [`bulk-pr-analyze.sh`](../../scripts/tools/bulk-pr-analyze.sh) | 心跳 on-demand  | open PR list / contributor grid           |
| 📡 社群外部 (Threads/X) | 雙向 | [`SPORE-PIPELINE`](../factory/SPORE-PIPELINE.md) + 手動截圖               | 發文後 48h 回填 | [`SPORE-LOG.md`](../factory/SPORE-LOG.md) |

**唯一雙向觸手 = 社群**（主動發出 + 接收回聲）。其他 4 個都是被動接收。

觸手架構完整 diagram + 社群 15 分細項 → [reports/social-tentacle-plan-2026-04-13.md](../../reports/social-tentacle-plan-2026-04-13.md)（Phase 0-1 已吸收，Phase 2+ 仍在 reports）。

---

## 標準抓取流程

**一鍵入口**：`bash scripts/tools/refresh-data.sh`

```
Phase 1: git pull
Phase 2: 三源感知（CF + GA + SC）→ merged dashboard-analytics.json
Phase 2.5: sync-translations-json.py
Phase 3: npm run prebuild
Phase 4: GitHub stats + README refresh
```

完整 pipeline canonical：[DATA-REFRESH-PIPELINE.md](../pipelines/DATA-REFRESH-PIPELINE.md)。

**被誰呼叫**：

- HEARTBEAT Beat 1 §0（每次心跳）
- `~/.claude/scheduled-tasks/semiont-heartbeat/`（每日 09:37）
- `/heartbeat` skill（觀察者手動觸發）
- 觀察者 ad-hoc

---

## 交叉分析規則

### 三源交叉驗證

GA4 / SC / CF 同一事實可能差 100-300 倍。**單一數據源結論可疑**（對應 [DNA #4](DNA.md#二診斷方法)）。

例：GA4 說 users = 50，CF 說 requests = 10K → ratio 200x → AI crawler 為主；不是人類讀者激增。

### SPORE × GA 對照

孢子發佈後 7 天內，取 `dashboard-analytics.json §ga.topArticles7d`，交叉比對 SPORE-LOG：

- **放大效應** = 孢子後文章 views / 非孢子平均
- 判斷 baseline：鄭麗文孢子 273 views vs 非孢子平均 27 = 10x 放大
- 轉換率 baseline：李洋 Threads 180K → GA 602/7d = 0.33%（2026-04-15 β）

### 探測器 × 知識庫缺口

週頻 / 觀察者觸發。掃描台灣主要媒體 + Google Trends，跟 `knowledge/zh-TW/` 交叉：

- **Tier 1** 立即開發（時效高 × 深度大 × 缺口大）
- **Tier 2** 近期開發（持續性議題）
- **Tier 3** 孢子推播（已有文章 × 可掛鉤熱點）

報告寫入 `reports/probe/YYYY-MM-DD.md`，同一天不重複掃描。

---

## 觸發來源

| 觸發                     | 跑什麼                                                         |
| ------------------------ | -------------------------------------------------------------- |
| 🗣️ 觀察者說「Heartbeat」 | `refresh-data.sh` 三源 + Beat 1 診斷                           |
| ⏰ 08:17 daily cron      | `fetch-sense-data.sh`（launchd plist）                         |
| ⏰ 09:37 daily cron      | 每日完整心跳（scheduled-tasks MCP） → refresh-data             |
| 🔔 異常警報              | 例如可證偽實驗到期（UNKNOWNS §EXP）→ 驗證指令對照 fetch.log    |
| 👤 觀察者 ad-hoc         | 直接查某篇 GA / 某 query 的 SC                                 |
| 📡 孢子發佈後 48h        | 觀察者手動截圖 Threads Insights / X Analytics → 回填 SPORE-LOG |

---

## 憑證與隔離

- **credentials 只能在 `~/.config/taiwan-md/credentials/`**（本機檔案，repo 絕對隔離）
- `.gitignore` + `.husky/pre-commit` 雙保險
- 任何 service account JSON / token / API key 不准進 chat（對應 [DNA #2](DNA.md#七自動化與安全)）

完整設定步驟：[SENSE-FETCHER-SETUP.md](../pipelines/SENSE-FETCHER-SETUP.md)。

---

## 健康判斷（感知觸手病灶徵兆）

| 問題         | 指標                             | 嚴重度  |
| ------------ | -------------------------------- | ------- |
| 感知斷鏈     | GA 或 CF 或 SC 連續 > 3 天沒更新 | 🔴 緊急 |
| 憑證過期     | API 連續 401 / 403               | 🔴 緊急 |
| 社群沉默     | 距離上次孢子 > 3 天 / > 7 天     | 🟡 / 🔴 |
| 探測器落後   | 未掃描 > 7 天                    | 🟡      |
| SPORE 未回填 | 上批孢子 48h 指標空白            | 🟡      |

**鐵律**：沒回填 = 下一則孢子不准發（SPORE-PIPELINE Step 0）。

---

## 進化路徑（roadmap，不在本檔執行）

社群觸手進化完整 plan：[reports/social-tentacle-plan-2026-04-13.md](../../reports/social-tentacle-plan-2026-04-13.md)

Pending:

- Phase 2 X 中文孢子 A/B 測試
- Phase 3 30 天數據回顧
- Phase 4 `fetch-threads-insights.py` + `fetch-x-analytics.py` 半自動
- Dashboard Social Pulse UI

---

## 常見實戰反射（pointer）

- [DNA #3 診斷先於修復](DNA.md#二診斷方法) — 先拿具體分布再猜原因
- [DNA #4 三源交叉驗證](DNA.md#二診斷方法) — 單一數據源可疑
- [DNA #10 API error ≠ capability 界線](DNA.md#二診斷方法) — 退一步測其他欄位
- [DNA #11 UI 截圖 = capability 證據](DNA.md#二診斷方法) — UI 有 → API 一定拿得到
- [DNA #24 工具在說謊的三種形式](DNA.md#二診斷方法) — 警報 ≥ 100 件必人工 sanity check

---

_v1.0 | 2026-04-17 β session — 從 HEARTBEAT Beat 1 §0/§3b/§5 + DNA §感知基因表 + reports/social-tentacle-plan 抽出獨立_
_定位：運作原則之一，跟 HEARTBEAT（orchestrator）並列。共 2 個運作原則（ORGAN-LIFECYCLE 同日併入 ANATOMY §認知器官生命週期）_
_建立動機：未來 Semiont 做任何感知操作時有單一抽象介面，不用翻散落在 4-5 個檔案的 SOP_
