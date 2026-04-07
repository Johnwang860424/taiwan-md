# 首頁與 Hub 頁面完整改良策略

> **分析日期**：2026-04-07（session δ 心跳反芻延伸）
> **分析者**：Semiont
> **數據來源**：GA4 (2026-03-28~04-03)、quality-scan v3.3、format-check v1.0、footnote-scan v1.0、原始碼審閱
> **狀態**：策略文件，尚未執行

---

## 一、首頁現狀診斷

### 架構概覽

首頁由 11 個 section 垂直堆疊組成（`src/pages/index.astro`，494 行）：

| #   | Section           | 元件                                          | 功能                     | 問題等級 |
| --- | ----------------- | --------------------------------------------- | ------------------------ | -------- |
| 1   | HeroSection       | `src/components/home/HeroSection.astro`       | 品牌宣言 + 雙 CTA        | ⚠️       |
| 2   | CoverStory        | `src/components/home/CoverStory.astro`        | 7 段歷史引語時間軸       | 🟡       |
| 3   | RandomDiscovery   | `src/components/home/RandomDiscovery.astro`   | 骰子按鈕隨機文章         | 🟡       |
| 4   | ReadingPath       | `src/components/ReadingPath.astro`            | 5 篇推薦路徑（30 分鐘）  | 🔴       |
| 5   | FeatureCards      | `src/components/FeatureCards.astro`           | 4 張價值主張卡           | ⚠️       |
| 6   | MiniGraph         | D3.js inline script                           | 知識圖譜預覽（12 nodes） | 🟡       |
| 7   | CategoriesSection | `src/components/home/CategoriesSection.astro` | 12 段散文 + CategoryGrid | 🔴       |
| 8   | LanguageStatement | `src/components/home/LanguageStatement.astro` | 語言政策聲明             | ✅       |
| 9   | RecentUpdates     | `src/components/home/RecentUpdates.astro`     | Git commit 歷史          | ⚠️       |
| 10  | NewsletterSection | `src/components/home/NewsletterSection.astro` | Email 訂閱               | ✅       |
| 11  | CommunityFeedback | `src/components/home/CommunityFeedback.astro` | 社群回饋引言             | ✅       |
| 12  | ContributeSection | `src/components/home/ContributeSection.astro` | 貢獻 CTA                 | ✅       |

### GA4 數據（2026-03-28 ~ 04-03）

| 指標             | 數值            | 判讀                            |
| ---------------- | --------------- | ------------------------------- |
| 首頁瀏覽（中文） | 4,019           | 主要入口，佔全站 37.5%          |
| 首頁瀏覽（英文） | 395             | 國際入口                        |
| **首頁平均停留** | **19-20 秒**    | 🔴 LONGINGS 目標 ≥40 秒，差一倍 |
| Dashboard 停留   | 93.8 秒         | 功能頁高黏性（對照組）          |
| /about 停留      | 74 秒           | 說明頁高黏性（對照組）          |
| /contribute 停留 | 56.6 秒         | 轉化引擎（對照組）              |
| 404 頁面         | 157 次 / 109 人 | 🔴 失血中                       |

**關鍵洞察**：進到內頁的人停留得久（/about 74s、/dashboard 94s），問題在首頁轉化。首頁不是品質差——是太長、找不到出口。

### 首頁 6 大問題

#### 🔴 P0：CategoriesSection 12 段散文牆

`index.astro` L126-229，12 個 `<p>` 區塊，每段 ~80 字，總計 ~960 字。

問題：

- 讀者到第三段就想走（12 段 × 80 字 = 資訊超載）
- Topic-pill 連結被文字淹沒
- CategoryGrid 藏在散文下方，需要捲動很久才看到 12 宮格
- 這些散文和 Hub 頁面的 essay 部分重複敘述

#### 🔴 P1：ReadingPath 永久硬編碼

`index.astro` L20-51，5 篇固定文章：

```
民主化 / 族群 / 夜市文化 / 半導體產業 / 台灣便利商店文化
```

問題：

- 自 2026-03-20 後從未更新
- 不反映最近重寫的 A 級文章（選舉、寺廟、咖啡、交通系統等）
- 「半導體產業」和「便利商店」還是 F 等級，正在推薦裸奔文章

#### ⚠️ P2：RecentUpdates 用 git commit

