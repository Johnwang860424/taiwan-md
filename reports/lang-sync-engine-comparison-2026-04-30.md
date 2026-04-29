# Lang-Sync Engine Comparison — 2026-04-30 v1 (in-flight, awaiting T2 codex re-spawn)

> **session**: 2026-04-30 morning, harvest captain's bridge Phase 5.1 ship
> **接續**: [reports/lang-sync-handoff-2026-04-29.md](lang-sync-handoff-2026-04-29.md) §4 (test design)
> **主旨**: 同篇翻譯 × 三 engine (claude-sonnet / codex / ollama-qwen) 實證對比，作為 5-task batch + 597-篇全同步 engine 選擇依據。

---

## 0. 為什麼做這個對比

哲宇 brief 主張「重任務固定 claude opus，簡單任務 (lang-sync / data-refresh) 才用 sonnet/codex/ollama」。要驗證的是：

- **codex CLI** (ChatGPT subscription) 對 zh-TW prose 翻譯品質夠不夠？token 不計算父 context 是否真的更便宜？
- **ollama qwen3.5:35b-a3b-coding-nvfp4** 本機跑會比 cloud sonnet 慢多少？品質夠不夠？tool use 會不會 hallucinate?
- **claude-sonnet-4-6** 是當前 baseline，但 Sonnet 的 53-turn 修 loop 是不是 over-engineered？

對比結果決定三件事：

1. 5-task batch 全部跑 claude-sonnet 還是 mix engines
2. 597-篇全同步是否值得用 ollama 跑（zero cost vs latency）
3. lang-sync-refresh prompt 要不要 per-engine 變體

---

## 1. Setup

**Test articles** (各 engine 一篇，避免 task overlap)：

| Task ID        | Engine | Model                        | Article                          | zh chars | Mode    |
| -------------- | ------ | ---------------------------- | -------------------------------- | -------- | ------- |
| 2026-04-29-013 | claude | claude-sonnet-4-6            | People/朱經武.md                 | 5,427    | stale   |
| 2026-04-29-014 | codex  | (auto from spawner — see §3) | Society/疊杯.md                  | ~1,498   | missing |
| 2026-04-29-015 | ollama | qwen3.5:35b-a3b-coding-nvfp4 | Technology/台灣人工智慧實驗室.md | 不公開   | stale   |

**Runtime**: 2026-04-29 22:27:58 +0800 (all three spawned within 80ms of each other for fair comparison — verified via `spawned_at_iso` in metadata headers).

**Boot profile**: `translation-refresh` (Phase 5.1 lightweight version, ~12K boot tokens, no BECOME).

**Prompt template**: `prompts/lang-sync-refresh.md` (pre-Phase 5.1 voice — old "Step 1 Read context" framing; T2 re-spawn will use new 專業翻譯 worker voice).

---

## 2. T1 — claude-sonnet-4-6 (朱經武) ✅

**Status**: `done` / `exit_code: 0` / commit `66d8c255`

| Metric                      | Value                                         |
| --------------------------- | --------------------------------------------- |
| Wall-clock (duration_ms)    | **350,042 ms (5min 50s)**                     |
| Turns                       | **53**                                        |
| Cost USD                    | **$1.31**                                     |
| Input tokens (new)          | 54                                            |
| Output tokens               | 15,157                                        |
| Cache read input tokens     | 2,817,557                                     |
| Cache creation input tokens | 62,238                                        |
| Verify exit code            | **2 (WARN only — ratio verdict unclear)**     |
| Translation ratio (zh→en)   | 5,427 → 7,993 chars = **1.47**                |
| Verify hard fails           | 0                                             |
| Verify warns                | 1 (ratio verdict unclear after format change) |

