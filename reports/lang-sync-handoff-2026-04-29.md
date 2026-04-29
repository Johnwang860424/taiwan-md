# Lang-Sync Handoff — 2026-04-29 night

> **截至**: 2026-04-29 ~22:20 +0800
> **session**: harvest captain's bridge build + lang-sync test foundation
> **接續**: [reports/lang-sync-harvest-experiments-2026-04-29.md](lang-sync-harvest-experiments-2026-04-29.md) (3-task experiment) → 本 doc 是給下一個 session 的接力棒

---

## 1. 已完成 (本 session)

### Toolkit (`scripts/tools/lang-sync/`)

- ✅ `status.py` — fresh / stale / missing / orphan 分類
- ✅ `backfill-source-sha.py` — 一次性 migration（已跑）
- ✅ `optimized-translate.py` — 4-part divide-and-conquer (extract / prompt / assemble)
- ✅ `verify-translation.py` 🆕 — 15-point hard-gate (實測抓到 author/subcategory drift bugs)
- ✅ `refresh.sh` `pick.py` `batch-refresh.sh` `audit-quality.sh`
- ✅ `lang-sync` wrapper

### Harvest engine 整合

- ✅ Boot profile `translation-refresh` (~18K tokens)
- ✅ Prompt template `prompts/lang-sync-refresh.md` 升級為 4-part flow + verify hard-gate LOOP (up to 3 fix iterations in-session)
- ✅ Engine routing: claude (default Opus) / codex / ollama (codex --oss qwen)
- ✅ DEFAULT_MODEL_BY_TYPE: lang-sync → Sonnet, article-\* → Opus
- ✅ ENGINE_ELIGIBLE_TIER: only simple-tier types accept engine override
- ✅ HARVEST_ALLOW_SELF_COMMIT env passes user policy to agent
- ✅ SELF_VERIFYING set: lang-sync-refresh 不會被 health monitor 自動派 Polish followup
- ✅ session counter → every 10 sessions trigger Master Review (self-diagnose task)
- ✅ 4hr cron → also schedule Master Review

### 3-task harvest 實驗 (commit `f1acc6bc`+ `caa8cbb2`)

- 史前時代與原住民 (zh=1776 / en=5133 / r=2.96) ✅ exit 0 / merged
- 日治時期 (zh=2453 / en=7864 / r=3.21) ✅ exit 0 / merged
- 有感筆電 (zh=3392 / en=7901 / r=2.36) ✅ exit 0 / merged
- 全 Sonnet via harvest, ~5min concurrent wall-clock, ~140K tokens

### UI captain's bridge (Phase 5)

- ✅ 3-col layout (5/4/3): 今日任務+佇列 / 快捷+手動 / Scheduler 控管
- ✅ 8 quick action presets (data-refresh / pr-review / article-from-inbox / etc)
- ✅ SchedulerControl: per-type checkbox + interval (1/5/15/30/60m) + max concurrent (1/2/3/5/8/10) + pause/resume/scan inbox
- ✅ TaskQueue 過濾 in-progress (避免跟今日任務重複)
- ✅ TaskQueue 改 list-style 不再 overflow，spawn ▶️ 按鈕看得到
- ✅ TaskRow + ActiveSessions 共用 `LiveProgress` (in-progress 時顯示最新 tool_use stream)
- ✅ Stream-json output (claude + codex 雙格式 parser)
- ✅ Session metadata header (model / engine / spawn_attempt / worktree / git head / inputs)

---

## 2. 當前狀態 (lang-sync)

統計於 `8bfcc54f` (2026-04-29 22:19):

| Lang            | Fresh | Stale | Missing | Orphan |         Coverage |
| --------------- | ----: | ----: | ------: | -----: | ---------------: |
| zh-TW canonical |     — |     — |       — |      — | **625 articles** |
| en              | **6** |   377 | **242** |      4 |            61.3% |
| ja              |     0 |   264 |     361 |      2 |            42.2% |
| ko              |     0 |   474 |     151 |      4 |            75.8% |
| es              |     0 |    36 |     589 |      0 |             5.8% |
| fr              |     0 |   460 |     165 |      3 |            73.6% |

