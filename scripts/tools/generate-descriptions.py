#!/usr/bin/env python3
"""generate-descriptions.py - 自動產生延伸閱讀描述"""

import re
from pathlib import Path

def get_description(title):
    descriptions = {
        "台灣中小企業與隱形冠軍": "台灣經濟的基層力量，許多全球市場領先的專業廠商",
        "台灣農業與農村再生": "農村發展政策與地方創生的實踐案例",
        "新創生態系": "台灣新創公司的成長軌跡與創業環境",
        "台灣開源精神": "台灣開源社群的發展與貢獻",
        "台灣網路社群遷徙史": "網路社群平台的興替與使用者行為的變化",
        "台灣人工智慧實驗室": "AI 研究機構與技術發展的歷史",
        "台灣 AI 日常": "AI 技術在日常生活中的應用",
        "開源社群與 g0v": "台灣開源社群的協作模式與公民科技運動",
        "台灣散文": "台灣散文文學的發展與代表作家",
        "台灣文學史": "台灣文學的歷史發展與重要作品",
        "台灣捷運發展史": "台北捷運的建設歷程與對城市的影響",
        "台灣交通系統": "台灣整體交通網絡的架構與發展",
        "台灣咖啡文化": "台灣咖啡產業的興起與咖啡廳文化",
        "夜生活與 KTV 文化": "台灣夜生活文化與 KTV 的社會意義",
        "台灣聲音地景": "台灣的聲音環境與聲音藝術創作",
        "台灣外貿與全球供應鏈": "台灣對外貿易與全球供應鏈的角色",
        "台灣產業轉型升級": "台灣產業的升級轉型與創新發展",
        "台灣自媒體創作者經濟": "自媒體創作者的經濟模式與內容產業",
        "台灣交通運輸網絡": "台灣交通運輸系統的整體架構",
        "台灣水庫與水資源管理": "台灣水資源的開發與管理政策",
        "台灣宗教與寺廟文化": "台灣宗教信仰與寺廟文化的特色",
        "台灣茶道與生活美學": "台灣茶文化的發展與生活美學",
        "台灣婚喪喜慶與人生禮俗": "台灣傳統人生禮俗與節慶文化",
        "語言多樣性與母語文化": "台灣語言多樣性與母語復振運動",
        "台灣農業現代化發展": "台灣農業的現代化進程與政策",
        "台灣石虎保育": "台灣石虎的保育現狀與挑戰",
        "台灣黑熊保育": "台灣黑熊的生態研究與保育工作",
        "台灣穿山甲": "台灣穿山甲的生態特性與保育議題",
        "台灣皇蛾": "台灣皇蛾的生態特徵與棲地保護",
     }
    if title in descriptions:
        return descriptions[title]
    if "經濟" in title:
        return "台灣經濟發展的重要面向"
    if "產業" in title:
        return "台灣產業的發展與創新"
    if "文化" in title:
        return "台灣文化的重要面向"
    if "歷史" in title:
        return "台灣歷史的重要事件"
    if "交通" in title:
        return "台灣交通建設與運輸系統"
    if "農業" in title:
        return "台灣農業的發展與政策"
    if "保育" in title or "生態" in title:
        return "台灣生態保育與環境保護"
    if "文學" in title or "散文" in title:
        return "台灣文學的發展與作品"
    return "相關主題的延伸閱讀"

def fix_article(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    fixed = False

    for i, line in enumerate(lines):
         # 修正雙重格式
        if '](- [' in line:
            match = re.match(r'^(\s*)-\ \[([^\]]+)\]\(\[([^\]]+)\]\(([^)]+)\)\)\)\s*—\s*(.+)$', line)
            if match:
                indent = match.group(1)
                link_text = match.group(2)
                url = match.group(4)
                desc = match.group(5)
                lines[i] = f"{indent}- [{link_text}]({url}) — {desc}"
                fixed = True
            continue

         # 修正缺少閉括號的連結
        if '](' in line and line.count('(') > line.count(')'):
            match = re.match(r'^(\s*- \[([^\]]+)\]\(([^)]+)\) — (.+))$', line)
            if match:
                indent = match.group(1)
                link_text = match.group(2)
                url = match.group(3)
                desc = match.group(4)
                lines[i] = f"- [{link_text}]({url}) — {desc}"
                fixed = True
            continue

         # 檢查是否有沒有描述的連結
        match = re.match(r'^(\s*- \[([^\]]+)\]\([^)]+)\)$', line)
        if match:
            link_text = match.group(2)
            desc = get_description(link_text)
            lines[i] = f"{match.group(1)} — {desc}"
            fixed = True

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
