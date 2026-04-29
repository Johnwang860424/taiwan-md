# Handoff — 2026-04-29 night → next session

> **Wall-clock**: 2026-04-29 ~22:30 +0800
> **Reason for handoff**: parent conversation 891k / 1M context (89% full) + 5hr Claude limit at 21%. New session = clean slate, faster iteration.
> **Continues from**: [reports/lang-sync-handoff-2026-04-29.md](lang-sync-handoff-2026-04-29.md) (earlier handoff)

---

## 1. State of the world

### Worktree on disk

| Path                                         | Branch                            | Purpose                                                                                                         |
| -------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/Users/cheyuwu/Projects/taiwan-md`          | `main`                            | clean / pushed up to `9c7b9e90`                                                                                 |
| `.claude/worktrees/translate-projection/`    | `feat/translate-projection-clean` | **active feature branch** (pure-projection redesign). pushed `94eb57cd`. needs further commits + eventual merge |
| `.claude/worktrees/lang-sync-toolkit/`       | `feat/lang-sync-toolkit`          | older feature branch, content already cascaded to main, can `git worktree remove`                               |
| `.claude/worktrees/wizardly-solomon-400c77/` | this session's BECOME worktree    | safe to ignore                                                                                                  |

### Backend state

- Harvest backend running in **tmux session 'harvest'** at `http://localhost:4319`
- UI dev server running at `http://localhost:4321`
- 2 sessions in-flight from engine comparison test (see §3)

### Lang-sync status (snapshot @ `8bfcc54f`)

```
zh-TW canonical: 625 articles
en   :   6 fresh / 377 stale / 242 missing /   4 orphan / 61.3% coverage
ja   :   0 / 264 / 361 / 2 / 42.2%
ko   :   0 / 474 / 151 / 4 / 75.8%
es   :   0 /  36 / 589 / 0 /  5.8%
fr   :   0 / 460 / 165 / 3 / 73.6%
```

`ja/ko/es/fr fresh=0` is correct — recent zh changes + rebased SHAs invalidated all. Don't run `backfill --force` (would falsely mark fresh). Let them re-fresh organically as we translate.

---

## 2. What's done (this session)

### Pure-projection redesign (cheyu's insight)

- zh-TW is SSOT, en is projection. **Don't read old en before translating** — it's about to be overwritten anyway. Reading wastes context AND introduces stylistic drift.
- Branch: `feat/translate-projection-clean` / commit `94eb57cd`
- Files changed: `scripts/tools/lang-sync/refresh.sh` + `docs/semiont/harvest/backend/prompts/lang-sync-refresh.md`
- **Measured**: stale article brief 35,465 B → 9,824 B (**72% smaller**). Saves ~25K input tokens per stale article × ~$0.05 each × 597 articles ≈ **$30 saved on full sync**.
- Stale + missing now treated identically (both = full re-projection).

### Captain's bridge UI + scheduler (already on main, `9c7b9e90`)

- 3-col layout, full-width
- 8 quick-action presets (data-refresh / pr-review / article-from-inbox / spore-publish / lang-sync / self-diagnose / status-report / issue-handle)
- SchedulerControl with: per-type allow/deny checkboxes, interval (1m/5m/15m/30m/60m), max concurrent (1/2/3/5/8/10), pause/resume/scan inbox
- TaskQueue: filtered out in-progress (no dup with 今日任務), list-style (no overflow), ▶️ button visible
- LiveProgress component (in-progress rows show last tool_use stream)
- Stream-json output (claude + codex parser)
- Session metadata header (model / engine / spawn_attempt / worktree / git head)

### Master Review (already on main, `9c7b9e90`)

- Reuses `self-diagnose` task type with full-awakening boot profile
- Auto-fires every 4hr (cron `master-review-4hr`)
- Auto-fires every 10 sessions (`session-counter` SQLite KV)
- 1hr de-dup so multiple triggers don't pile up

