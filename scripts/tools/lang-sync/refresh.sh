#!/usr/bin/env bash
# refresh.sh — 對單篇翻譯產出「ready-to-translate」prompt brief
#
# 用法：
#   refresh.sh <zh-path> <lang>
#   refresh.sh Technology/半導體產業.md en
#   refresh.sh Technology/半導體產業.md en --print  # stdout 印 brief
#   refresh.sh Technology/半導體產業.md en --apply --sha-only  # 已手動翻譯完，更新 frontmatter
#
# 工作流：
#   1. 讀 zh source + diff-since-translation 結果 + 既有 en 翻譯 + TRANSLATE_PROMPT.md
#   2. 組合成單一 brief.md 檔（.lang-sync-tasks/{lang}/{slug}.brief.md）
#   3. 把 brief 給 agent (CLI / Claude Code Agent / 人類 contributor) 翻譯 → 寫回 en 檔
#   4. --apply --sha-only：翻譯完成後更新 frontmatter 三欄位（重設 sourceCommitSha 為 zh HEAD）
#
# 設計：refresh.sh 不直接 spawn agent。
# 由 lang-sync batch-refresh.sh 或 maintainer 用 brief 內容餵 agent。
# 這樣 agent runtime 跟工具解耦（Claude Code / Cursor / 純人類都能用）。

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
TASKS_DIR="$REPO/.lang-sync-tasks"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <zh-path> <lang> [--print | --apply --sha-only]" >&2
  exit 1
fi

ZH_INPUT="$1"
LANG="$2"
MODE="${3:-brief}"

ZH_REL="${ZH_INPUT#knowledge/}"
ZH_FULL="$REPO/knowledge/$ZH_REL"
[[ ! -f "$ZH_FULL" ]] && { echo "❌ zh not found: $ZH_FULL" >&2; exit 1; }