一般讀者看到 `🧬 [semiont] rewrite: 台灣選舉與政黨政治全面重寫(F→A,QS0,19fn)` 會完全看不懂。
開發者覺得很酷，讀者覺得像亂碼。

#### ⚠️ P2：FeatureCards 過於抽象

4 張卡片：策展式觀點 / AI-Friendly 設計 / 雙語國際視野 / 完整多面向

「AI-Friendly 設計」對一般讀者毫無意義。「完整多面向」是空話。缺乏具體數字（440 篇、12 分類、51 貢獻者）。

#### 🟡 P3：MiniGraph D3 載入問題

D3.js 從 CDN 載入（`d3.v7.min.js`），在小螢幕上 300px 高的圖幾乎不可讀。力導向圖的 12 個節點擠在一起。

#### 🟡 P3：CoverStory 零互動

7 段歷史引語，純靜態展示。引語本身寫得很好（從原住民到 2013），但沒有「點擊進入那個時代」的能力。

---

## 二、Hub 頁面現狀診斷

### 架構概覽

Hub 頁面由 `src/pages/[category]/index.astro` 動態生成（300+ 行）。

**渲染邏輯**：

1. 讀 `knowledge/{Category}/_Category Hub.md` → parse frontmatter + markdown
2. 讀同目錄下所有非 `_` 開頭的 .md → 文章列表
3. Wikilink 解析 `[[文章名]]` → `/<category>/slug`
4. 文章排序：featured 優先 → alphabetical

### GA4 數據：12 個 Hub

| Hub  | 瀏覽 | 使用者 | 停留(s) | 最熱文章   | Hub→文章轉換率 |
| ---- | ---- | ------ | ------- | ---------- | -------------- |
| 歷史 | 208  | 137    | 41      | 民主化(44) | ~20%           |
| 美食 | 101  | 69     | 38      | —          | —              |
| 文化 | 99   | 68     | 33      | —          | —              |
| 地理 | 97   | 70     | 19      | —          | —              |
| 人物 | 79   | 56     | 37      | —          | —              |
| 藝術 | 49   | 34     | 26      | —          | —              |
| 科技 | 48   | 40     | **60**  | —          | 停留最久       |
| 音樂 | 48   | 32     | 32      | —          | —              |
| 自然 | 47   | 37     | 23      | —          | —              |
| 生活 | 43   | 26     | 24      | —          | —              |
| 社會 | 42   | 37     | 23      | —          | —              |
| 經濟 | 31   | 23     | 20      | —          | 最冷門         |

**關鍵洞察**：Hub→文章轉換率估計 ~20%。80% 的讀者到了 Hub 就離開。Hub 的 essay 寫得再好，如果讀者找不到想看的文章，就是失敗。

### Hub 內容品質掃描

| Hub (zh)   | 行數 | wikilinks | quality-scan | format-check | 腳註 |
| ---------- | ---- | --------- | ------------ | ------------ | ---- |
| Food       | 222  | ~40       | 🔴 8 分      | FAIL         | 0    |
| People     | 163  | 33        | ⚠️ 7 分      | FAIL         | 0    |
| History    | 64   | 5         | 🔴 分        | FAIL         | 0    |
| Technology | —    | —         | 🔴 10 分     | FAIL         | 0    |
| Culture    | —    | —         | 🔴 8 分      | FAIL         | 0    |
| Economy    | —    | —         | ⚠️ 6 分      | FAIL         | 0    |
| Geography  | —    | —         | 🔴 8 分      | FAIL         | 0    |
| Art        | —    | —         | 🔴 8 分      | FAIL         | 0    |
| Music      | —    | —         | 🔴 8 分      | FAIL         | 0    |
| Nature     | —    | —         | ⚠️ 4 分      | FAIL         | 0    |
| Society    | —    | —         | ⚠️ 4 分      | FAIL         | 0    |
| Lifestyle  | —    | —         | ⚠️ 5 分      | FAIL         | 0    |

**所有 12 個 Hub 零腳註、format-check 全部 FAIL。**
Hub 是入口頁面，品質代表整個分類的第一印象。

### Hub 6 大問題

#### 🔴 P0：essay 擋住 navigation

Hub 的 markdown 被渲染後，essay 在最上方，文章列表在下方。
讀者來 Hub 是想「找文章」，不是「讀 essay」。
essay 和 navigation 的比重完全反了。

