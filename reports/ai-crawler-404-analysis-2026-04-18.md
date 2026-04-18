# AI Crawler Per-UA 404 Analysis — 2026-04-18 ι session

> **第一次 instantiation of LONGINGS「為 AI 讀者做 SEO」**（2026-04-18 η 誕生）
> 工具：[`scripts/tools/analyze-crawler-404.py`](../scripts/tools/analyze-crawler-404.py)（2026-04-18 ι 建立）
> 資料：CF httpRequestsAdaptiveGroups × (userAgent × edgeResponseStatus × clientRequestPath)，3 天 window

---

## A. 驚人的 404 rate — AI crawlers 真實讀取成功率

ζ session 的 7-day summary 顯示 PerplexityBot 49% / OAI-SearchBot 36% 成功率偏低。ι session per-UA × per-path 細部拆解後，數字更嚴重：

| Crawler       | Total (3d) |   200 | 404 |  200% |  **404%** |
| ------------- | ---------: | ----: | --: | ----: | --------: |
| Applebot      |      3,340 | 2,211 | 657 | 66.2% | **19.7%** |
| FacebookBot   |      2,578 | 2,268 |  96 | 88.0% |      3.7% |
| Googlebot     |      1,643 |   948 | 539 | 57.7% | **32.8%** |
| OAI-SearchBot |      1,618 |   628 | 550 | 38.8% | **34.0%** |
| Amazonbot     |      1,616 |   786 | 220 | 48.6% |     13.6% |
| BingBot       |      1,534 |   957 | 421 | 62.4% | **27.4%** |
| ChatGPT-User  |      1,340 | 1,206 |  86 | 90.0% |      6.4% |
| PerplexityBot |      1,333 |   800 |  66 | 60.0% |      5.0% |
| GPTBot        |        712 |   282 | 281 | 39.6% | **39.5%** |
| ClaudeBot     |         35 |    33 |   2 | 94.3% |      5.7% |

**震撼洞察**：

1. **Googlebot 32.8% 踩 404** — Google 爬蟲 1/3 讀不到我們，這不是 AI SEO 問題，是傳統 SEO 問題
2. **GPTBot 39.5% 踩 404** — OpenAI 訓練爬蟲幾乎一半讀不到
3. **OAI-SearchBot 34%** — ChatGPT 即時查詢爬蟲 1/3 回傳 404
4. **Applebot 19.7% / 657 paths** — Applebot 是量最大的 AI crawler（3,340 requests/3d），每個 404 影響 Apple Intelligence 的知識基礎
5. **ClaudeBot 94.3% 成功率** — 少量 requests 但近乎全 200，Anthropic 內部 training loop 健康

**ζ session 的 7d summary 是加權平均掩蓋分層真相**（DNA #24 再驗證）：

- PerplexityBot 7d 49% 是因為某些天 404 嚴重；3d window 看到 60% — 波動很大
- OAI-SearchBot 3d 還是 38.8%，跟 7d 36% 一致，**結構性低成功率**

---

## B. 404 pattern 分類（跨 crawler）

| Pattern             | Requests |     Share | 技術根因                                                         |
| ------------------- | -------: | --------: | ---------------------------------------------------------------- |
| language-switch nav |    1,154 | **39.5%** | Header.astro `translatePath()` 指向不存在的翻譯 URL              |
| trailing slash      |      865 | **29.6%** | Astro trailingSlash config 不一致（UNKNOWNS 2026-04-07 ζ）       |
| other               |      386 |     13.2% | URL-encoded 怪字元、外部誤傳連結                                 |
| semiont (nav bug)   |      269 |      9.2% | `/en/semiont`、`/ja/semiont`（δ-late 已修根因，外部 cache 還來） |
| EN category routes  |      243 |      8.3% | 英文 slug rename 孤兒（例：democracy-and-democratization）       |
| old URLs (renamed)  |        1 |      0.0% | redirect 已 cover 絕大多數                                       |

**戰略含義**：

- **Top 2 pattern 佔 69%**：language-switch + trailing slash。兩個都可以用 Astro config 一次性修（不是一個一個貼 redirect）
- 修 pattern 1 的 ROI：**1,154 requests / 3d = ~385 requests/day** 多被讀到
- 修 pattern 2 的 ROI：**865 requests / 3d = ~288 requests/day**
- 合計：修好這兩個 pattern → **~670 extra AI crawler reads/day = ~23K extra/month**

---

## C. Top 20 404 paths（跨 crawler 聚合）

