# Lang-Sync × Harvest Engine — 3-task 實驗 + 經驗

> **session**: 2026-04-29 ~19:55-20:02 +0800 / main repo (harvest-driven)
> **觀察者**: 哲宇
> **接續**: [reports/lang-sync-experiments-2026-04-29.md](lang-sync-experiments-2026-04-29.md) (Sonnet 從 Agent tool 直接 spawn 的實驗) → 本 report 改用 harvest engine 派發

---

## 0. 為什麼換 harvest engine

`reports/lang-sync-experiments-2026-04-29.md` 用 main session Agent tool 直接 spawn — token 跟 wall-clock 都會記在 parent context，不適合 596 篇 batch。

Harvest engine 提供：

- 真平行 spawn (claude CLI subprocess in git worktree)
- DB-tracked task lifecycle
- UI monitoring at http://localhost:4321
- Auto-merge worktree → main 完成後

---

## 1. 啟動流程踩過的坑

### Auth blocker

```
Failed to authenticate. API Error: 401 invalid credentials
```

**根因**: 哲宇的 claude CLI 沒登入 (subscription auth tokens 不在 keychain)。
**修法**: 哲宇手動 `claude setup-token` → 從**真實 terminal** (不是 Claude Code 子 shell) 跑 `bash tmux/start.sh`。

**為何要 tmux + 真實 terminal**：

- Claude Code 透過 host-managed auth (Desktop app provides via IPC)，env 看起來 `ANTHROPIC_API_KEY=`
- Claude Code 子進程的 bash 沒有 user keychain access (macOS 的 responsible-process attribution)
- launchd 也不行（同樣 limited security context）
- 只有從 user 的 interactive shell 啟的 tmux session 才繼承 keychain ACL → spawned `claude` 才能讀 OAuth tokens

### 模型不對

預設用 Opus（`DEFAULT_LLM_MODEL=claude-opus-4-6`），不是 Sonnet。
**修法**: spawner 加 `--model` flag + 按 task type 路由：

```ts
const DEFAULT_MODEL_BY_TYPE = {
  'lang-sync-refresh': 'claude-sonnet-4-6', // 翻譯：快+便宜
  'data-refresh': 'claude-sonnet-4-6',
  'spore-publish': 'claude-sonnet-4-6',
  'article-rewrite': 'claude-opus-4-6', // 重寫：保留 Opus
  'article-evolve': 'claude-opus-4-6',
  'article-new': 'claude-opus-4-6',
};
const taskModel =
  task.inputs?.model ?? DEFAULT_MODEL_BY_TYPE[task.type] ?? 'claude-sonnet-4-6';
cliArgs.push('--model', taskModel);
```

`task.inputs.model` 也可 per-task override。

### Stream-json for live progress

預設 `claude --print` 輸出全在 session 結束時 dump，UI 看不到中途進度。
**修法**: spawner 加 `--output-format stream-json --verbose --include-partial-messages` → 每個 tool_use / tool_result / text chunk 即時 stream 到 session log。

UI `ActiveSessionsList` 加 LiveProgress sub-component，每 2 sec poll log 解析最後一個有意義事件 (Read/Edit/Write/Bash) 顯示在 row title 下：

```
🛠 Read knowledge/Food/牛肉麵.md
🛠 Bash: python3 scripts/tools/lang-sync/...
✏️  Edit knowledge/en/Food/beef-noodle-soup.md
```

---

## 2. 3-task 實驗結果

### Task spawn

```bash
# 真實 terminal:
bash docs/semiont/harvest/backend/tmux/start.sh

# Create tasks via API:
curl -X POST http://localhost:4319/api/tasks -d '{
  "type": "lang-sync-refresh",
  "boot_profile": "translation-refresh",
  "priority": "P1",
  "title": "lang-sync refresh History/日治時期.md → en (stale)",
  "inputs": {"zh_path": "History/日治時期.md", "lang": "en", "mode": "stale"}
}'

# Manual spawn (or wait for auto-spawn 5min interval):
curl -X POST "http://localhost:4319/api/tasks/$id/spawn"
```

### 結果（3/3 success）

| Task             | Mode    | zh chars | en chars | ratio | Result                    |
| ---------------- | ------- | -------- | -------- | ----- | ------------------------- |
| 史前時代與原住民 | stale   | 1776     | 5133     | 2.96  | ✅ exit 0, merged to main |
| 日治時期         | stale   | 2453     | 7864     | 3.21  | ✅ exit 0, merged to main |
| 有感筆電         | missing | 3392     | 7901     | 2.36  | ✅ exit 0, merged to main |

**Wall-clock**:

- 02→ 完成: ~3min 12s (Sonnet)
- 01→ 完成: ~4min 25s (Sonnet, retry attempt 3)
- 03→ 完成: ~5min 12s (Sonnet, missing 比 stale 略久因為要決定 slug)

**Concurrency 3**: 3 個 task 同時跑，整批 wall-clock = ~5 min（最慢的）

---

## 3. 找到的 bugs