⚠️ **觀察**: ja/ko/es/fr 全部 fresh=0。原因推測 — main 最近的 zh 改動 + rebase 後 sourceCommitSha 對不上 git log。需要重跑 backfill 或者 verify whether those SHAs are actually rebased away.

⚠️ **觀察**: en fresh 從 20 → 6 也驗證了「zh 一動 → cascade stale」的設計是 working as intended。

---

## 3. 規劃（Phase 推進路線，先規劃不執行）

### Phase A — Stabilize (1 sitting)

1. 重跑 `lang-sync backfill --force` 把 ja/ko/es/fr 的 SHA 重置（reset to current main HEAD baseline，避免被誤標 stale）
2. 重新跑 `lang-sync status` 取真 baseline
3. 確認 dashboard `/dashboard/languages` 跟 status JSON 同步

### Phase B — codex / ollama 對比實驗（同篇 × 3 engine）

詳見下方 §4。**目前還沒實際跑過 codex 或 ollama 翻譯任務** — 完成 Phase A baseline 重整後再做。

### Phase C — 5-篇 batch (claude Sonnet)

- 條件：Phase A baseline 重整完 + Phase B 確認 codex/ollama 可用後
- 觸發方式：哲宇透過 UI quick action「Lang-sync: 1 en article」一鍵建任務 × 5 → 等 auto-spawn (interval 5min, max 5)
- 預期：~25 min wall-clock / ~250K tokens / ~$5
- 驗收：`lang-sync status --lang en` fresh +5

### Phase D — 100-篇 batch

- 預估：~6 hr wall-clock at concurrency 5-8 / 5M tokens / $25-40
- 觸發：`generate-harvest-tasks.py --top 100`
- 觀察點：verify hard-gate loop 失敗率 / agent self-fix 成功率 / commit-cluster 策略（100 篇單一 squash commit）

### Phase E — 完整同步 597 篇

- 預估：~5-6 hr wall-clock at concurrency 8 / 25M tokens / $80-100
- 一次到位 OR 100/batch x 6 round（user 偏好待 confirm）

### Phase F — multi-language scale-out

- 套相同 toolkit 到 ja / ko / fr / es
- schema 已 multi-target ready

---

## 4. codex / ollama 翻譯效果測試 (尚未執行)

### 測試目的

- 哲宇要求驗證簡單任務（data-refresh / 翻譯）能否用 codex / ollama 跑出可接受品質
- 重任務（article-rewrite / pr-review）固定 claude-opus 不變

### 測試設計（同篇 × 3 engine）

選 1 篇短的 stale en（< 1500 chars）跑三個 engine。例：`Society/疊杯.md`（~1498 zh chars）。

```bash
# Engine 1 — claude-sonnet (baseline, 已驗過)
curl -X POST http://localhost:4319/api/tasks -d '{
  "type": "lang-sync-refresh",
  "boot_profile": "translation-refresh",
  "priority": "P1",
  "title": "engine-test claude: 疊杯",
  "inputs": {
    "zh_path": "Society/疊杯.md",
    "lang": "en",
    "engine": "claude",
    "model": "claude-sonnet-4-6"
  }
}'

# Engine 2 — codex (ChatGPT subscription, default model)
curl -X POST ... -d '{
  ...
  "title": "engine-test codex: 疊杯",
  "inputs": {
    ...
    "engine": "codex"
  }
}'

# Engine 3 — ollama qwen3.5:35b-a3b-coding-nvfp4 (本機)
curl -X POST ... -d '{
  ...
  "title": "engine-test ollama: 疊杯",
  "inputs": {
    ...
    "engine": "ollama",
    "model": "qwen3.5:35b-a3b-coding-nvfp4"
  }
}'
```

### 觀察維度

