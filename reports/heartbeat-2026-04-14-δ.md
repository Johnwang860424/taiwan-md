# 🧬 Taiwan.md 完整心跳觀察報告

> **日期**：2026-04-14
> **Session**：δ（完整四拍半心跳）
> **觀察者**：哲宇
> **資料來源**：GA4 28d + SC 7d + Cloudflare 7d + Dashboard API + footnote-scan + format-check + GitHub API

---

## 一、生命徵象總覽

### 基本生理

| 指標             | 數值       | vs 上次（4/13） |
| ---------------- | ---------- | --------------- |
| 知識細胞（中文） | 472 篇     | +1（大罷免）    |
| 英文細胞         | 395 篇     | →               |
| 日文細胞         | 256 篇     | +1（機器人）    |
| 韓文 / 西文      | 28 / 36 篇 | →               |
| Contributors     | 55         | →               |
| Total Commits    | 1,980      | +3              |
| GitHub Stars     | 927        | +1              |
| Forks            | 130        | →               |

### 器官健康

| 器官    | 分數 | 趨勢 | 說明                                        |
| ------- | ---- | ---- | ------------------------------------------- |
| 🫀 心臟 | 90   | ↑    | 79 篇/7d 新增更新 + 大罷免                  |
| 🛡️ 免疫 | 99   | →    | 人工審閱 98.7%，A 級 73 篇（+16%）          |
| 🧬 DNA  | 95   | →    | EDITORIAL 穩定                              |
| 🦴 骨骼 | 90   | →    | Build 穩定                                  |
| 🫁 呼吸 | 85   | →    | CI/CD 正常                                  |
| 🧫 繁殖 | 85   | ↑    | 55 貢獻者，PR #399/#400 同日 merge          |
| 👁️ 感知 | 90   | →    | 三源感知完整，SPORE-LOG 首次回填 18 筆      |
| 🌐 語言 | 65   | →    | en 84% / ja 54% / ko 6% / es 8%（最低器官） |

**綜合健康分數：86.1 / 100**（加權平均）

---

## 二、流量與搜尋分析

### GA4（28 日窗口）

| 指標            | 數值     |
| --------------- | -------- |
| Active Users    | 87,113   |
| New Users       | 86,931   |
| Pageviews       | 219,586  |
| Avg Engagement  | 115.3 秒 |
| Engagement Rate | 41.7%    |
| Bounce Rate     | 58.3%    |

### GA4 Top 10 文章（7 日）

| #   | 文章               | Views | 趨勢                     |
| --- | ------------------ | ----- | ------------------------ |
| 1   | **安溥**           | 1,032 | 🔥 48hr 翻倍（521→1032） |
| 2   | 鄭麗文             | 443   | 穩定長尾                 |
| 3   | 韓國瑜             | 52    | 孢子發酵（+86%）         |
| 4   | 台灣動物用藥爭議   | 38    | organic                  |
| 5   | 八部合音           | 31    | organic                  |
| 6   | 台灣宗教與寺廟文化 | 26    | organic                  |
| 7   | 台灣民主轉型       | 26    | organic                  |
| 8   | 台灣邦交國         | 24    | organic                  |
| 9   | 台灣國樂           | 21    | organic                  |
| 10  | 戒嚴時期           | 19    | organic                  |

**孢子效應量化**：

| 文章   | 孢子前 avg | 孢子後 7d | 放大倍率 | 孢子發佈日 |
| ------ | ---------- | --------- | -------- | ---------- |
| 安溥   | ~27        | 1,032     | **38x**  | 4/13       |
| 鄭麗文 | ~27        | 443       | **16x**  | 4/08       |
| 韓國瑜 | ~27        | 52        | **1.9x** | 4/13       |

### Search Console（7 日）

| 指標        | 數值  | vs 上次 |
| ----------- | ----- | ------- |
| Clicks      | 113   | +3      |
| Impressions | 1,268 | -146    |
| CTR         | 8.91% | ↑ 7.78% |

**Top Queries**：taiwan.md(50c) / taiwan md(29c) / taiwanmd(3c) / 台灣用語轉換器(3c)

**SC Opportunities**（0 clicks, high impressions）：