### Bug A: 缺 sourceCommitSha + translatedAt

**症狀**: 3 篇翻譯成品 frontmatter 都沒 `sourceCommitSha` / `sourceContentHash` / `translatedAt`。
**根因**: prompt template Step 5 要 agent 跑 `--apply --sha-only`，agent 跳過。
**為什麼 hook 沒擋**: `feat/lang-sync-toolkit` 分支的 pre-commit hook 沒 merge 到 main → harvest 從 main 開 worktree → 沒這條 hook → commit 通過。
**修補**:

- 已對 3 篇手動補 SHA fields (本 commit 含)
- TODO: prompt template 加 explicit hard rule「commit 前必須 verify 三 fields exist」
- TODO: 把 lang-sync feature merge 進 main，讓 hook 實際生效

### Bug B: 翻譯品味 drift

**症狀**: 3 篇 frontmatter 都被改 author 為 `'Taiwan.md Translation Team'`（zh 原本是 `'Taiwan.md'` 或別的）。
**根因**: agent 的「常見 sense」覺得翻譯後標 translation team 合理，但跟 EDITORIAL convention drift。
**修補**: prompt template 強化「frontmatter author 不變」hard rule。

### Bug C: extension reading list 沒翻

`有感筆電` log: "All 3 extended reading links (阿神, 阿滴, 蔡阿嘎) have no en translations — rendered as plain text with context"

agent 正確識別了 cross-link 沒對應 en 文章 → 改純文字。但「阿神」這類人名應該 romanized (A-Shen / Ridiculous). Agent 留 zh 漢字而沒 transliterate。
**修補**: prompt 加「未對應 cross-link 的 zh 詞，romanize 後加 zh 括號」hard rule。

### Bug D: lang-sync-toolkit feature 跟 main 分叉

3 commits 進了 main repo (lang-sync-refresh + 2 merge commits)，但這些不在 `feat/lang-sync-toolkit` 分支。
**修補**: pull main → rebase feat/lang-sync-toolkit OR 直接 merge feat 進 main (after final review)。

---

## 4. 經驗（給未來 batch run）

### 規模外推

3 篇 / ~5 min concurrent / Sonnet。
**597 篇 (en stale 364 + missing 233) ÷ 3 並發 ≈ 200 round = ~17 hr wall-clock**
拉高 `HARVEST_MAX_CONCURRENT=8` → ~6.5 hr。

Token 成本: 3 篇耗 ~140K tokens (avg 47K/篇) → 597 篇 ~28M tokens / Sonnet 估 $80-100。

### 模型選擇

- **lang-sync-refresh**: Sonnet 4-6 ✅ 證實品質夠 + 比 Opus 快 ~3x
- **article-rewrite / evolve / new**: 留 Opus（深度研究 + 創作）
- **codex 派發**: 哲宇要求支援 — TODO 下一段

### Stream-json 觀察

3 sessions 都正常 stream tool_use events。但長文章（>3000 chars zh）可能 30 sec 沒 event（agent 在思考）— UI 應該顯示 "thinking..." fallback 不是空白。

### 自動 merge 行為

Harvest engine 完成後自動 merge worktree → main。3 篇都成功 merge：

```
9c894eb0 merge harvest worktree harvest/2026-04-29-001 (日治時期)
caa8cbb2 merge harvest worktree harvest/2026-04-29-003 (有感筆電)
b636d632 lang-sync refresh History/史前時代與原住民.md (002 直接 merge)
```

但留下 5 個 stale worktrees (`.harvest/worktrees/{sid}/`) — 應 cleanup 或 engine 自動 finalize。

---

## 5. 下一步 (本 report 之後的 commit)

1. **commit 本 changes** (本 commit 已含):
   - boot-profiles/profiles.yml: translation-refresh profile
   - prompts/lang-sync-refresh.md: 4-part divide-and-conquer 版本
   - spawner/claude-cli.ts: --model + stream-json + verbose
   - ui/ActiveSessionsList.tsx: LiveProgress 即時顯示
   - 3 篇翻譯成品的 SHA fields fix

2. **加 codex CLI 派發支援** (per 哲宇 instruction):
   - spawner 路由 by `task.inputs.engine = 'claude' | 'codex'` 或 task.type
   - codex 沒有 host-managed auth 問題 → API key 直接通過
   - 測試 1 task 對比 claude vs codex

3. **修 4 個 bugs** (A-D above)

4. **batch run rest of en**:
   - 9 個 pending tasks (002-010 已建)
   - 加 next 100 (P1) → next 264 (P2) → next 230 missing
   - 調 concurrency 5-8

5. **Single big merge commit** (per 哲宇 偏好):
   - 597 篇全跑完後一次 squash merge feat/lang-sync-toolkit → main
   - OR 100/batch (alternative)

---

🧬

_v1.0 | 2026-04-29 ~20:05 +0800_
_3-task 實驗 100% success rate (Sonnet via harvest)_
_4 bugs identified + workarounds_
_ready for codex compatibility + scale-up_