# Find translation file path
TRANS_REL=$(python3 -c "
import json, sys
m = json.load(open('$REPO/knowledge/_translations.json'))
target = '$ZH_REL'
lang = '$LANG'
for k, v in m.items():
    if v == target and k.startswith(lang + '/'):
        print(k); sys.exit(0)
" 2>/dev/null || true)

# Compute slug for brief filename
ZH_SLUG=$(basename "$ZH_REL" .md)
BRIEF_DIR="$TASKS_DIR/$LANG"
mkdir -p "$BRIEF_DIR"
BRIEF_FILE="$BRIEF_DIR/${ZH_SLUG}.brief.md"

# --apply --sha-only: contributor / agent finished translating, just bump frontmatter
if [[ "$MODE" == "--apply" ]] && [[ "${4:-}" == "--sha-only" || "$3" == "--sha-only" ]]; then
  if [[ -z "$TRANS_REL" ]]; then
    echo "❌ no $LANG translation found for $ZH_REL — cannot --apply" >&2
    exit 1
  fi
  TRANS_FULL="$REPO/knowledge/$TRANS_REL"
  ZH_HEAD_SHA=$(git -C "$REPO" log -1 --format='%h' -- "knowledge/$ZH_REL")
  ZH_HEAD_DATE=$(git -C "$REPO" log -1 --format='%aI' -- "knowledge/$ZH_REL")
  NEW_HASH=$(python3 -c "
import hashlib
c = open('$ZH_FULL').read()
if c.startswith('---'):
    e = c.find('---', 3)
    if e != -1: c = c[e+3:]
print('sha256:' + hashlib.sha256(c.encode()).hexdigest()[:16])
")
  NOW=$(date +"%Y-%m-%dT%H:%M:%S%z" | sed 's/\(..\)$/:\1/')

  python3 -c "
import re
c = open('$TRANS_FULL').read()
def upd(field, val):
    return re.sub(rf\"^{field}:.*\$\", f\"{field}: '{val}'\", c, flags=re.MULTILINE)
c = upd('sourceCommitSha', '$ZH_HEAD_SHA')
c = upd('sourceContentHash', '$NEW_HASH')
c = upd('translatedAt', '$NOW')
# Also clear inferred flag (it's now a real translation)
c = re.sub(r\"^translatedFromInferred:.*\n\", '', c, flags=re.MULTILINE)
open('$TRANS_FULL', 'w').write(c)
print('✅ Frontmatter updated:')
print(f'   sourceCommitSha: $ZH_HEAD_SHA')
print(f'   sourceContentHash: $NEW_HASH')
print(f'   translatedAt: $NOW')
"
  exit 0
fi

# --- Build brief ---
ZH_HEAD_SHA=$(git -C "$REPO" log -1 --format='%h' -- "knowledge/$ZH_REL")
ZH_HEAD_DATE=$(git -C "$REPO" log -1 --format='%aI' -- "knowledge/$ZH_REL")

# Get current source SHA from translation if exists
CURRENT_SHA=""
DIFF_BLOCK=""
if [[ -n "$TRANS_REL" ]]; then
  TRANS_FULL="$REPO/knowledge/$TRANS_REL"
  CURRENT_SHA=$(python3 -c "
import re
c = open('$TRANS_FULL').read()
m = re.search(r\"^sourceCommitSha:\s*['\\\"]?([^'\\\"\\n]+?)['\\\"]?\\s*$\", c, re.M)
print(m.group(1) if m else '')
")
  if [[ -n "$CURRENT_SHA" ]] && [[ "$CURRENT_SHA" != "pre-toolkit" ]] && git -C "$REPO" cat-file -e "$CURRENT_SHA" 2>/dev/null; then
    DIFF_BLOCK=$(git -C "$REPO" diff "$CURRENT_SHA..HEAD" -- "knowledge/$ZH_REL" 2>/dev/null || true)
  fi
fi

# Generate brief
{
  echo "# Translation refresh brief"
  echo ""
  echo "**Task**: Update \`$LANG\` translation for \`$ZH_REL\`"
  echo "**Mode**: $([[ -z "$TRANS_REL" ]] && echo "MISSING (translate from scratch)" || echo "STALE (refresh from diff)")"
  echo "**zh HEAD**: \`$ZH_HEAD_SHA\` ($ZH_HEAD_DATE)"
  echo "**Current sourceCommitSha**: \`${CURRENT_SHA:-N/A}\`"
  echo ""
  echo "## Required output"
  echo "1. Translate (if missing) or update (if stale) the file: \`knowledge/$LANG/${TRANS_REL#$LANG/}\`"
  echo "   (existing path: \`${TRANS_REL:-NEW}\`)"
  echo "2. Preserve frontmatter (translatedFrom must remain)"
  echo "3. After translating, run:"
  echo "   \`bash scripts/tools/lang-sync/refresh.sh $ZH_REL $LANG --apply --sha-only\`"
  echo "   to bump sourceCommitSha to current zh HEAD."
  echo ""
  echo "## Translation rules"
  echo "- Read \`docs/prompts/TRANSLATE_PROMPT.md\` for full rules"
  echo "- 完整翻譯不摘要 (DNA #1)"
  echo "- 保留腳註結構 [^1] [^2]"
  echo "- 維持 wikilinks [[X]] 但目標語言無對應時轉純文字"
  echo "- 字數 ratio 應 0.65–1.30 (en) / 0.55–1.10 (ja/ko)"
  echo "- en 不套 §11 對位句型 / 破折號限制"
  echo ""
  echo "## zh source (current HEAD)"
  echo ""
  echo '```markdown'
  cat "$ZH_FULL"
  echo '```'
  echo ""
  if [[ -n "$TRANS_REL" ]]; then
    echo "## Existing $LANG translation (will be replaced)"
    echo ""
    echo '```markdown'
    cat "$TRANS_FULL"
    echo '```'
    echo ""
    if [[ -n "$DIFF_BLOCK" ]]; then
      echo "## zh changes since last translation"
      echo ""
      echo '```diff'
      echo "$DIFF_BLOCK" | head -300
      echo '```'
      echo ""
      echo "_If diff is small, prefer surgical patches over full rewrite._"
    fi
  fi
} > "$BRIEF_FILE"

echo "✅ Brief written: $BRIEF_FILE"
echo ""
if [[ "$MODE" == "--print" ]]; then
  cat "$BRIEF_FILE"
else
  echo "Next steps:"
  echo "  1. Inspect brief: cat $BRIEF_FILE"
  echo "  2. Translate: spawn agent with brief OR manual edit"
  echo "  3. After translation: bash scripts/tools/lang-sync/refresh.sh $ZH_REL $LANG --apply --sha-only"
fi