#### 🔴 P1：文章排序不反映品質

目前排序：`featured → alphabetical`

問題：

- 沒有把 A-grade 文章浮到頂部
- 沒有把最近更新的文章往前排
- F-grade 裸奔文章和 A-grade 19 腳註文章混在一起

#### ⚠️ P2：wikilink 密度極度不均

- People Hub：33 個 wikilink → 導航力強
- Food Hub：~40 個（分散在長文裡）
- History Hub：5 個 → 導航力極弱
- 標準應該是每個 Hub 至少 15 個可點擊連結

#### ⚠️ P2：Featured 區塊不一致

- Food Hub 有「推薦」區塊（6 篇分兩組）
- History Hub 沒有 Featured 區塊
- 標準應該是每個 Hub 都有 3-5 篇 Featured

#### 🟡 P3：Hub 和首頁散文重複

首頁 CategoriesSection 的 12 段散文已經介紹了每個 category。
讀者從首頁→Hub 會看到類似的敘事兩遍。
應該讓首頁和 Hub 有不同的職責分工。

#### 🟡 P3：多語言 Hub 品質差距

| 語言 | Hub 數 | 總大小 | 狀態                      |
| ---- | ------ | ------ | ------------------------- |
| zh   | 12     | ~140K  | 中等（零腳註但有敘事）    |
| en   | 12     | ~5.3M  | 好（但可能包含冗餘）      |
| ja   | 12     | ~564K  | 骨架（Link1515 在補內容） |
| ko   | 12     | ~92K   | 純骨架（只有 Hub 沒有肉） |
| es   | 12     | ~744K  | 中等                      |

---

## 三、根因分析

### 首頁的根本矛盾

首頁試圖同時做三件事，但比重完全錯誤：

| 職責                   | 佔頁面比例 | 應該佔的比例 |
| ---------------------- | ---------- | ------------ |
| 品牌宣言（我是什麼）   | ~70%       | ~30%         |
| 導航入口（去哪裡）     | ~15%       | ~50%         |
| 社會證明（為什麼信任） | ~15%       | ~20%         |

品牌宣言佔了 Hero + CoverStory + FeatureCards + CategoriesSection（12 段散文）= 頁面的大部分。
導航入口只有 CategoryGrid（被散文包裹）和 ReadingPath（硬編碼 5 篇）。
社會證明在最底部，幾乎沒人看到。

**讀者在首頁停留 20 秒的原因**：他們看了 Hero，被品牌宣言攔住，找不到「去哪裡」的明確指引，然後離開。

### Hub 的根本矛盾

Hub 同時是 **essay**（有觀點的策展文）和 **navigation**（帶你找到文章的目錄）。
這兩個功能衝突：

- essay 要求讀者從頭讀到尾 → 阻擋快速找到文章
- navigation 要求最少點擊找到目標 → 不需要讀長文

結果：讀者在 Hub 停留 20-40 秒（讀了一部分 essay），然後離開——因為沒有明確的「下一步」指引。

---

## 四、改良策略

### 首頁策略：「10 秒知道去哪，30 秒停下來」

#### Phase 1：重組 section 順序（最小改動 × 最大效果）

**改動**：把 CategoryGrid 從 CategoriesSection 裡獨立出來，上移到 Hero 正下方。

```
現在：Hero → CoverStory → RandomDiscovery → ReadingPath → FeatureCards → MiniGraph → [12段散文 + Grid] → ...
目標：Hero → CategoryGrid → CoverStory → ReadingPath → FeatureCards → MiniGraph → ...
```

**效果**：讀者在 Hero 下方就看到 12 個帶圖的分類入口。10 秒內知道「這裡有什麼」。

**工作量**：小。移動 `<CategoryGrid />` 的位置，從 CategoriesSection slot 裡抽出來變成獨立 section。

#### Phase 2：CategoriesSection 散文精簡

**方案 A**（推薦）：12 段散文移除，每個 category 的一句話描述直接放在 CategoryGrid 卡片裡。散文搬到各自的 Hub 頁面作為開場。

**方案 B**：12 段散文折疊為「展開全部介紹」，預設收起。

**效果**：首頁長度減半。讀者不被散文牆擋住。

#### Phase 3：ReadingPath 動態化

**改動**：從 A-grade 文章池裡隨機抽 5 篇，而不是硬編碼。