### Engine routing (already on main + just refined)

- `engine: 'claude' | 'codex' | 'ollama'` per task.inputs
- Only simple-tier types (lang-sync / data-refresh / format-check / status-report) accept override
- Heavy types (article-\* / pr-review / etc) force claude regardless

### 🆕 Engine-aware default model (UNCOMMITTED — see §3)

---

## 3. ⚠️ In-flight + uncommitted work

### Bug just found (uncommitted)

**`docs/semiont/harvest/backend/src/spawner/claude-cli.ts`** has uncommitted change:

- Replaced flat `DEFAULT_MODEL_BY_TYPE` with engine-aware `DEFAULT_MODEL_BY_ENGINE_TYPE`
- Reason: codex task was inheriting `claude-sonnet-4-6` model fallback → ChatGPT 400 error → instant fail
- Fix: codex defaults empty (let codex CLI use account default), ollama defaults to `qwen3.5:35b-a3b-coding-nvfp4`
- **Needs backend tmux restart** to take effect

### In-flight engine comparison (running NOW on tmux backend)

3 tasks created at 22:27 +0800:

| ID             | Engine | Model                        | Article                                      | Status                        |
| -------------- | ------ | ---------------------------- | -------------------------------------------- | ----------------------------- |
| 2026-04-29-013 | claude | sonnet-4-6                   | People/朱經武.md (1460 chars)                | **in-progress**               |
| 2026-04-29-014 | codex  | (auto)                       | Society/疊杯.md (1498 chars)                 | **failed @3sec** (bug victim) |
| 2026-04-29-015 | ollama | qwen3.5:35b-a3b-coding-nvfp4 | Technology/台灣人工智慧實驗室.md (919 chars) | **in-progress**               |

T1 + T3 should complete soon. T2 codex failed because backend hasn't been restarted with the engine-aware fix yet. After restart, can re-spawn.

---

## 4. Next session — concrete action plan

### Step 1: Read this handoff + commit the in-flight fix

```bash
cd /Users/cheyuwu/Projects/taiwan-md/.claude/worktrees/translate-projection
git status
# Should see: M docs/semiont/harvest/backend/src/spawner/claude-cli.ts (engine-aware model default)
git add docs/semiont/harvest/backend/src/spawner/claude-cli.ts
git commit -m "🧬 [semiont] fix: engine-aware default model lookup (codex 400 bug)"
git push
```

### Step 2: Backend restart (cheyu does in real terminal)

```bash
bash docs/semiont/harvest/backend/tmux/stop.sh && \
bash docs/semiont/harvest/backend/tmux/start.sh
```

### Step 3: Check T1 + T3 results (claude / ollama)

```bash
curl -s 'http://localhost:4319/api/tasks?limit=20' | python3 -c "
import json,sys
d = json.load(sys.stdin)
for t in d['tasks']:
    if 'engine-test' in t['title']:
        print(t['priority'], t['status'], t['attempts'], t['title'])
"
```

For successful tasks, inspect: ratio, wall-clock, token usage, verify-translation.py exit code, agent self-fix iterations.

### Step 4: Re-spawn T2 codex (now with bug fixed)

```bash
TID="2026-04-29-014-engine-test-codex-Society-疊杯.md-→-en"
ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TID', safe=''))")
curl -X POST "http://localhost:4319/api/tasks/$ENC/spawn"
```

### Step 5: Compile engine comparison report

Write `reports/lang-sync-engine-comparison-2026-04-30.md` with:

