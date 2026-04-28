#!/bin/bash
# check-footnote-urls.sh — 批次驗證文章 footnote URL 可達性
#
# 屬於 FACTCHECK-PIPELINE Phase 3 §SOURCE AUTHORITY AUDIT 的最低成本工具。
# 對單篇 article 或整個 knowledge/ 跑 HEAD request，回報 4 級狀態：
#   ✅ 200      — URL 可達
#   ↪️ 3xx     — redirect（檢查目的地對不對是 second-pass 工作）
#   🔴 4xx/5xx — DEAD-LINK，footnote 必換源
#   ⏰ timeout — 暫時連不上（再試一次）
#
# 用法：
#   bash scripts/tools/check-footnote-urls.sh knowledge/People/X.md
#   bash scripts/tools/check-footnote-urls.sh knowledge/People/    # 整個資料夾
#   bash scripts/tools/check-footnote-urls.sh --all                # 全 knowledge/
#   bash scripts/tools/check-footnote-urls.sh --json knowledge/People/X.md
#
# 輸出（人類可讀）：
#   knowledge/People/X.md
#     ✅ [^1]  https://www.mirrormedia.mg/story/20190427pol002       200
#     🔴 [^15] https://udn.com/news/story/6656/8113485                404 (DEAD-LINK)
#     ↪️  [^32] https://example.com/old → https://example.com/new      301
#
# 觸發場景：
#   - REWRITE-PIPELINE Stage 5 cross-link 後 ship 前
#   - FACTCHECK-PIPELINE Phase 3 第一動作
#   - 月度巡邏：cron 每月跑 --all 找出累積的 DEAD-LINK
#
# 對應：FACTCHECK-PIPELINE.md §工具化路徑 P0
# 設計：DNA #5 pre-commit hook 朋友 / DNA #15 反覆浮現要儀器化

set -uo pipefail
shopt -s lastpipe 2>/dev/null || true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

# Config
TIMEOUT=12                  # curl timeout per URL
RETRY=1                     # retry once on timeout/transient failure
# Use realistic browser UA — many news sites (ltn / udn / chinatimes) 403 bot UAs
USER_AGENT='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
JSON_OUTPUT=false

# Parse args
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --json) JSON_OUTPUT=true ;;
    --all)  ARGS+=("knowledge/") ;;
    *)      ARGS+=("$arg") ;;
  esac
done