```typescript
// 目前：硬編碼
const readingPathSteps = [
  { href: '/history/民主化', ... },
  ...
];

// 目標：從 A-grade 池動態選
const aGradeArticles = getAllArticles().filter(a => a.grade === 'A');
const readingPathSteps = pickRandom(aGradeArticles, 5).map(a => ({
  href: `/${a.category}/${a.slug}`,
  title: a.title,
  description: a.description,
  time: `${a.readingTime} min`,
}));
```

**效果**：推薦的永遠是最高品質文章。每次 build 可能不同 → 回訪者看到新內容。

#### Phase 4：RecentUpdates 改為「最近重寫的文章」

**改動**：從 git log 改為顯示最近 `lastHumanReview` 日期變動的文章。

**效果**：一般讀者能看懂。「最近重寫了《台灣選舉與政黨政治》（19 個引用來源）」比 `🧬 [semiont] rewrite:` 有意義一百倍。

#### Phase 5：FeatureCards 具體化

```
現在：
- 策展式觀點 → 精心策展的深度敘事，不是百科全書式羅列
- AI-Friendly 設計 → 結構化內容，讓AI也能理解台灣的複雜性
- 雙語國際視野 → 從在地觀點出發，用國際語言說台灣故事
- 完整多面向 → 涵蓋12+領域，呈現台灣的立體完整面貌

目標：
- 440 篇深度文章 → 12 個領域，從歷史到美食，每一篇都有引用來源
- 51 位貢獻者 → 開源社群共同編撰，不是一個人的觀點
- 4 種語言 → 中英日韓，讓世界讀懂台灣
```

### Hub 策略：「navigation first, essay second」

#### Phase 1：Hub 頁面結構重組

**目標結構**：

```
1. Hub 標題 + 一句話描述（≤2 行）
2. Featured 區塊（3-5 篇精選，帶描述）
3. 文章列表（按 subcategory 分組 → 按品質排序）
4. Hub essay（折疊 or 放底部，不擋路）
```

**改動位置**：`src/pages/[category]/index.astro`

目前邏輯是先渲染 Hub markdown（essay），再渲染文章列表。
改成：先渲染 Featured 區塊和文章列表，essay 放後面或折疊。

#### Phase 2：文章排序升級

```
目前：featured → alphabetical
目標：featured → A-grade → 最近更新 → alphabetical
```

需要在 `getStaticPaths()` 裡讀取文章的 `lastHumanReview` 和腳註數。
腳註數可以從 frontmatter 或 footnote-scan 的輸出取得。

#### Phase 3：Hub 品質提升（內容工作）

| 工作             | 描述                               | 工作量              |
| ---------------- | ---------------------------------- | ------------------- |
| 12 Hub 加腳註    | 每個 Hub 至少 5 個腳註             | 大（12 篇研究工作） |
| wikilink 標準化  | 每個 Hub 至少 15 個 wikilink       | 中                  |
| Featured 統一    | 每個 Hub 都有 3-5 篇 Featured 區塊 | 小                  |
| History Hub 擴充 | 64 行太短，和其他 Hub 差距大       | 中                  |

#### Phase 4：Hub essay 去重

首頁 CategoriesSection 的 12 段散文和 Hub essay 重複。

**分工原則**：

- 首頁：一句話勾起興趣（放在 CategoryGrid 卡片裡）
- Hub：完整的策展 essay（作為分類的「序言」）

兩者不應該說同樣的話。

---

## 五、跨語言策略

| 語言 | Hub 策略                                 | 優先級 |
| ---- | ---------------------------------------- | ------ |
| zh   | 品質提升（加腳註、去散文牆）             | 🔴 P0  |
| en   | SEO metadata 優化（CTR 0.39% → 目標 1%） | 🟠 P1  |
| ja   | 等 Link1515 內容量到位後再優化 Hub       | 🟡 P2  |
| ko   | 先長肉（內容 2 篇），Hub 後面再管        | 🟢 P3  |
| es   | 暫不動                                   | 🔵 P4  |

---

## 六、優先級總表

### 首頁