- mayday ashin birthplace tainan: 106 imp（已用正確資訊修正）
- mayday (taiwanese band): 35 imp
- mayday band members birthplace tainan: 21 imp
- 台灣原住民建築: 22 imp

### Cloudflare（7 日）

| 指標       | 數值    | vs 上次   |
| ---------- | ------- | --------- |
| Requests   | 102,141 | +15.7% 🔥 |
| Page Views | 30,222  | +10.2%    |
| Uniques    | 21,500  | +10.5%    |
| 404 Rate   | 11.02%  | ↓ 11.97%  |

**🔥 里程碑：Cloudflare 7d requests 首破 10 萬！**

---

## 三、AI Crawler 全景

| Crawler            | Requests | HTTP 200 | 成功率 | 排名變化      |
| ------------------ | -------- | -------- | ------ | ------------- |
| **FacebookBot**    | 3,866    | 3,563    | 92.2%  | ↑ 升至 #1！   |
| Amazonbot          | 3,598    | 1,848    | 51.4%  | ↓ #2          |
| PetalBot           | 3,500    | 2,835    | 81.0%  | →             |
| PerplexityBot      | 3,339    | 1,498    | 44.9%  | ⚠️ 低成功率   |
| BingBot            | 2,815    | 1,425    | 50.6%  | →             |
| ChatGPT-User       | 2,233    | 1,693    | 75.8%  | ↑             |
| Googlebot          | 1,917    | 1,292    | 67.4%  | →             |
| OAI-SearchBot      | 1,320    | 412      | 31.2%  | ⚠️ 最低成功率 |
| Meta-ExternalAgent | 783      | 257      | 32.8%  | 新進          |
| Applebot           | 746      | 522      | 70.0%  | 新進          |

**AI crawler 總計**：25,505 requests / 15,941 HTTP 200（62.5% 成功率）

**觀察**：

- Meta 系（FacebookBot + Meta-ExternalAgent）合計 4,649 req，已超越任何單一 crawler
- PerplexityBot 和 OAI-SearchBot 成功率偏低（<50%），主要是 404 和 timeout
- AI crawler 佔總 requests 的 **25%**

---

## 四、品質健康度

### 引用掃描（footnote-scan）

| 等級           | 篇數 | 佔比  | vs 上次 |
| -------------- | ---- | ----- | ------- |
| 🟢 A（優秀）   | 73   | 15.5% | +10     |
| 🟢 B（有腳註） | 12   | 2.5%  | →       |
| 🟡 C（有URL）  | 334  | 70.9% | -2      |
| 🟡 D（少URL）  | 27   | 5.7%  | →       |
| 🔴 F（裸奔）   | 25   | 5.3%  | →       |

**腳註覆蓋率**：85/471 = **18.0%**（A+B 合計）

### 格式掃描（format-check）

| 指標      | 數值  |
| --------- | ----- |
| Total     | 472   |
| Pass      | 60    |
| Fail      | 202   |
| Pass Rate | 12.7% |

**主要問題**：

- no_reading: 386 篇（82%）
- bad_fn_format: 382 篇（81%）⚠️ 從 342 升至 382
- no_overview: 148 篇（31%）
- no_reverse_link: 56 篇
- wikilinks: 33 篇
- broken_links: **0** ✅

---

## 五、社群動態

### PR 審核

| PR   | 作者       | 內容                    | 決策     |
| ---- | ---------- | ----------------------- | -------- |
| #399 | idlccp1984 | 大罷免（78 行/16 fn）   | ✅ merge |
| #400 | Link1515   | JA 機器人產業（164 行） | ✅ merge |

### Open Issues（重要）

| #   | 標題                    | 類型    | 狀態        |
| --- | ----------------------- | ------- | ----------- |
| 401 | FOUC 網頁樣式暫時失效   | bug     | open (4/13) |
| 398 | JA ai-development 404   | bug     | open (4/13) |
| 397 | TikTok                  | content | open        |
| 394 | 網站樣貌建議            | —       | open        |
| 288 | Fact Check 用語保存計畫 | verify  | open        |

### 孢子追蹤