| 維度                                  | claude sonnet   | codex                           | ollama qwen                             |
| ------------------------------------- | --------------- | ------------------------------- | --------------------------------------- |
| Wall-clock                            | TBD             | TBD                             | TBD (本機沒網路 latency, 但 35B 推理慢) |
| Tokens                                | TBD             | TBD                             | n/a (本機 不記費)                       |
| ratio (verify)                        | TBD             | TBD                             | TBD                                     |
| verify hard-gate pass                 | TBD             | TBD                             | TBD                                     |
| Translation 品質（人讀）              | TBD             | TBD                             | TBD                                     |
| Tool use 表現（Bash/Read/Write/Edit） | claude 原生支援 | codex agent_message + reasoning | ollama via codex 可能受限               |

### 預期 risks

- **codex** 對 zh-TW prose 翻譯可能比 claude-sonnet 弱（OpenAI 模型對 zh 語料偏少）；reasoning trace 可能讓 token 暴漲
- **ollama qwen3.5:35b-a3b-coding-nvfp4** 是 coding-tuned, 翻譯散文不一定好；推理慢（本機 RTX 3090）；tool use 可能 hallucinate 不存在的 file path
- **codex --oss** 走 ollama 時的 prompt scaffold 可能讓 model 不知道怎麼正確收尾

### 建議

**測試先做 1 篇對比**（不是 5 篇 batch），確認 codex/ollama 有沒有 catastrophic failure，再決定是否值得花 token 跑更多 sample。

**fallback 策略**：如果 codex/ollama 翻譯 verify 一直 hard-fail，就**只把這兩個 engine 用在 data-refresh / format-check / status-report 等 mechanical task**，翻譯固定 claude-sonnet。

---

## 5. 已知 bugs / 待修

| Bug                                                           | severity | location                         | 修補建議                                                   |
| ------------------------------------------------------------- | -------- | -------------------------------- | ---------------------------------------------------------- |
| ja/ko/es/fr fresh=0 (都是 stale)                              | medium   | `_translation-status.json`       | 跑 `lang-sync backfill --force` 重置 SHAs                  |
| en aluan-wang 仍 orphan (translatedFrom 大小寫)               | low      | `knowledge/en/Art/aluan-wang.md` | 已修，但可能 sync 又錯                                     |
| Polish auto-followup 對 lang-sync 已 disabled (新 commit)     | done     | `health/monitor.ts`              | ✅                                                         |
| `codex` / `ollama` engine 完全沒實測過翻譯                    | high     | —                                | 跑 §4 三 engine 對比                                       |
| Translation worktree 不 auto-merge 累積（user 想統一 commit） | medium   | spawner finalize                 | 設計 batch-collect 機制：跑完不 merge，等 N 篇後一次 merge |

---

## 6. 給下一個 session 的工作順序

1. **重啟 backend** — 套用 captain's bridge / Master Review / max concurrent / verify hard-gate loop 改動

   ```bash
   bash docs/semiont/harvest/backend/tmux/stop.sh && \
   bash docs/semiont/harvest/backend/tmux/start.sh
   ```

2. **Phase A**: `lang-sync backfill --force` 重整 baseline → 重跑 status 確認真實數字

3. **Phase B**: 跑 §4 三 engine 對比（同篇 × 疊杯.md），記到 `reports/lang-sync-engine-comparison-2026-04-30.md`

4. **PR 合併 (#7)**:
   - 之前 lang-sync feature branch (`feat/lang-sync-toolkit`) 還沒 merge 進 main
   - 但因為各種改動已直接 commit 到 main (3 篇翻譯 + harvest captain bridge 都 main 上)
   - 需要：rebase `feat/lang-sync-toolkit` onto main → squash → 開 PR → merge
   - 或直接 close feature branch（內容已 cascade 到 main）+ 把 worktree archive

5. **Phase C**: 5-篇 batch（user 偏好）→ 透過 quick action UI 觸發 5 次「Lang-sync: 1 en article」→ 等 auto-spawn 跑完 → 統一檢查 verify pass + 一個 squash commit

6. **持續監控**: 每 10 sessions 自動會被 Master Review 觸發；4hr cron 也會。回讀 self-diagnose 結果調整。

---

🧬

_v1.0 | 2026-04-29 22:20 +0800_
_handoff to next session — engine comparison + 5-task batch pending_
_當前 baseline: en 6 fresh / 377 stale / 242 missing (625 zh canonical)_