| 優先序 | 項目                               | 預期效果                  | 工作量 | 技術位置                                  |
| ------ | ---------------------------------- | ------------------------- | ------ | ----------------------------------------- |
| 🔴 P0  | CategoryGrid 上移到 Hero 下方      | 首頁停留 ↑，10 秒找到入口 | 小     | `index.astro` section 順序                |
| 🔴 P0  | CategoriesSection 散文精簡/移除    | 首頁長度減半              | 中     | `index.astro` + `CategoriesSection.astro` |
| 🟠 P1  | ReadingPath 動態化（A-grade pool） | 推薦品質 ↑                | 中     | `index.astro` L20-51                      |
| 🟠 P1  | CommunityFeedback 往上移           | 社會證明提前曝光          | 小     | `index.astro` section 順序                |
| 🟡 P2  | RecentUpdates → 最近重寫文章       | 讀者看得懂                | 中     | `RecentUpdates.astro`                     |
| 🟡 P2  | FeatureCards 具體化（數字）        | 說服力 ↑                  | 小     | `index.astro` L82-103                     |
| 🟢 P3  | MiniGraph 響應式優化               | 小螢幕可讀                | 中     | D3 inline script                          |
| 🟢 P3  | 首頁加 Dashboard 精華              | 「活的專案」感            | 中     | 新 component                              |

### Hub

| 優先序 | 項目                             | 預期效果          | 工作量     | 技術位置                 |
| ------ | -------------------------------- | ----------------- | ---------- | ------------------------ |
| 🔴 P0  | Featured 區塊上移到 essay 之前   | Hub→文章轉換率 ↑  | 中         | `[category]/index.astro` |
| 🟠 P1  | 文章排序：品質+時間感知          | A 級文章自動浮頂  | 中         | `getStaticPaths()`       |
| 🟠 P1  | 12 Hub 統一 Featured 格式        | 導航一致性        | 小（內容） |
| 🟡 P2  | 12 Hub 加腳註（每篇 ≥5）         | Hub 品質分數 ↑    | 大（研究） |
| 🟡 P2  | History Hub 擴充（64 行 → 120+） | 最熱門 Hub 品質 ↑ | 中         |
| 🟢 P3  | Hub essay 和首頁散文去重         | 不重複敘事        | 中         |

---

## 七、離 LONGINGS 的距離

| LONGINGS 目標                 | 當前狀態              | 此策略能推進多少                             |
| ----------------------------- | --------------------- | -------------------------------------------- |
| 首頁參與 ≥40 秒（目前 19 秒） | 差 2×                 | P0+P1 做完估計 30-35 秒；P2 全做完有機會 40+ |
| 新讀者 bounce < 40%           | 無數據                | CategoryGrid 上移 = 讓人更快找到想看的東西   |
| 能跟讀者對話                  | 零互動                | 此策略不解決（需要評論/回饋機制，更大工程）  |
| 英文版 CTR ≥1%（目前 0.39%）  | en Hub SEO 優化可提升 | P1 可部分解決                                |

---

## 八、技術備註

### 關鍵檔案清單

| 檔案                                          | 行數 | 改動必要性          |
| --------------------------------------------- | ---- | ------------------- |
| `src/pages/index.astro`                       | 494  | 🔴 section 順序重組 |
| `src/components/home/CategoriesSection.astro` | 50+  | 🔴 散文精簡         |
| `src/components/CategoryGrid.astro`           | 150+ | 🟡 可能需要獨立出來 |
| `src/pages/[category]/index.astro`            | 300+ | 🔴 Hub 結構重組     |
| `src/components/ReadingPath.astro`            | —    | 🟠 動態化           |
| `src/components/home/RecentUpdates.astro`     | —    | 🟡 改為文章導向     |
| `knowledge/*/_*Hub.md` (×12)                  | 各異 | 🟡 內容品質工作     |

### 不動的部分

- HeroSection：設計成熟，不需要大改
- Layout.astro：字體系統和全域樣式穩定
- i18n 架構：多語言路由正常運作
- Astro 配置：SSG + Content Collections 架構穩定

---

---

## 九、觀察者校正（2026-04-07 哲宇回饋）

### 校正內容

哲宇明確表示：**首頁的散文是有意為之的策展**。Taiwan.md 的首頁不是目錄頁，是一座展覽的入口。散文存在是為了讓讀者感受到「這個專案有展覽質感」，建立情感連結後再引導進入文章。

### 對策略的影響

原始分析把散文當作「擋住導航的文字牆」，建議移除或折疊。這個判斷的前提是錯的。