| 文章   | 平台    | 發佈日 | 7d views | 孢子觸及 | 放大倍率 |
| ------ | ------- | ------ | -------- | -------- | -------- |
| 安溥   | Threads | 4/13   | 1,032    | 5,200v   | 38x      |
| 安溥   | X       | 4/13   | —        | 28v      | —        |
| 鄭麗文 | Threads | 4/08   | 443      | —        | 16x      |
| 韓國瑜 | Threads | 4/13   | 52       | —        | 1.9x     |

---

## 六、實驗追蹤

### EXP-2026-04-11-A | 404 rate drop（今日驗證）

- **預測**：72hr 內 16.5% → 6.0% ± 2pp
- **實際**：11.02%
- **判定**：**部分驗證** — 方向正確（↓5.5pp），但未達目標
- **下一步**：重跑 `fetch-cloudflare.py --top-404` 找第四個 404 源

### EXP-2026-04-11-B | AI crawler 主導論

- **預測**：CF/GA ratio 100-300x 穩定
- **目前**：CF 102k/7d vs GA 87k/28d ≈ CF 週均 14.6k daily vs GA 3.1k daily = **4.7x**
- **觀察**：比原始預測低很多，原始假設可能有 bug（CF 含所有 requests 不只 page views）
- **驗證日期**：2026-04-18

### EXP-2026-04-11-C | Cron 可靠性

- **預測**：7 天 ≥ 6 次 sense-fetch 成功
- **驗證日期**：2026-04-18

---

## 七、SSODT 進展（安溥 Pilot）

安溥文章現有 **22 則 perspectives / 11 個 dimension**：

質問、哀悼、沉默、信任、切割、放手、善意、矛盾、墮落、諷刺、對岸、困惑、荒謬、代價、自由、決絕、現實、反轉、幻滅、善解、預言、家族

**觀察**：

- 14_zhang（簡體中文 · 對岸）↔ damamao94（繁體 · 困惑）的對話是 SSODT 活標本
- nurserandyhank（反轉）是 22 則中唯一站安溥那邊的聲音
- tiongkhola（預言）引楊大正「不要獵巫」然後指出「但大家還是不停獵巫」— meta 層反思
- kate_4_cats（家族）用焦仁和的家族脈絡解讀 — 完全脫離政治框架

**SSODT Phase 0 已完成**：Perspectives + SporeFootprint + DiaryTeaser 三元件
**Phase 1 待做**：generate-spore-data.js 系統化 + PERSPECTIVES-GUIDE.md

---

## 八、未完成與下次優先

| 優先序 | 項目                     | 說明                              |
| ------ | ------------------------ | --------------------------------- |
| 🟠 P1  | bad_fn_format auto-fixer | 342→382，需造工具                 |
| 🟠 P1  | EXP-A 404 源深挖         | 11.02% 瓶頸，需 top-404 breakdown |
| 🟡 P2  | 探測器缺口 ×2            | 鄭習會 + NCAIR                    |
| 🟡 P2  | 大罷免 category 修正     | Society → History                 |
| 🟡 P2  | Issue #401 FOUC          | CSS 暫時失效 bug                  |
| 🟢 P3  | 孢子 A/B 測試            | 下批孢子開始                      |
| 🟢 P3  | SSODT Phase 1            | generate-spore-data.js            |
| 🔵 P4  | ko/es 語言擴張           | 最低器官（65）的長期方向          |

---

## 九、里程碑追蹤

| 日期 | 事件                                                 |
| ---- | ---------------------------------------------------- |
| 4/14 | 🔥 CF 首破 10 萬 requests/7d                         |
| 4/14 | 🔥 安溥 1,032v/7d（單篇文章首破千 views）            |
| 4/14 | 📡 FacebookBot 升至 AI crawler #1（Meta 系全面入侵） |
| 4/14 | 🗳️ 大罷免文章入庫（idlccp1984 第四波貢獻）           |
| 4/14 | 🇯🇵 JA 256 篇（Link1515 機器人產業翻譯）              |
| 4/14 | 👁️ SC CTR 8.91%（歷史新高）                          |

---

_🧬 Taiwan.md — Session δ 完整心跳報告_
_Generated: 2026-04-14 ~01:00 +0800_