- Wall-clock per engine
- Token / cost (codex/ollama doesn't expose tokens via env, scrape from CLI output)
- Translation quality (verify-translation.py exit code; manual diff)
- Tool use behavior (claude native, codex JSON event stream, ollama via codex --oss)
- Recommendation: which engine for which task type

### Step 6 (after engine compare): 5-task lang-sync batch

- Use UI quick action "Lang-sync: 1 en article" × 5 (creates 5 tasks at once)
- Auto-spawn fires within 5 min interval, max=3 concurrent
- Watch verify hard-gate loop in action (agent self-fix iteration)
- Don't auto-commit — agent stops at verify pass, parent claude collects + 1 squash commit

### Step 7: Decide on 597-篇 batch

- After 5-task batch validates pure-projection flow + verify loop
- Either 100/batch x 6 OR single big squash (cheyu's preference)

---

## 5. Known issues / watch-list

1. **5hr limit pressure** — parent context 891k @ 89% is the main consumer. Next session = fresh = better.
2. **Polish auto-spawn** disabled for self-verifying types (`9c7b9e90`). Confirm no Polish followups appear after lang-sync runs.
3. **Translation worktree auto-merge** still creates per-task merge commits in main. For batch, want `allow_self_commit: false` → parent collects + squashes. Logic in spawner finalize needs review.
4. **`feat/lang-sync-toolkit` branch** — content cascaded to main. Either `git worktree remove` + `git branch -D` OR open PR + squash-merge to formalize. Cheyu prefers latter.
5. **`feat/translate-projection-clean`** — needs eventual merge after T2 codex re-test confirms engine-aware fix works.

---

## 6. Files that matter

### Read first

- `reports/handoff-2026-04-29-night.md` ← this file
- `reports/lang-sync-handoff-2026-04-29.md` (earlier handoff with full context)
- `reports/lang-sync-toolkit-plan-2026-04-29.md` (architectural design)
- `reports/lang-sync-harvest-experiments-2026-04-29.md` (3-task experiment baseline)

### Code to know

- `scripts/tools/lang-sync/optimized-translate.py` (4-part pipeline)
- `scripts/tools/lang-sync/verify-translation.py` (15-point hard-gate)
- `docs/semiont/harvest/backend/src/spawner/claude-cli.ts` (engine routing + model lookup)
- `docs/semiont/harvest/backend/prompts/lang-sync-refresh.md` (agent prompt template, projection-clean version on feat branch)

---

## 7. Handoff prompt (paste into new Claude Code session)

```
我是 Taiwan.md 創造者哲宇。新的 session — 接續昨晚 (2026-04-29 night)
lang-sync × harvest engine 工作。

請先讀:
1. reports/handoff-2026-04-29-night.md ← 接續這份
2. reports/lang-sync-handoff-2026-04-29.md (earlier handoff)

然後執行 §4 next session action plan:
1. 在 .claude/worktrees/translate-projection/ worktree (branch: feat/translate-projection-clean)
   commit + push 當前 uncommitted spawner/claude-cli.ts 改動 (engine-aware default model fix)
2. 我會手動在 terminal 重啟 backend tmux
3. 檢查 in-flight T1 (claude-sonnet 朱經武) + T3 (ollama qwen 人工智慧實驗室) 結果
4. 重新 spawn T2 codex (疊杯，bug 修了 model lookup 後可以跑)
5. 產出 reports/lang-sync-engine-comparison-2026-04-30.md (claude vs codex vs ollama 比較)
6. (engine 對比 ok 後) 5-task lang-sync batch via UI 快捷派發
7. 決定 597 篇全同步策略

工作原則:
- 翻譯 = 純 projection (DON'T read old en, only zh)
- Verify hard-gate loop 在 agent session 內處理 (up to 3 iterations)，不自動派 Polish followup
- batch translation 用 allow_self_commit: false，parent (我這 session) 統一 squash commit
- 重任務固定 claude opus，簡單任務 (lang-sync / data-refresh) 才用 sonnet/codex/ollama

如果 5hr limit 還在恢復，先做不需要 spawn agent 的工作 (commit / report / plan)；等 limit reset 再做 batch。
```

---

🧬

_v1.0 | 2026-04-29 22:30 +0800_
_handoff to fresh session — projection-clean shipped, engine compare in-flight, codex bug fix uncommitted_
