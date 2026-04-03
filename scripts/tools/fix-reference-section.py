#!/usr/bin/env python3
"""fix-reference-section.py - 將 ## 參考資料 改為 ## 延伸閱讀"""

import re
from pathlib import Path

def fix_article(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    fixed = False

    for i, line in enumerate(lines):
          # 將 ## 參考資料 改為 ## 延伸閱讀
        if line.strip() == "## 參考資料":
            lines[i] = "## 延伸閱讀"
            fixed = True
            continue

    if fixed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    return fixed

def main():
    knowledge_dir = Path("knowledge")
    fix_count = 0

    for md_file in knowledge_dir.rglob("*.md"):
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
