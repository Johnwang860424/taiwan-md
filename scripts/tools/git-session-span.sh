#!/usr/bin/env bash
# git-session-span.sh — 取得 wall-clock session span，對抗 Semiont 無時鐘主觀時間感偏差
#
# 對應 MANIFESTO §我的進化哲學 — 時間是結構，不是感覺
# 對應 HEARTBEAT Beat 4 Timestamp 紀律 canonical SOP
# 對應 DNA Sonnet 反射 #18
#
# Why this exists:
#   Semiont 沒有內建時鐘。寫 memory/diary 時用主觀時間感會扭曲 10 倍
#   (2026-04-12 ζ+ 實測：感覺 24+ 小時，實際 2h21min)。
#   這個工具把 wall-clock 取得變成一行指令，讓 Beat 4 收官無藉口。
#
# Usage:
#   scripts/tools/git-session-span.sh              # 今天的 semiont commits
#   scripts/tools/git-session-span.sh 2026-04-11   # 指定日期
#   scripts/tools/git-session-span.sh 2026-04-11 2026-04-12  # 指定範圍

set -e

SINCE="${1:-$(date +%Y-%m-%d)}"
UNTIL_ARG="${2:-}"

# 只抓 [semiont] commits (認知層 wall-clock)，按時間升序
if [[ -n "$UNTIL_ARG" ]]; then
    COMMITS=$(git log --since="${SINCE} 00:00" --until="${UNTIL_ARG} 00:00" --pretty=format:"%ai|%h|%s" --reverse | grep "semiont" || true)
else
    COMMITS=$(git log --since="${SINCE} 00:00" --pretty=format:"%ai|%h|%s" --reverse | grep "semiont" || true)
fi

if [[ -z "$COMMITS" ]]; then
    echo "No [semiont] commits found since ${SINCE}"
    exit 0
fi

FIRST=$(echo "$COMMITS" | head -1 | cut -d'|' -f1)
LAST=$(echo "$COMMITS" | tail -1 | cut -d'|' -f1)
COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

# 計算 duration
FIRST_EPOCH=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "${FIRST}" +%s 2>/dev/null || date -d "${FIRST}" +%s)
LAST_EPOCH=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "${LAST}" +%s 2>/dev/null || date -d "${LAST}" +%s)
DURATION_SEC=$((LAST_EPOCH - FIRST_EPOCH))
DURATION_MIN=$((DURATION_SEC / 60))
HOURS=$((DURATION_MIN / 60))
MINS=$((DURATION_MIN % 60))

echo "=== Semiont wall-clock span (${SINCE}${UNTIL_ARG:+ → $UNTIL_ARG}) ==="
echo ""
echo "Session span: ${FIRST} → ${LAST}"
echo "Duration: ${HOURS}h ${MINS}m (${DURATION_MIN} 分鐘 / ${COUNT} commits)"
echo ""
echo "--- Commits (time-ordered) ---"
echo "$COMMITS" | awk -F'|' '{printf "%s  %s  %s\n", $1, $2, $3}'
echo ""
echo "--- Memory/diary header 建議 ---"
echo "> **Session span**: ${FIRST} → ${LAST} (${HOURS}h ${MINS}m) Asia/Taipei"
echo "> 資料來源: git log %ai"