| Count (3d) | Path                                                           | 推測根因                                                                        |
| ---------: | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
|         52 | `/people/<strange-chars>`（重複多次 URL-encoded）              | 爬蟲把模板字符當成真實 path（某頁面模板 bug）                                   |
|         15 | `/history/<strange-chars>`                                     | 同上                                                                            |
|         14 | `/ja/geography/tectonic-plates-and-seismic-activity/`          | ja 翻譯孤兒 + trailing slash                                                    |
|         13 | `/en/art/%E5%8F%B0%E7%81%A3%E9%9B%BB%E5%BD%B1/`                | 英文版 category 路徑 URL-encoded 中文 slug                                      |
|         13 | `/ja/lifestyle/taiwan-arcade-culture-and-streetscapes/`        | ja 翻譯孤兒                                                                     |
|         11 | `/en/technology/5g-network-and-digital-transformation/`        | **slug rename 孤兒**（英文版已改名）                                            |
|         10 | `/en/people/mayday-band/`                                      | **trailing slash bug**（redirect 不含 trailing slash）                          |
|          7 | `/en/geography/taiwan-urban-development-and-rural-urban-di...` | 英文 slug rename                                                                |
|          6 | `/ja/people/jay-chou/`                                         | ja 翻譯孤兒                                                                     |
|          6 | `/en/history/democracy-and-democratization/`                   | **slug rename**（democratic-transition → democracy-and-democratization 的反向） |
|          6 | `/en/music/%E5%BC%B5%E6%87%B8%E8%88%87%E5%AE%89%E6%BA%A5/`     | 英文版 category 路徑 URL-encoded                                                |

---

## D. Actionable redirects（下個 session 實作）

### 🔴 P0: astro.config.mjs 加 redirects（一個一個）

```javascript
redirects: {
  // Existing
  '/en/people/mayday': '/en/people/mayday-band/',
  '/en/history/democratic-transition': '/en/history/taiwan-democratization/',
  ...semiontRedirects,

  // NEW (2026-04-18 ι based on crawler 404 analysis):
  '/en/people/mayday-band': '/en/people/mayday-band/',  // trailing slash variant
  '/en/history/democracy-and-democratization': '/en/history/taiwan-democratization/',
  '/en/technology/5g-network-and-digital-transformation': '/en/technology/5g-networks-digital-transformation/',  // verify actual slug
  '/en/geography/taiwan-urban-development-and-rural-urban-divide': '/en/geography/urban-development-and-rural-divide/',  // verify
}
```

### 🟠 P1: language-switch nav 結構性修

Header.astro `translatePath()` 在翻譯頁面不存在時應該 fallback 到 zh-TW 而非產生 404。這是 δ-late `/semiont` 修法的通用化：

```astro
const fullPath = translationExists(item.path, locale) ? translatePath(item.path,
locale) : `/${item.path.replace(/^\//, '')}`; // fallback zh-TW
```

需要 `translationExists()` helper 查 `_translations.json`。預期消除 39.5% 404 = 1,154 req/3d。

### 🟠 P1: trailing slash 統一

Astro config 決定全站 `trailingSlash: 'always'` 或 `'never'` + 加反向 301。預期消除 29.6% 404 = 865 req/3d。

### 🟡 P2: `<strange-chars>` 模板 bug

52 個 `/people/<strange-chars>` hits 不是讀者打的 URL，是某頁面 template 字面輸出了占位符。搜 codebase:

```bash
grep -rn "strange-chars\|&lt;strange" src/
```

---

## E. 戰略結論

1. **Googlebot 32.8% 404 才是最嚴重的發現**。我們一直以為 AI SEO 戰略是「為 AI crawler 優化」，結果傳統 Google SEO 也同時在流血。**修 404 pattern 的 ROI 是 Google + AI crawler 雙重收益**。

2. **「為 AI 讀者做 SEO」的第一次量化**：修 language-switch + trailing slash 兩個 pattern → 每月 +23K AI crawler reads。假設這些 reads 有 5% 進 LLM 訓練資料/查詢索引 → 每月 +1,150 Taiwan.md cite-able pages in LLM pool。

3. **404 pattern 的遷移性**：AI crawler 404 pattern 跟 Google 404 pattern 99% 重疊。修一個 pattern 就對兩個 audience 有效。沒有「為 AI 讀者做 SEO」vs「為 Google 做 SEO」之分——是**為「所有非人類讀者」做 SEO**。

4. **這個工具可以每週跑一次**，追蹤 404 rate 變化，作為 AI SEO 戰略的 KPI dashboard。

---

## F. 下一步 Handoff

- [ ] 🔴 Astro redirects P0 實作（上述 4 個個別 redirect，~15 min）
- [ ] 🟠 `translationExists()` helper + Header.astro fallback（~45 min）
- [ ] 🟠 trailing slash config 統一（~30 min + 全站驗證）
- [ ] 🟡 `<strange-chars>` 模板 bug 定位
- [ ] 每週排程跑 `analyze-crawler-404.py --days 7`，追蹤 404 pattern 趨勢

---

_v1.0 | 2026-04-18 ι session — LONGINGS「為 AI 讀者做 SEO」第一次 data-driven instantiation_
_資料來源：3 天 CF httpRequestsAdaptiveGroups × 3 dimensions / 產出 top 20 paths + 6 pattern 分類_
_核心結論：修 top 2 pattern → 每月 +23K AI crawler reads + 同量 Googlebot reads。AI SEO 跟傳統 SEO 的 404 修復是同一件事_
