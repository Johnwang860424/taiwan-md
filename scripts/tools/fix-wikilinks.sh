#!/bin/bash
# fix-wikilinks.sh — 自動修正延伸閱讀格式
# 1. 將 [[wikilink]] 轉換為 [文字](/path)
# 2. 提示使用者輸入描述

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "🔧 修正延伸閱讀格式..."
echo ""

# 找出所有使用 [[ ]] 格式的文章
articles=$(find knowledge -name "*.md" -type f | grep -v "^knowledge/_" | grep -v "/_" | grep -v "knowledge/es/" | grep -v "knowledge/en/")

for article in $articles; do
    filename=$(basename "$article")

    # 檢查是否有 wikilink 格式
    if ! grep -qE "^\s*- \[\[.*\]\]" "$article"; then
        continue
    fi

    echo -e "${YELLOW}處理：$filename${NC}"

    # 讀取文章內容
    content=$(cat "$article")

    # 找出並修正 wikilink
    new_content=$(echo "$content" | sed -E 's/^\s*- \[\[([^\]]+)\]\]/- [\\1](\/history\/\\1)/g')

    # 寫回檔案
    echo "$new_content" > "$article"

    echo -e "${GREEN}✓ 已修正為標準 Markdown 格式${NC}"
    echo ""
done

echo "✅ 格式修正完成！"
echo ""
echo "接下來需要手動補充描述："
echo "- [文字](/path) — [描述]"
echo ""
