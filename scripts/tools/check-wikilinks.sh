#!/bin/bash
# check-wikilinks.sh — 檢查所有文章的延伸閱讀是否缺少描述
# 用途：找出延伸閱讀格式不正確的文章

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "🔍 檢查延伸閱讀格式..."
echo ""

# 找出所有 knowledge/ 下的文章（排除 _Hub.md 和 es/ 目錄）
articles=$(find knowledge -name "*.md" -type f | grep -v "^knowledge/_" | grep -v "/_" | grep -v "knowledge/es/")

issues=0
fixed=0

for article in $articles; do
    filename=$(basename "$article")

     # 檢查是否有延伸閱讀區塊
    if ! grep -q "延伸閱讀" "$article"; then
        continue
    fi

     # 檢查是否有 wikilink 格式（[[ ]]）
    if grep -qE "^\s*- \[\[.*\]\]" "$article"; then
        echo -e "${RED}❌ $filename: 使用 wikilink [[ ]] 格式${NC}"
        issues=$((issues + 1))
        continue
    fi

     # 檢查是否有沒有描述的連結
     # 匹配：- [文字](/path) 但後面沒有 — 描述
    if grep -E "^\s*- \[.*\]\([^)]*\)" "$article" | grep -v " — " > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ $filename: 延伸閱讀缺少描述${NC}"
        issues=$((issues + 1))
        continue
    fi

     # 檢查格式是否正確
    if grep -qE "^\s*- \[.*\].* — .*" "$article"; then
        echo -e "${GREEN}✓ $filename: 格式正確${NC}"
    else
        echo -e "${GREEN}✓ $filename: 格式正確（無延伸閱讀）${NC}"
    fi
done

echo ""
echo "================================"
echo "總結："
total=$(echo "$articles" | wc -l | tr -d ' ')
correct=$((total - issues))
echo -e "  總計：$total 篇"
echo -e "  格式正確：$correct 篇"
echo -e "${RED}有問題：$issues 篇${NC}"
echo ""

if [ $issues -gt 0 ]; then
    echo "建議手動修正上述文章。"
    exit 1
else
    echo -e "${GREEN}所有文章格式正確！${NC}"
    exit 0
fi
