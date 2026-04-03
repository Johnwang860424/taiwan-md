#!/usr/bin/env python3
"""
fix-wikilinks.py — 自動修正延伸閱讀格式
將 [[wikilink]] 轉換為 [文字](/path) 格式
"""

import os
import re
from pathlib import Path

def fix_article(filepath):
    """修正單一文章的 wikilink 格式"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 找出所有 [[xxx]] 格式的 wikilink
    pattern = r'^\s*- \[\[([^\]]+)\]\]'

    matches = list(re.finditer(pattern, content, re.MULTILINE))
    if not matches:
        return False

    # 修正順序（從後往前，避免位置偏移）
    new_content = content
    for match in reversed(matches):
        wikilink_text = match.group(1)

        # 判斷 category
        category = ""
        if "History" in str(filepath):
            category = "history"
        elif "Geography" in str(filepath):
            category = "geography"
        elif "Culture" in str(filepath):
            category = "culture"
        elif "Food" in str(filepath):
            category = "food"
        elif "Art" in str(filepath):
            category = "art"
        elif "Music" in str(filepath):
            category = "music"
        elif "Technology" in str(filepath):
            category = "technology"
        elif "Nature" in str(filepath):
            category = "nature"
        elif "People" in str(filepath):
            category = "people"
        elif "Society" in str(filepath):
            category = "society"
        elif "Economy" in str(filepath):
            category = "economy"
        elif "Lifestyle" in str(filepath):
            category = "lifestyle"
        else:
            category = "general"

        # 建立路徑
        link_path = f"/{category}/{wikilink_text}"
        new_link = f"- [{wikilink_text}]({link_path})"

        new_content = new_content[:match.start()] + new_link + new_content[match.end():]

    # 寫回檔案
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return True

def main():
    knowledge_dir = Path("knowledge")
    fix_count = 0

    # 找出所有需要修正的文章
    for md_file in knowledge_dir.rglob("*.md"):
        # 排除 _Hub.md 和 es/ 目錄
        if "_Hub.md" in str(md_file):
            continue
        if "/_" in str(md_file) or "/es/" in str(md_file) or "/en/" in str(md_file):
            continue

        if fix_article(md_file):
            print(f"✓ 修正：{md_file.name}")
            fix_count += 1

    print(f"\n✅ 共修正 {fix_count} 篇文章")

if __name__ == "__main__":
    main()