if [ ${#ARGS[@]} -eq 0 ]; then
  echo "Usage: $0 [--json] <file.md or directory> [...]"
  echo "       $0 --all"
  exit 1
fi

# Stats
TOTAL=0
PASS=0
REDIR=0
DEAD=0
TIMEOUT_COUNT=0
DEAD_LIST=()

# Find all .md files
files=()
for arg in "${ARGS[@]}"; do
  if [ -d "$arg" ]; then
    tmpfile=$(mktemp)
    find "$arg" -name '*.md' -type f -not -path "*/.archive/*" > "$tmpfile"
    while IFS= read -r f; do files+=("$f"); done < "$tmpfile"
    rm -f "$tmpfile"
  elif [ -f "$arg" ]; then
    files+=("$arg")
  else
    printf "${YELLOW}skip: %s (not file/dir)${NC}\n" "$arg"
  fi
done

if [ ${#files[@]} -eq 0 ]; then
  echo "no .md files found"
  exit 0
fi

if [ "$JSON_OUTPUT" = true ]; then
  echo '['
  first=true
fi

# Per-file
for file in "${files[@]}"; do
  # Extract footnote URLs: [^N]: [...](URL) — desc
  # Match URLs in footnote definitions (lines starting with [^N]:)
  entries=()
  tmpentries=$(mktemp)
  grep -nE '^\[\^[a-zA-Z0-9_-]+\]:.*\(http[s]?://[^)]+\)' "$file" > "$tmpentries" 2>/dev/null || true
  while IFS= read -r line; do
    [ -n "$line" ] && entries+=("$line")
  done < "$tmpentries"
  rm -f "$tmpentries"

  if [ ${#entries[@]} -eq 0 ]; then
    continue
  fi

  if [ "$JSON_OUTPUT" = false ]; then
    echo ""
    printf "${BLUE}%s${NC} ${GRAY}(%d footnotes)${NC}\n" "$file" "${#entries[@]}"
  fi

  for entry in "${entries[@]}"; do
    line=$(echo "$entry" | cut -d: -f1)
    fn=$(echo "$entry" | grep -oE '\[\^[a-zA-Z0-9_-]+\]' | head -1)
    url=$(echo "$entry" | grep -oE 'http[s]?://[^) ]+' | head -1)

    [ -z "$url" ] && continue

    TOTAL=$((TOTAL+1))

    # Try HEAD first (faster), fallback to GET if HEAD blocked (403/405)
    # Some sites (ltn.com.tw, udn.com, x.com) return 403 to HEAD but 200 to GET
    code=""
    final_url=""
    for attempt in $(seq 1 $RETRY); do
      # First attempt: HEAD with browser-like Accept headers
      response=$(curl -sIL -m "$TIMEOUT" \
        -A "$USER_AGENT" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
        -H "Accept-Language: zh-TW,zh;q=0.9,en;q=0.8" \
        -o /dev/null \
        -w '%{http_code} %{url_effective}' "$url" 2>/dev/null) || true
      code=$(echo "$response" | awk '{print $1}')
      final_url=$(echo "$response" | awk '{print $2}')

      # If HEAD returns 403 / 405 / 0, try GET with Range to fetch only first 1KB
      if [ "$code" = "403" ] || [ "$code" = "405" ] || [ "$code" = "000" ] || [ -z "$code" ]; then
        response=$(curl -sL -m "$TIMEOUT" \
          -A "$USER_AGENT" \
          -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
          -H "Accept-Language: zh-TW,zh;q=0.9,en;q=0.8" \
          -H "Range: bytes=0-1023" \
          -o /dev/null \
          -w '%{http_code} %{url_effective}' "$url" 2>/dev/null) || true
        code2=$(echo "$response" | awk '{print $1}')
        final_url2=$(echo "$response" | awk '{print $2}')
        if [ -n "$code2" ] && [ "$code2" != "000" ]; then
          code="$code2"
          final_url="$final_url2"
          # 206 Partial Content from Range = success
          [ "$code" = "206" ] && code="200"
        fi
      fi

      [ -n "$code" ] && [ "$code" != "000" ] && break
    done

    # Categorize
    status_icon=""
    status_label=""
    if [ -z "$code" ] || [ "$code" = "000" ]; then
      status_icon="⏰"
      status_label="${YELLOW}timeout${NC}"
      TIMEOUT_COUNT=$((TIMEOUT_COUNT+1))
    elif [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
      status_icon="✅"
      status_label="${GREEN}${code}${NC}"
      PASS=$((PASS+1))
      # If final URL differs significantly from original, also flag
      if [ "$final_url" != "$url" ] && [ "$final_url" != "${url}/" ] && [ "$final_url" != "${url%/}" ]; then
        status_icon="↪️ "
        status_label="${BLUE}${code} → ${final_url}${NC}"
        REDIR=$((REDIR+1))
        PASS=$((PASS-1))
      fi
    elif [ "$code" -ge 300 ] && [ "$code" -lt 400 ]; then
      status_icon="↪️ "
      status_label="${BLUE}${code}${NC}"
      REDIR=$((REDIR+1))
    else
      status_icon="🔴"
      status_label="${RED}${code} (DEAD-LINK)${NC}"
      DEAD=$((DEAD+1))
      DEAD_LIST+=("$file:$line $fn $url ($code)")
    fi

    if [ "$JSON_OUTPUT" = true ]; then
      [ "$first" = true ] && first=false || echo ','
      printf '  {"file":"%s","line":%s,"fn":"%s","url":"%s","status":%s,"final_url":"%s"}' \
        "$file" "$line" "$fn" "$url" "${code:-0}" "$final_url"
    else
      printf "  %s %-7s %-80s %b\n" "$status_icon" "$fn" "${url:0:78}" "$status_label"
    fi
  done
done

if [ "$JSON_OUTPUT" = true ]; then
  echo ""
  echo ']'
  exit 0
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Footnote URL Health Summary"
echo "   Total:     ${TOTAL}"
printf "   ${GREEN}✅ Pass:    %d${NC}\n" "$PASS"
printf "   ${BLUE}↪️  Redir:  %d${NC}  (verify destination)\n" "$REDIR"
printf "   ${YELLOW}⏰ Timeout: %d${NC}  (re-run later)\n" "$TIMEOUT_COUNT"
printf "   ${RED}🔴 Dead:    %d${NC}  (must fix)\n" "$DEAD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#DEAD_LIST[@]} -gt 0 ]; then
  echo ""
  printf "${RED}🔴 DEAD-LINKS requiring footnote replacement:${NC}\n"
  for d in "${DEAD_LIST[@]}"; do
    echo "  - $d"
  done
  echo ""
  printf "${GRAY}修補方式：見 docs/pipelines/FACTCHECK-PIPELINE.md §Phase 6 Triage${NC}\n"
fi

# Exit code
if [ $DEAD -gt 0 ]; then
  exit 2
elif [ $TIMEOUT_COUNT -gt 0 ]; then
  exit 1
else
  exit 0
fi