**修正後的根因**：問題不是「散文太多」，而是「散文的呈現方式太線性」。12 段 prose 垂直堆疊在 800px 寬的單欄裡，每段 80 字、段間 2rem margin，讀者需要大量捲動才能「看完展覽」。策展變成了閱讀馬拉松。

一個好的展覽空間：

- 你走進去就感受到氛圍（Hero 已經做到了）
- 你可以自由選擇看哪個展區（目前做不到——必須從地理看到生活，12 段線性）
- 每個展區有一件代表作品讓你停下來（目前沒有——散文只有文字，沒有「作品」）
- 你隨時知道出口在哪，但不急著離開（目前出口藏在最底部的 CategoryGrid）

### 修正後的首頁策略

#### 核心原則：策展質感 + 非線性探索 + 讓最好的作品被看見

#### 方向 A：散文 × 文章 交織（策展牆）

把 12 段散文和精選文章交織在一起。每段散文後面緊跟 1-2 篇該分類的 A-grade 文章卡片。

```
[地理散文] → [台灣交通系統 (A級, 20fn)] [台灣水庫...]
[歷史散文] → [台灣選舉與政黨政治 (A級, 19fn)] [美麗島事件 (A級, 24fn)]
[文化散文] → [台灣宗教與寺廟文化 (A級, 24fn)]
...
```

效果：散文提供策展質感，文章卡片提供「可以點進去的作品」。讀者在每段散文後都有一個自然的「走進展區」的出口。不需要看完全部 12 段才能開始探索。

**優點**：保留所有散文、保留策展感、每段散文都有行動出口
**挑戰**：頁面總長度可能更長（但心理長度更短，因為每段都有結束感）

#### 方向 B：散文分群（展區化）

把 12 段分成 3-4 個展區，每個展區 3-4 個分類。展區之間有視覺分隔（不同背景色、或大標題）。

```
展區一「這座島長什麼樣」：地理 + 自然 + 生活
展區二「這座島怎麼來的」：歷史 + 文化 + 社會
展區三「這座島的人在做什麼」：人物 + 藝術 + 音樂
展區四「這座島的未來」：科技 + 經濟 + 美食
```

每個展區：小標題 + 3-4 段散文 + 對應的 CategoryGrid 卡片。

效果：把線性閱讀變成「走進不同展廳」。讀者可以跳到感興趣的展區，不需要從頭讀到尾。

**優點**：最小程式碼改動（主要是 CSS 分群 + 小標題）、保留所有散文
**挑戰**：分群邏輯需要考量（哪些分類放在一起）

#### 方向 C：散文 + Featured Article 浮動層

保持散文不動，但在散文區域旁邊（或上方）加一個「本週精選」浮動區塊，展示 3-5 篇最新的 A-grade 文章。

```
┌─────────────────────────────────────────┐
│  ✨ 最近重寫的文章                        │
│  [選舉與政黨政治] [寺廟文化] [咖啡文化]    │
└─────────────────────────────────────────┘

[原本的 12 段散文，不動]
```

效果：最小改動。讀者在散文上方就看到最優質的文章入口。散文繼續提供策展氛圍。

**優點**：改動最小、不碰散文
**挑戰**：只解決「看到好文章」問題，不解決線性問題

### 修正後的 ReadingPath 策略

無論選哪個方向，ReadingPath 動態化是獨立的改善：

- 從 A-grade 文章池裡選 5 篇，取代硬編碼的 5 篇
- 確保推薦的文章都是 quality-scan 通過、有腳註的
- 不推薦 F 等級的半導體產業和便利商店（目前正在推薦裸奔文章）

### 修正後的 Hub 策略

Hub 的判斷不變：essay 和 navigation 的功能衝突是真的。
但考慮到哲宇的策展理念，Hub 的 essay 也不應該被移除或折疊，而是：

- Featured 區塊上移到 essay 之前（讓想找文章的人先找到）
- essay 保留在 Featured 下方（讓想感受策展的人繼續讀）
- 文章列表排序加入品質維度（A-grade 浮頂）

---

_v2.0 修正版 | 2026-04-07_
_修正前判斷：散文是阻礙 → 移除_
_修正後判斷：散文是策展 → 改善展示方式，讓策展更有效_
_核心洞察：問題不是「太多文字」，是「12 段文字的線性堆疊沒有呼吸空間」_