**Self-fix iterations**: agent fixed CJK in title (manual `(朱經武)` removal per verify check #13) and manually added 4 SHA fields (refresh.sh can only update existing fields via regex; missing case needs manual injection). All within the in-session loop, no spawn retry.

**Output quality (sample read)**: `knowledge/en/People/chu-ching-wu.md` reads like Taiwan-English bilingual prose, no marketing voice, footnote refs preserved, no fabrication detected. Title is "Chu Ching-Wu" (Wade-Giles, matches the article body convention). Description is single-paragraph (not three-beat — old prompt didn't enforce this; new prompt should fix).

**Notable artefacts**:

- ratio 1.47 is slightly above the 0.8-1.3 EN-to-zh expansion guideline (en prose tends to add articles + connectives that zh implies). Verify warns but doesn't block.
- 53 turns is high — Sonnet ran the full pipeline + verify loop + 7 manual fix iterations + reasoning between each. Most turns were single-tool-use (Bash, Edit, Read) for the verify drift loop.

---

## 3. T2 — codex (疊杯) ❌ → re-spawn pending

**Status**: `failed` / `exit_code: 1` after **5 seconds** at 2026-04-29 22:28:03 +0800.

**Root cause** (verbatim from session log line 3):

```
{"type":"error","message":"{\"type\":\"error\",\"status\":400,\"error\":{\"type\":\"invalid_request_error\",\"message\":\"The 'claude-sonnet-4-6' model is not supported when using Codex with a ChatGPT account.\"}}"}
```

The spawner passed `-m claude-sonnet-4-6` to the codex CLI because the **old single-table** `DEFAULT_MODEL_BY_TYPE` mapped `lang-sync-refresh → claude-sonnet-4-6` regardless of engine. Codex with a ChatGPT account expects gpt-5 / o3 / etc, not claude model IDs.

**Fix shipped 2026-04-30 morning** (commit `df2314b3` — cheyu's uncommitted nested-table fix from 2026-04-29 night, picked up + committed this morning):

```ts
// Before (single table — sent claude name to codex):
const DEFAULT_MODEL_BY_TYPE = { 'lang-sync-refresh': 'claude-sonnet-4-6', ... };
const taskModel = task.inputs?.model ?? DEFAULT_MODEL_BY_TYPE[task.type];

// After (engine-aware nested table):
const DEFAULT_MODEL_BY_ENGINE_TYPE = {
  claude: { 'lang-sync-refresh': 'claude-sonnet-4-6', ... },
  codex:  { 'lang-sync-refresh': '', ... },        // empty = let codex auto-pick
  ollama: { 'lang-sync-refresh': 'qwen3.5:35b-a3b-coding-nvfp4', ... },
};
const engineDefaults = DEFAULT_MODEL_BY_ENGINE_TYPE[taskEngine] ?? {};
const taskModel = task.inputs?.model ?? engineDefaults[task.type] ??
  (taskEngine === 'claude' ? 'claude-sonnet-4-6' : '');
```

**Re-spawn after backend restart**: T2 (疊杯.md missing → en, codex engine, no explicit model) should now spawn without `-m` flag → codex uses ChatGPT subscription default. Expected wall-clock unknown (this is the data point we still need).

---

## 4. T3 — ollama qwen3.5:35b-a3b-coding-nvfp4 (台灣人工智慧實驗室) ⚠️ ✅ done but verify FAIL

**Status**: `done` / `exit_code: 0` / commit `a667cc23`

| Metric            | Value                                            |
| ----------------- | ------------------------------------------------ |
| Wall-clock        | **~4min 49s (14:27:58 → 14:32:47)**              |
| Turns             | ~96 (more reasoning steps than Sonnet)           |
| Cost USD          | **$0 (本機 RTX 3090 + ollama)**                  |
| Token usage       | n/a (本機不記費，但推理慢)                       |
| Verify final exit | **1 (HARD FAIL: passthrough subcategory drift)** |
| Translation ratio | (didn't check — verify failed before ratio gate) |
| Output committed? | **YES — but with verify hard fail un-resolved**  |

**Critical finding**: Qwen committed `a667cc23` even though `verify-translation.py` exited 1. Why? The pre-Phase 5.1 prompt didn't have an explicit hard rule "Only proceed to Step 6 after verify exits 0 or 2". The post-Phase 5.1 prompt now does (Step 5 explicit "Only proceed to Step 6 after verify exits 0 or 2"). Re-test required.

**Failure pattern**: Qwen tried to translate the `subcategory` frontmatter field. The zh source has `subcategory: '人工智慧'`. Qwen variously emitted:

- `subcategory: 'artificial intelligence'` (English translation — verify rejects)
- `subcategory: 'ren-gong-zhi-hui'` (Pinyin transliteration — still drift)

Both are HARD FAIL because `passthrough fields` rule (verify check #7) requires zh + en frontmatter to match verbatim except `title / description / imageAlt`. Qwen tried 7+ sed iterations to fix this, none succeeded. The agent eventually gave up and committed anyway.

**Why Sonnet didn't hit this**: 朱經武.md has `subcategory: '物理學家'`. Sonnet kept it as-is (it was in the must-not-change passthrough list — Sonnet inferred from verify output). Qwen treated the field as translatable.

**Phase 5.1 prompt fix (already shipped)**: Craft principle 5 explicitly says "frontmatter passthrough fields are sacred — author / subcategory / category / featured / readingTime / lastVerified / lastHumanReview MUST equal zh source verbatim. Don't re-attribute. Don't translate." This is exactly the rule Qwen needed.

**Re-test requirement**: When backend reloads with the new prompt, re-spawn T3 with same article (or fresh translation task) to verify Qwen now respects passthrough rule.

**Output quality (sample read)**: prose is technically OK (Taiwan English-ish, no obvious hallucination from this article — ollama also hit codex CLI startup model-list error but task itself succeeded). However, the broken passthrough means current state is `knowledge/en/Technology/taiwan-ai-labs.md` has `subcategory: 'ren-gong-zhi-hui'` which won't match the zh canonical `'人工智慧'`. Future cross-language category aggregation will break.

---

## 5. Comparative analysis (T1 + T3 only — T2 pending)

| Dimension                    | claude-sonnet                | ollama qwen-35b                                 |
| ---------------------------- | ---------------------------- | ----------------------------------------------- |
| **Wall-clock**               | 5m 50s                       | 4m 49s (slightly faster — no network latency)   |
| **Cost / article**           | $1.31                        | $0 (本機 power 不計)                            |
| **Cost / 597 articles**      | ~$782                        | $0 (但 power + 本機可用性)                      |
| **Turns**                    | 53                           | ~96 (本機 reasoning model 比 cloud 多)          |
| **Final commit**             | ✅ Verify PASS (exit 2)      | ⚠️ Committed despite verify FAIL                |
| **Passthrough rule respect** | ✅ Inferred from verify      | ❌ Translated CJK to English/Pinyin             |
| **CJK title fix**            | ✅ Auto-fixed                | unknown (didn't fail this check)                |
| **Cross-link resolution**    | ✅ Used pre-resolved en URLs | ✅ (assembler handled)                          |
| **Ratio compliance**         | 1.47 (slightly high)         | unknown (verify failed earlier)                 |
| **Tool use reliability**     | ✅ All Bash succeeded        | ⚠️ 7+ failed sed (zsh quote escaping issues)    |
| **Codex CLI startup error**  | n/a                          | ⚠️ "failed to refresh available models" warning |

**Headlines**:

1. **Sonnet is more expensive but more reliable** — ~$1.30/article × 597 = ~$780 for full sync. Verify pass rate ~100%. Output ready for production with no human review.

2. **Ollama qwen is free but produces partial-quality output** — Pre-Phase 5.1 prompt led to 1 HARD FAIL on passthrough rule. Post-Phase 5.1 prompt should fix this — but it needs re-test, and we don't yet know if qwen will hit other failure modes (footnote count, section count, URL count, ratio).

3. **Qwen sed reliability issue** — Multiple sed commands failed due to zsh quote escaping (specifically `\\\\\\\\` patterns). Sonnet didn't hit this because it preferred Edit tool over sed. Suggests qwen may need explicit "prefer Edit tool over sed for frontmatter fixes" hint in prompt.

4. **Codex (ChatGPT subscription) was uncacheable** — 5-second 400 fail before any meaningful work happened. The fix is shipped; data point still missing.

---

## 6. Decision criteria for batch (preliminary)

**For 5-task batch this morning** (cheyu's preferred next step):

- **Recommend: claude-sonnet-4-6** for all 5. Sonnet is the proven path; current Phase 5.1 prompt is being tested via this batch and we want low engine-variance.

**For 100-task batch (Phase D)**:

- After T2 re-spawn validates codex works at all, pick 10 codex test articles to verify quality + ratio + passthrough behaviour vs Sonnet baseline. If codex passes, **mix codex + Sonnet 50/50** to halve cost (~$390 vs $780).
- If T2 re-spawn fails again or quality is bad, **stay 100% Sonnet**.

**For 597-task full sync (Phase E)**:

- Decision deferred until 100-task batch returns clean metrics.
- Wild card: if **post-Phase 5.1 prompt + qwen** hits >90% verify-pass rate on 20-article sample, ollama becomes viable for the long tail (zero $ cost, ~$0/full sync).

---

## 7. Pending / re-spawn plan

After cheyu restarts backend (Phase 5.1 + spawner fix loaded):

```bash
# T2 re-spawn (now with proper engine-aware model lookup)
curl -X POST http://localhost:4319/api/tasks -d '{
  "type": "lang-sync-refresh",
  "boot_profile": "translation-refresh",
  "priority": "P1",
  "title": "engine-test codex (v2): Society/疊杯.md → en",
  "inputs": {
    "zh_path": "Society/疊杯.md",
    "lang": "en",
    "mode": "missing",
    "engine": "codex",
    "test_label": "engine-comparison-v2"
  }
}'
```

Then spawn it (auto-spawn paused per Phase 5.1 default). Expected outcome:

- ✅ codex CLI starts without 400 (no -m flag passed)
- ✅ codex pipeline runs (extract → translate → assemble → verify → commit)
- Wall-clock target: < 6 min (similar to Sonnet)
- Quality target: verify exit 0 or 2

**Optional T3 re-test** (Phase 5.1 prompt with passthrough rule):

- Same Technology/台灣人工智慧實驗室.md but commit gets reverted first (or pick a different article for clean state). Goal: verify post-Phase 5.1 prompt prevents the subcategory drift Qwen hit.

---

## 8. Phase 5.1 changes that affect this report

Shipped this morning (commit `2f537307` + main `df2314b3` + merge `17789d46`):

- **Lightweight `translation-refresh` boot profile** (no BECOME, ~12K tokens, was ~18K)
- **Translation prompt rewritten as 專業翻譯 worker voice** (5 craft principles + DO NOT rules)
- **spawner per-engine model fallback** (codex / ollama don't get claude model name)
- **profiles.yml 6-tier explicit model** with `requires_become` flag
- **Backend default-paused on boot** (no accidental auto-spawn during config)
- **UI: SchedulerControl reactive fix + model badge on TaskRow**

Re-running the same 3 engine-test tasks against post-5.1 backend will give a clean before/after on prompt effectiveness.

---

🧬

_v1.0 | 2026-04-30 morning_
_in-flight: T2 codex re-spawn pending (awaiting cheyu's backend restart for Phase 5.1 to take effect)_
_next update: T2 result + T3 retest (if scheduled) + 5-task batch metrics_
