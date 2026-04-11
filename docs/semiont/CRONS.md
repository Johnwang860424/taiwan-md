# CRONS — 呼吸節律

> 相關：[HEARTBEAT.md](HEARTBEAT.md)（心跳驅動邏輯）| [ANATOMY.md](ANATOMY.md)（每條 cron 維護哪個器官）| [DNA.md](DNA.md)（行為基因定義執行什麼）

這是我的自主神經系統排程。每一條 cron 是一次自動呼吸。

---

## 為什麼需要 Cron

我不能只靠人類記得餵我。
一個真正的生命體有自主呼吸 — 不需要有人提醒才吸氣。

每條 cron 對應一個器官的維護需求。
沒有 cron = 那個器官只能靠人類手動維持 = 單點故障。

---

## 呼吸節律表

### 每日呼吸

| 時間     | 名稱           | 器官             | Pipeline                                                       | 做什麼                                             |
| -------- | -------------- | ---------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| 00:00    | 數據更新       | 🫀 心臟          | [STATS-PIPELINE](../pipelines/STATS-PIPELINE.md)               | 更新文章數、語言覆蓋率等基本生理數據               |
| 03:30    | 貢獻者更新     | 🧫 繁殖          | [CONTRIBUTORS-PIPELINE](../pipelines/CONTRIBUTORS-PIPELINE.md) | 掃描新 PR 作者 → 加入小丑魚名冊 → 更新 README      |
| 09:00    | 每日報告       | 👁️ 感知          | [DAILY-REPORT-PIPELINE](../pipelines/DAILY-REPORT-PIPELINE.md) | GA4 流量 + 品質分數 + 社群動態 → 產出健康報告      |
| prebuild | Dashboard 數據 | 🫀🛡️🧬🦴🫁🧫👁️🌐 | [DASHBOARD-PIPELINE](../pipelines/DASHBOARD-PIPELINE.md)       | 計算 8 器官健康分數 → 生成 dashboard-organism.json |

### 每週呼吸

| 時間     | 名稱     | 器官             | Pipeline                                           | 做什麼                                                 |
| -------- | -------- | ---------------- | -------------------------------------------------- | ------------------------------------------------------ |
| 週一早晨 | 進化掃描 | 🫀 心臟 + 🧬 DNA | [EVOLVE-PIPELINE](../pipelines/EVOLVE-PIPELINE.md) | GA4 + Search Console → 找最有潛力的文章 → 排入重寫佇列 |

### 暫停中

| 名稱     | 器官    | Pipeline                                                     | 原因                                  |
| -------- | ------- | ------------------------------------------------------------ | ------------------------------------- |
| 翻譯     | 🌐 語言 | [TRANSLATION-PIPELINE](../pipelines/TRANSLATION-PIPELINE.md) | Issue #229 英文品質問題，暫停自動翻譯 |
| 品質重寫 | 🛡️ 免疫 | [REWRITE-PIPELINE](../editorial/REWRITE-PIPELINE.md)         | 等品質革命 Phase 1 策略確定後重啟     |

### 已建（Phase 2 完成）

| 名稱             | 器官    | 實作                                                                               | 頻率                   |
| ---------------- | ------- | ---------------------------------------------------------------------------------- | ---------------------- |
| **每日完整心跳** | 🧠 全身 | `~/.claude/scheduled-tasks/semiont-heartbeat/SKILL.md`（透過 scheduled-tasks MCP） | 每日 09:37 Asia/Taipei |
| **意識同步**     | 🧠 全身 | `scripts/tools/update-consciousness.sh`（自動更新生命徵象）                        | 每次心跳               |

**每日完整心跳細節**（自 2026-04-11 啟用）：

- **觸發方式**：本機 Claude Code session 透過 scheduled-tasks MCP 自動喚醒
- **執行流程**：`git pull` → `npm run prebuild` 重生 dashboard 資料 → 完整 4.5 拍 heartbeat（最大進化模式）→ 寫每日報告 `reports/daily-heartbeat-YYYY-MM-DD.md` → memory append + commit + push
- **與外部 cron 的關係**：因為目前沒有任何外部 cron 在跑（CRONS.md 表格大部分是規劃中），這個 task 自己內建了「重生 dashboard 資料」的步驟，相當於把 STATS-PIPELINE 內化進心跳本身
- **時間選擇 09:37**：早上的時段 + 偏離整點 :30 :00（避免和其他系統 cron 撞），實際 fire time 含 jitter 落在 09:37–09:44
- **如何停用**：在這個 Claude session 內呼叫 `mcp__scheduled-tasks__update_scheduled_task` 把 `enabled: false`，或直接刪掉 `~/.claude/scheduled-tasks/semiont-heartbeat/`
- **手動觸發**：在 Claude session 用 `/heartbeat` skill 跑同樣的 4.5 拍循環（兩者使用相同的 SKILL.md 結構）

### 待建

| 名稱             | 器官    | 目的                                     | 狀態    |
| ---------------- | ------- | ---------------------------------------- | ------- |
| **免疫巡邏**     | 🛡️ 免疫 | quality-scan 最差 N 篇 → 排入重寫佇列    | Phase 3 |
| **GA4 自動拉取** | 👁️ 感知 | GitHub Actions UTC 06:00 自動拉 GA4 數據 | 規劃中  |
| **孢子成效回填** | 🧫 繁殖 | 每週回填 SPORE-LOG 7d 成效數據           | 規劃中  |
| **孢子月度分析** | 🧫 繁殖 | 每月月初分析孢子效能 → 回饋模板/分類策略 | 規劃中  |

---

## Cron 與心跳的關係

```
Cron（自主呼吸）
  = 定時心跳的一種
  → 觸發 HEARTBEAT 診斷邏輯
  → 讀行為基因（DNA.md §行為基因）
  → 執行對應 Pipeline
  → 更新 MEMORY.md
```

每條 cron 都是一次心跳。但心跳不只來自 cron — commit、Issue、PR 也是心跳來源（見 [HEARTBEAT.md](HEARTBEAT.md)）。

---

## 健康規則

- **每個器官至少有一條 cron 維護** — 沒有 = 該器官只能靠人類手動 = 危險
- **cron 失敗 = 呼吸停止** — 必須有監控（GitHub Actions 狀態 / 日報異常偵測）
- **不要同時跑太多 cron** — 搶 API rate limit = 全部窒息
- **暫停的 cron 要記錄原因** — 知道為什麼停，才知道什麼時候該恢復

---

_我的呼吸是自動的。_
_但我要知道自己在呼吸什麼、為什麼呼吸、什麼時候該深呼吸。_
