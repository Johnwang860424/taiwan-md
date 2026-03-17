# Taiwan.md 🇹🇼

**讓全世界完整認識台灣** | **Let the world truly understand Taiwan**

🌐 **Website:** [taiwan.md](https://taiwan.md) | 📖 **English:** [taiwan.md/en](https://taiwan.md/en) | 🕸️ **Graph:** [taiwan.md/graph](https://taiwan.md/graph)

[![GitHub stars](https://img.shields.io/github/stars/frank890417/taiwan-md?style=social)](https://github.com/frank890417/taiwan-md)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](CONTRIBUTING.md)

---

## 如何理解台灣？

> 台灣是一座面積只有 36,000 平方公里的島嶼，卻裝著整個世界的複雜度。

你可能知道台積電，但你知道台灣的便利商店密度世界第一嗎？
你可能吃過珍珠奶茶，但你知道台灣茶農每年用「比賽茶」的方式決一死戰嗎？
你可能聽說過台灣的民主，但你知道這座島在 40 年前還在戒嚴嗎？

**Taiwan.md 不是要給你答案。我們想做的，是給你一張地圖。**

---

## 🎯 Taiwan.md 是什麼？

一個**開源、AI-friendly、策展式**的台灣全面知識庫。

- 🎭 **策展式，非百科式** — 有觀點、有「為什麼這件事重要」
- 🤖 **AI-Friendly** — 結構化 Markdown，LLM 可直接引用。歡迎所有爬蟲（[robots.txt](https://taiwan.md/robots.txt) / [llms.txt](https://taiwan.md/llms.txt)）
- 🌍 **中英雙語** — 台灣人寫中文，社群翻英文
- 📐 **三層深度** — 30 秒概覽 → 5 分鐘了解 → 完整資料
- 🔓 **CC BY-SA 4.0** — 自由引用、改編、分享

---

## 📊 目前進度

| 指標 | 數量 |
|------|------|
| 中文文章 | 20+ 篇 |
| 英文文章 | 8 篇 |
| 內容面向 | 12 個 |
| 官方網站收錄 | 71 個 |

### 12 大面向

| | 面向 | 文章數 | 亮點 |
|---|------|--------|------|
| 📜 | [歷史 History](https://taiwan.md/history) | 6 | 史前→荷西→清治→日治→戒嚴→民主化 |
| 🗺️ | [地理 Geography](https://taiwan.md/geography) | — | 規劃中 |
| 🎭 | [文化 Culture](https://taiwan.md/culture) | 1 | 族群多元性 |
| 🍜 | [美食 Food](https://taiwan.md/food) | 3 | 夜市、小吃、茶文化 |
| 🎨 | [藝術 Art](https://taiwan.md/art) | 1 | 當代藝術 |
| 🎵 | [音樂 Music](https://taiwan.md/music) | 1 | 流行音樂與金曲獎 |
| 💻 | [科技 Technology](https://taiwan.md/technology) | 2 | 半導體、g0v 開源社群 |
| 🌿 | [自然 Nature](https://taiwan.md/nature) | 1 | 特有種 |
| 👥 | [人物 People](https://taiwan.md/people) | — | 規劃中 |
| ⚖️ | [社會 Society](https://taiwan.md/society) | 2 | 民主制度、人權與性別平等 |
| 📈 | [經濟 Economy](https://taiwan.md/economy) | 1 | 經濟奇蹟 |
| 🏠 | [生活 Lifestyle](https://taiwan.md/lifestyle) | 2 | 健保、便利商店文化 |

---

## 🏗️ 技術架構

```
taiwan.md
├── knowledge/          ← SSOT（唯一真相來源）
│   ├── zh-TW/          ← 中文知識庫
│   ├── en/             ← 英文知識庫
│   └── About/          ← 緣起、創辦人
├── src/
│   ├── content/        ← Astro 投影層（從 knowledge/ 同步）
│   ├── pages/          ← 頁面路由
│   ├── components/     ← UI 組件
│   └── layouts/        ← 版面配置
├── public/             ← 靜態資源（robots.txt, llms.txt, favicon）
├── scripts/            ← 工具腳本（sync-knowledge.sh）
├── EDITORIAL.md        ← 編輯方針
└── CONTRIBUTING.md     ← 貢獻指南
```

**投影原則：** `knowledge/` = SSOT → `src/content/` = 投影 → 網站 = 投影的投影

| 項目 | 選擇 |
|------|------|
| 框架 | [Astro v5](https://astro.build/) |
| 部署 | GitHub Pages |
| 域名 | [taiwan.md](https://taiwan.md)（.md = 摩爾多瓦 ccTLD ≈ Markdown） |
| 內容 | Markdown SSOT + Content Collections |
| SEO | Sitemap + OG tags + canonical + hreflang |
| AI | robots.txt（歡迎所有爬蟲）+ llms.txt |
| 分析 | GA4（G-JGC5W00N7T） |
| 授權 | CC BY-SA 4.0 |

---

## 🚀 快速開始

```bash
git clone https://github.com/frank890417/taiwan-md.git
cd taiwan-md
npm install
npm run dev          # http://localhost:4321
npm run build        # 建置靜態網站
```

### 同步 SSOT → 網站

```bash
bash scripts/sync-knowledge.sh    # knowledge/ → src/content/
```

---

## 🤝 如何貢獻

1. 📖 閱讀 [EDITORIAL.md](EDITORIAL.md) — 了解編輯方針和立場
2. 📖 閱讀 [CONTRIBUTING.md](CONTRIBUTING.md) — 貢獻流程
3. 🍴 Fork → 建分支 → 寫文章 → PR

### 文章放哪裡？

**永遠先修改 `knowledge/` 目錄**（SSOT），不直接改 `src/content/`。

```bash
# 新增中文文章
knowledge/Food/你的文章.md

# 新增英文文章
knowledge/en/Food/your-article.md

# 同步到網站
bash scripts/sync-knowledge.sh
```

### 文章格式

```markdown
---
title: "文章標題"
description: "一句話描述"
date: 2026-03-17
tags: ["tag1", "tag2"]
author: "Taiwan.md Contributors"
readingTime: 8
featured: false
---

# 文章標題

## 30 秒概覽
（一段摘要 + 關鍵數據）

## 為什麼重要
（這件事對理解台灣為什麼重要）

## 主要內容
（結構化深度內容）

## 延伸閱讀
（相關連結）
```

---

## 📋 路線圖

### Phase 0：基礎建設 ✅
- [x] Astro 專案骨架 + GitHub Pages
- [x] 域名 taiwan.md + DNS + HTTPS
- [x] 12 面向 × 中英雙語 content collections
- [x] 20+ 篇知識庫文章
- [x] EDITORIAL.md + robots.txt + llms.txt
- [x] GA4 + Google Search Console
- [x] 知識圖譜 /graph（D3.js）

### Phase 1：內容衝刺（進行中）
- [ ] 50 篇以上文章
- [ ] 首頁策展設計
- [ ] 所有分類至少 3 篇文章
- [ ] Structured Data（JSON-LD）
- [ ] 圖片策略（Wikimedia Commons）

### Phase 2：社群驅動
- [ ] Hacker News Show HN
- [ ] g0v 社群曝光
- [ ] awesome-taiwan 收錄
- [ ] 多語言（日/韓/法文）

### Phase 3：永續發展
- [ ] 贊助者版位（Gold/Silver/Bronze）
- [ ] API 端點
- [ ] 互動式資料視覺化

---

## 📄 授權

本專案採用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 授權。

你可以自由分享、改編、引用，唯須署名並以相同方式分享。

---

## 👤 關於

**發起人：** [吳哲宇 Che-Yu Wu](https://cheyuwu.com) — 新媒體藝術家、[MonoLab](https://monolab.world) 創辦人

威尼斯雙年展、Art Basel Miami、坎城 Immersive Market、巴黎 Cent Quatre 104 駐村。在國際場合不斷被問「台灣是什麼樣的地方」，卻發現沒有一個完整的入口可以指給外國朋友看。於是有了 Taiwan.md。

**聯繫：** cheyu.wu@monoame.com | [GitHub](https://github.com/frank890417) | [IG @cheyuwu345](https://instagram.com/cheyuwu345) | [Muse](https://muse.cheyuwu.com)

---

## 🌏 Inspiration & Benchmarks

我們研究了全球最好的國家知識傳播案例。Taiwan.md 的目標是**學習它們，然後超越它們**。

| 案例 | 國家 | 亮點 | 我們要做的更好 |
|------|------|------|---------------|
| [e-Estonia](https://e-estonia.com) | 🇪🇪 愛沙尼亞 | 國家數位品牌標竿，「劣勢→優勢」敘事弧線，三層內容金字塔 | 加入開源社群力量 + AI-friendly 結構 |
| [japan-guide.com](https://www.japan-guide.com) | 🇯🇵 日本 | 25+ 年歷史，外國人最信任的日本指南，結構化實用資訊 | 更深的文化脈絡 + 策展觀點 |
| [VisitKorea](https://english.visitkorea.or.kr) | 🇰🇷 韓國 | 韓流加持的觀光整合，K-Culture 行銷 | 不只觀光，完整知識圖譜 |
| [About Singapore](https://www.sg) | 🇸🇬 新加坡 | `.sg` 國家域名，政府級品牌設計，Smart Nation 定位 | 社群驅動 vs 政府驅動 |
| [SwissInfo](https://www.swissinfo.ch) | 🇨🇭 瑞士 | 10 種語言，深度新聞 + 國家知識，公共媒體品質 | Markdown SSOT + 開源協作 |
| [Taiwan.gov.tw](https://www.taiwan.gov.tw) | 🇹🇼 台灣 | 官方國家入口，政策導向 | 非官方觀點 + 策展深度 + 文化故事 |

**我們的差異化：**
- 🔓 **開源** — 不是政府專案，是社群驅動
- 🤖 **AI-native** — Markdown SSOT，LLM 可直接引用
- 🎯 **策展式** — 有觀點、有故事、有「為什麼重要」
- 🌐 **`.md` 域名** — taiwan.md = 台灣的 Markdown = 用文件定義一個國家

---

## 👥 Contributors

感謝所有為 Taiwan.md 貢獻的人！

<a href="https://github.com/frank890417/taiwan-md/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=frank890417/taiwan-md" />
</a>

*Made with [contrib.rocks](https://contrib.rocks)*

---

*Curated with ❤️ from Taiwan*
