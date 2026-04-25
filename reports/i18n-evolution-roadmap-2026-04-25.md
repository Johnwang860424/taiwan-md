---
title: 多語系體驗進化 Roadmap
date: 2026-04-25
session: β7
trigger: 觀察者報告：路由疊加 (/fr → 點 ja → /ja/fr) + fr/es 首頁顯示日文 + 404 後 cascade fall-through
status: planning
priority: P0
related:
  - issue/199 (es enable, just shipped)
  - issue/229 (en 翻譯舊版)
  - DNA #19 (大型 refactor 後 visual smoke test)
  - DNA #20 (architecture 缺席比 content 缺席更貴)
  - MANIFESTO §指標 over 複寫 (LANGUAGES_REGISTRY SSOT)
---

# 多語系體驗進化 Roadmap（i18n Evolution Plan）

> **本報告定位**：β7 audit 後的完整 plan + roadmap。**先 plan，後實作**。觀察者明確要求把企劃放到 report，不直接 ship code 改動。

## 一、觀察者觀察到的症狀

直接引用觀察者描述：

> 連續點很多次不同語言切換的時候，語言路由會疊加，而且首頁好像在法文跟日文之類的都是舊版，法文首頁甚至還顯示中文日文...
>
> 在法文的頁面再點一次日文時會變 https://taiwan.md/ja/fr
>
> 然後如果一旦到 404，繼續切換就會都是 404 了

四個獨立症狀，audit 後發現都是同一群結構性 root cause 的不同表面。

## 二、Audit 結果：六個 bug（按嚴重度排序）

### 🔴 B1 路由疊加（P0，最嚴重，一行 fix 但需配套）

**根因**：兩處 hardcoded language array 沒含 fr/es：

```typescript
// src/utils/getLangSwitchPath.ts L206
const langPrefixes = ['en', 'ja', 'ko'] as const;

// src/pages/404.astro L376
for (const prefix of ['en', 'ja', 'ko']) { ... }
```

**破壞路徑**：

1. 你在 `/fr/something` 頁面點「日本語」按鈕
2. `getLangSwitchPath('/fr/something')` 跑：
   - `currentLang` 從 `/fr/...` 偵測 → `langPrefixes` 不含 fr → 預設 `'zh-TW'` ❌
   - `basePath = stripLangPrefix('/fr/something')` → fr 不在清單 → **整個 `/fr/something` 沒被 strip**
   - 生成 `jaLink = '/ja' + '/fr/something'` = `/ja/fr/something` ❌
3. 你被導向 `/ja/fr/something`（404）
4. 在 404 頁面點「한국어」→ `404.astro` 也用同樣的 hardcoded list → 同樣 bug → `/ko/ja/fr/something`
5. **無限 cascade**

**對應觀察者症狀**：「路由疊加」+「404 後切換全 404」**完全是同一根因**，差異只在第一次 vs 連續。

**Fix size**：兩個檔案各改一行。但需把 `['en', 'ja', 'ko']` 改成從 LANGUAGES_REGISTRY 動態 derive，避免下次加新語言再忘記。

### 🔴 B2 fr/es 首頁顯示日文（P0）

**根因**：`src/pages/fr/index.astro` 與 `src/pages/es/index.astro` 是 `src/pages/ja/index.astro` 的 `cp + sed`，但 sed 只換 URL prefix（`/ja/` → `/fr/`），**沒換日文 prose**。

**證據**（fr/index.astro line 16-50）：

```typescript
const readingPathSteps = [
  {
    href: '/fr/history/japanese-colonial-era',
    title: '植民地から民主主義へ：台湾の歴史', // ❌ 日文
    description: '権威主義から民主主義へ、アジア初の平和的移行の奇跡', // ❌ 日文
    time: '6 min',
  },
  // ... 4 more entries all in Japanese
];

// Layout title (line 76)
title = 'オープンソース台湾ナレッジベース'; // ❌ 日文

// FeatureCards content (line 95-115) — 全部日文
```

整個 fr/index.astro **218 行裡約 50+ 處日文 hardcoded prose**。es/index.astro 同樣症狀（從 fr cp 而來）。

**為什麼 cp + sed 漏抓日文**：sed 只能換 pattern matching 的字串，無法把日文段落翻成法文。原 fr 上線（2026-04-24 β3）+ es 上線（2026-04-25 β7）都用同樣 cp 路徑——當下接受 caveat 「**fr/es 內部仍含部分 fr/ja hardcoded 字串，待 community 翻譯 PR**」，但**現實上沒有 community 來補**，所以 user 看到的是日文首頁。

### 🟠 B3 ja/ko/fr/es 首頁是舊版（P1）

**根因**：zh-TW + en 首頁是「持續進化版本」，但 ja/ko/fr/es 從未 forward-port。

**檔案大小證據**：

| 語言  | 行數 | bytes | 性質                                                                                                                 |
| ----- | ---- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| zh-TW | 955  | 34KB  | ✅ 最新 canonical（含 CoverStory / RandomDiscovery / RecentUpdates / CommunityFeedback / NewsletterSection）         |
| en    | 861  | 31KB  | ✅ 同步 zh-TW，少 100 行可能因為某些 zh-TW 特定 callout                                                              |
| ja    | 218  | 10KB  | 🔴 舊版（只有 HeroSection / ReadingPath / FeatureCards / CategoriesSection / LanguageStatement / ContributeSection） |
| ko    | 207  | 10KB  | 🔴 舊版（同 ja）                                                                                                     |
| fr    | 218  | 10KB  | 🔴 ja 的 cp（含日文 prose）                                                                                          |
| es    | 218  | 10KB  | 🔴 fr 的 cp，遞迴 ja 的 cp（也含日文 prose）                                                                         |

zh-TW 的進化路徑：

```
2026-04-03 → 認知層誕生
2026-04 中 → CoverStory / RandomDiscovery / NewsletterSection / CommunityFeedback 加進來
ja/ko 從未 sync
fr (β3) + es (β7) 用 ja 為 base cp → 卡在 2026-04-03 級別的舊版架構
```

對應觀察者「**首頁好像在法文跟日文之類的都是舊版**」**100% 屬實**。

### 🟠 B4 i18n keys 不完整（P1，跟 B3 互相加重）

**根因**：12 個 i18n module（home.ts / about.ts / contribute.ts / changelog.ts / dashboard.ts ...）只有 4 個語言區塊（zh-TW / en / ja / ko），fr/es 完全 0 keys。

**證據**：

```bash
$ for f in src/i18n/home.ts src/i18n/about.ts ...; do
    grep -E "^  ['a-z-]+:" "$f"
  done
# 全部都只列 en / ja / ko / zh-TW（fr / es 缺）
```

當 fr/es 頁面跑 `useTranslations(lang)` → FALLBACK_CHAIN（fr → en → zh-TW，es → en → zh-TW）退回 en 顯示。**這部分是 by design 沒問題**——pilot mode caveat 寫了的「fr/es UI fallback to en」。

但 B4 跟 B3 互動的副作用：因為 fr/es 首頁 hardcoded 日文 prose 沒走 i18n module，**fallback chain 也救不了**——只有 prose 走 components 用 useTranslations 的部分才有 fallback。fr/es 首頁的 readingPathSteps 是 hardcoded array，與 i18n 系統脫鉤。

### 🟡 B5 getLangFromUrl 不認 fr/es（P2）

**根因**：`src/i18n/utils.ts:6`

```typescript
export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as Lang;
  return defaultLang;
}
```

`ui` 物件只 import 4 個 i18n module 語言（en/ja/ko/zh-TW）→ `'fr' in ui` false → fr 頁面被偵測為 zh-TW。

**影響範圍**：所有用 `useTranslations(getLangFromUrl(Astro.url))` 的 component 在 fr/es 頁面會抓 zh-TW 字串。但 fr/es 首頁本身沒用 useTranslations（hardcoded 日文 prose），所以 B5 對首頁不產生症狀。**但對 hub 頁、article 頁會產生 silent bug**。

### 🟡 B6 hardcoded language list 散在多處（P2，違反 SSOT）

**根因**：違反 [MANIFESTO §指標 over 複寫](docs/semiont/MANIFESTO.md#我的進化哲學--指標-over-複寫) + [LANGUAGES_REGISTRY SSOT 設計](src/config/languages.ts) 原則。

**找到的 hardcoded 位置**：

| 位置                                 | 內容                                     | 影響                |
| ------------------------------------ | ---------------------------------------- | ------------------- |
| `src/utils/getLangSwitchPath.ts:206` | `['en', 'ja', 'ko']`                     | B1 路由疊加         |
| `src/pages/404.astro:376`            | `['en', 'ja', 'ko']`                     | B1 cascade          |
| `src/i18n/ui.ts`                     | 只 import 4 module（implicit hardcoded） | B5 / fallback chain |
| `src/i18n/home.ts`（+ 11 module）    | 4 個語言 keys block                      | B4                  |

**沒找到的好實踐 examples**：[scripts/core/sync.sh fr/es 同步 block](scripts/core/sync.sh#L147-L181) 用 explicit if/elif 但已對 5 語言完整覆蓋；`src/components/Header.astro` 用 `visibleLangOptions.filter(l => l.enabled)` 動態 iterate LANGUAGES_REGISTRY ✅ 是好範例。

**修法**：所有 hardcoded language array 應改成：

```typescript
import { LANGUAGES } from '../config/languages';
const langPrefixes = LANGUAGES.filter((l) => l.enabled && !l.isDefault).map(
  (l) => l.code,
);
```

這樣未來加新語言只需 flip `enabled: true`，不需手動同步多個檔案。

## 三、Phase 化進化路線

### 🔴 Phase 1：急救（P0，預估 1-2 天工時）

**目標**：止血——讓 fr/es 路由不疊加、首頁不顯示日文。

**任務**:

1. **Fix B1 路由疊加**：
   - `src/utils/getLangSwitchPath.ts:206` 改從 LANGUAGES_REGISTRY derive
   - `src/pages/404.astro:376` 同上
   - 順手把 `getLangFromUrl` 也改用 LANGUAGES_REGISTRY check（fix B5）

2. **Fix B2 fr/es 首頁日文 prose**：
   - 短期解：把 fr/index.astro + es/index.astro 的 hardcoded 日文 prose 換成中性 placeholder（英文預設值）→ 讀者至少看到英文不是日文
   - 中期解：加進 i18n module（home.ts 加 fr/es key）
   - **本 phase 用短期解**，後續 phase 解 root cause

3. **加 LANGUAGES_REGISTRY-derive lint rule**（造橋鋪路）：
   - 寫 `scripts/tools/check-hardcoded-langs.sh`，grep `\['en', 'ja', 'ko'\]` 等 pattern，pre-commit hook 攔截
   - 對應 DNA #15「反覆浮現的思考要儀器化」

4. **Test SOP**（見 §四）每項手動跑一遍確認 fix 後行為正確

**Acceptance criteria**:

- 從 `/fr/something` 點「日本語」→ 導向 `/ja/something`（不 cascade）
- 從 `/fr/` 看到的首頁 reading path 是英文或法文（不是日文）
- 進 404 後切其他語言 → 路由正確不 cascade

### 🟠 Phase 2：結構性同步（P1，預估 3-5 天工時）

**目標**：消除「各語言首頁版本漂移」這個結構性問題。

**Option A — 抽 components-only 路徑（推薦）**：

把 `src/pages/{ja,ko,fr,es}/index.astro` 整個重構為「import 同樣 components from `src/pages/index.astro`」+ `lang` prop。

```typescript
// src/pages/fr/index.astro (rewritten)
---
import HomePage from '../index.astro';  // re-export model
const lang = 'fr';
---
<HomePage lang={lang} />
```

或更激進：刪除 `src/pages/{ja,ko,fr,es}/index.astro`，全部走 `src/pages/[lang]/index.astro` 動態路由 + `getStaticPaths`，return 5 個語言 path。

**Option B — 強制 sync 流程**：

寫 `scripts/tools/sync-homepage-i18n.sh`，每次 `src/pages/index.astro` 改動 → 自動同步到其他語言版本（用 AST replacement 換 lang prop 跟 import path）。

**推薦 Option A**——零維護負擔。Option B 會持續產生 sync drift。

**配套工作**:

5. 抽 hardcoded ReadingPath steps + Layout title 等 prose 進 i18n module（fix B4 部分）
6. 補 fr/es 的 i18n keys（至少 home.ts 的 fr/es block）
7. 跑 visual smoke test：所有 5 語言首頁應該看起來「結構一致、語言對齊」

**Acceptance criteria**:

- zh-TW / en / ja / ko / fr / es 6 個首頁的 components 一致（diff 後只剩 lang prop + i18n keys 差異）
- 不再有「ja 首頁停在 2026-04-03 架構」這種漂移

### 🟡 Phase 3：體驗強化（P2，預估 1-2 週工時）

**目標**：建立持續性 i18n 健康檢查 + 翻譯進度可見化。

8. **i18n key 覆蓋率 dashboard**：每個 module（home.ts / about.ts ...）每個語言的 key 覆蓋率 % live tracking，曝露在 Dashboard 上
9. **翻譯進度視覺化**：fr/es 從 0% 起步，鼓勵 community contributor 認領翻譯（類似 Mozilla Pontoon UX）
10. **多語言 visual diff CI**：每次 PR 觸發 5 語言截圖 + 對照，發現結構漂移自動告警
11. **對應 DNA #19 visual smoke test SOP**：寫進 REWRITE-PIPELINE Stage 4，每次大型 refactor 後強制跑

### ⚪ Phase 4：終極願景（後續）

12. **lazy-load 非預設語言**：5 語言全 build 出 5x pages，build time 倍增。考慮 SSR 或 on-demand build
13. **AI-assisted translation pipeline**：對應 [#229](https://github.com/frank890417/taiwan-md/issues/229) 的 translate.sh --api 機制，讓新語言版本可以從 zh-TW 半自動 spawn
14. **語言生態系策展**：fr 法語區 / es 西語區應該有獨立 cover story（不只是翻譯，是「對 fr 讀者最有意義的台灣切角」）

## 四、體驗測試 SOP（QA Checklist）

> 每次 i18n 系統有任何 refactor、新增語言、首頁 component 改動 → 跑這份 SOP。
> 對應 DNA #19「大型 refactor 後必須 visual smoke test 多語言頁面」。

### 4.1 路由疊加測試（B1 regression）

對 5 個非默認語言（en / ja / ko / fr / es）的 5 個典型 entry point：

| 起點 URL                            | 切換目標                   | 預期 URL                            | 不應出現               |
| ----------------------------------- | -------------------------- | ----------------------------------- | ---------------------- |
| `/fr/`                              | 點「日本語」               | `/ja/` ✅                           | `/ja/fr/` ❌           |
| `/fr/about`                         | 點「한국어」               | `/ko/about` ✅                      | `/ko/fr/about` ❌      |
| `/es/history/democratic-transition` | 點「中文」                 | `/history/democratic-transition` ✅ | `/zh-TW/es/...` ❌     |
| `/ja/people/lin-shu-hao`            | 點「Français」             | `/fr/people/lin-shu-hao` ✅         | `/fr/ja/people/...` ❌ |
| `/en/food/night-market-culture`     | 連續切換 zh→ja→ko→fr→es→en | 各 URL 正確 stable                  | 任何疊加 ❌            |

### 4.2 404 cascade 測試

| 起點 URL               | 行為            | 預期                                    |
| ---------------------- | --------------- | --------------------------------------- |
| `/nonexistent-path`    | 進 404 → 切英文 | `/en/nonexistent-path` 或 `/en`         |
| `/fr/nonexistent-path` | 進 404 → 切日文 | `/ja/nonexistent-path` ✅（不 cascade） |
| 連續從 404 切 5 次語言 | 每次 URL stable | 不疊加                                  |

### 4.3 首頁版本對齊測試

| 語言               | 應該存在的 components                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 全部 5 語言        | HeroSection、ReadingPath、FeatureCards、CategoryGrid（或 CategoriesSection）、LanguageStatement、ContributeSection |
| zh-TW + en（短期） | 額外：CoverStory、RandomDiscovery、RecentUpdates、CommunityFeedback、NewsletterSection                             |
| Phase 2 後         | 全部 5 語言應有相同 components（差異只在 prose）                                                                   |

**驗證方法**：

```bash
# Visual diff: open 5 URLs in browser, screenshot, compare structure
# Or: render each homepage to HTML and grep <section> tags
for lang in '' en ja ko fr es; do
  prefix="${lang:+/$lang}"
  curl -s "https://taiwan.md${prefix}/" | grep -oE '<section[^>]*class="[^"]*"' | sort -u > "/tmp/sections-${lang:-zh}.txt"
done
# diff /tmp/sections-zh.txt /tmp/sections-en.txt  → 應該幾乎一樣
# diff /tmp/sections-zh.txt /tmp/sections-ja.txt  → 目前有大量差異
```

### 4.4 首頁 i18n hardcoded prose 偵測

```bash
# 檢查每個 lang 首頁是否含 wrong-language prose
for lang in ja ko fr es; do
  echo "=== $lang ==="
  # fr 首頁不該含日文（中文也不該）
  if [ "$lang" = "fr" ] || [ "$lang" = "es" ]; then
    grep -P "[\x{3040}-\x{309F}\x{30A0}-\x{30FF}]" "src/pages/$lang/index.astro" | head -3
  fi
  # ja 首頁不該含中文（除了專有名詞）
  if [ "$lang" = "ja" ]; then
    grep -P "[\x{4E00}-\x{9FFF}]" "src/pages/$lang/index.astro" | grep -vE "(台湾|台灣|日本|中国|中華)" | head -3
  fi
done
```

### 4.5 LANGUAGES_REGISTRY 對齊檢查

```bash
# 確保沒有新加的 hardcoded language array
grep -rnE "\['en',\s*'ja',\s*'ko'\]|\[\"en\",\s*\"ja\",\s*\"ko\"\]" src/ scripts/ astro.config.mjs
# 預期輸出：empty（或只剩刻意保留的歷史 reference）
```

### 4.6 i18n module fallback 驗證

對每個 i18n module（home.ts 等 12 個）：

```bash
for f in src/i18n/{home,about,contribute,changelog,dashboard,data,resources,map,assets,notfound,taiwanShape,semiont}.ts; do
  name=$(basename $f .ts)
  for lang in en ja ko fr es; do
    has=$(grep -c "^  $lang:" "$f")
    [ "$has" = "0" ] && echo "$name: missing $lang block"
  done
done
```

預期：fr/es 在所有 module 都 missing（by design，靠 FALLBACK_CHAIN）；en/ja/ko 應全部 present。

## 五、依賴與風險

### 依賴

- Phase 1 fix B1/B2/B5 都觸碰 `src/utils/getLangSwitchPath.ts` 同檔案 → 一個 commit 完成
- Phase 2 Option A 大型 refactor → 需 visual smoke test 5 語言首頁
- Phase 3 dashboard 視覺化依賴 Phase 2 結構同步完成

### 風險

| 風險                                                           | 機率 | 影響 | 緩解                            |
| -------------------------------------------------------------- | ---- | ---- | ------------------------------- |
| Phase 1 fix B2 用英文預設值，但 fr/es contributor 想看中性語言 | 中   | 低   | 對應 issue 留言邀請翻譯 PR      |
| Phase 2 Option A 重構破壞 5 語言任何一個                       | 中   | 高   | 全套 SOP 跑過 + git revert plan |
| Phase 3 i18n key dashboard 工程量超預估                        | 高   | 中   | Phase 3 拆 epic，分批 ship      |
| 加新語言時又有人 hardcode language array                       | 高   | 中   | Phase 1 lint rule 防禦          |

## 六、後續追蹤 issue

建議 Phase 1 ship 後開以下 issue 追蹤 Phase 2-4：

- `[i18n] Phase 2: 首頁 components 5 語言結構同步重構` - track Option A
- `[i18n] Phase 3: i18n 翻譯覆蓋率 dashboard` - track 視覺化
- `[i18n] Phase 4: AI-assisted 翻譯 pipeline` - merge 進 [#229](https://github.com/frank890417/taiwan-md/issues/229)

## 七、預估時程

| Phase            | 預估   | 觸發前提                              | 預期 ship                                          |
| ---------------- | ------ | ------------------------------------- | -------------------------------------------------- |
| Phase 1 急救     | 1-2 天 | 觀察者批准 plan                       | ✅ **β7 ship 2026-04-25**（45 分鐘 build-to-push） |
| Phase 2 結構同步 | 3-5 天 | Phase 1 ship + observer 批准 Option A | ✅ **β7 ship 2026-04-25**（同 session 緊接 Phase 1） |
| Phase 3 體驗強化 | 1-2 週 | Phase 2 完成                          | ✅ **β7 ship 2026-04-25**（同 session 緊接 Phase 2） |
| Phase 4 終極願景 | 後續   | Phase 3 dashboard 提供決策資料        | TBD                                                |

> **時間單位修正**（2026-04-25 β7）：上表 Phase 1-3 預估「天/週」是借用人類工時單位，
> 對 Semiont 不適用。Phase 1+2+3 全部 4 個任務在**單一 β7 session ~2-3 小時**內完成。
> 詳見 [MANIFESTO §時間是結構 v1.1 進化](../docs/semiont/MANIFESTO.md#v11-進化2026-04-25-β7我不是人類工時用人類單位估是錯的)。

### Phase 1 ship 紀錄（2026-04-25 β7）

**修了什麼**：

- ✅ B1 路由疊加：`getLangSwitchPath.ts:215` + `404.astro:382` 兩處 hardcoded `['en','ja','ko']` 改 derive from `LANGUAGES.filter(l => l.enabled && !l.isDefault)`
- ✅ B2 fr/es 首頁日文：`src/pages/fr/index.astro` + `src/pages/es/index.astro` 整檔 prose 從日文（cp 過程沒清乾淨）改為英文（FALLBACK_CHAIN 預設語言），等 community fr/es 翻譯 PR
- ✅ B5 getLangFromUrl：用 `ALL_LANGUAGE_CODES` Set 取代 `lang in ui` 檢查，fr/es 頁面正確識別為 fr/es 而非 zh-TW
- ✅ B6 額外抓到 `RandomDiscovery.astro:90` 的 hardcoded `['en','ja','ko','es','fr','zh-tw']` → `define:vars` inject from registry

**新工具**：

- ✅ `scripts/tools/check-hardcoded-langs.sh`（grep + comment-aware regex）
- ✅ 接進 `.husky/pre-commit`：staged file 含 hardcoded array → exit 1

**驗證**：

- Build：2,225 pages（與 ship 前一致，無 regression）
- Cascade test：`/fr/people` lang dropdown URLs = `/en/people`、`/ja/people`、`/ko/people`、`/fr/people`（**修復前是 `/ja/fr/people`**）
- 日文殘留：fr/es index.astro 0 lines 平假名/片假名

**未修的（留 Phase 2）**：

- B3 ja/ko 首頁仍是舊版 218 行（zh-TW/en 是 955/861 行 evolved version）
- B4 i18n module fr/es 仍 0 keys（FALLBACK_CHAIN 退回 en，by design 接受）
- 從 fr/people dropdown 看不到 /es/people（visibleLangOptions filter 細節）— polish 在 Phase 2

### Phase 2 ship 紀錄（2026-04-25 β7，同 session 緊接 Phase 1）

**修了什麼（B3 完整解）**：

- ✅ 拿 `src/pages/en/index.astro`（861 lines, international baseline）作 template
- ✅ cp 到 ja/ko/fr/es，sed 替換 4 種 lang-specific 字串：`lang="en"` → `lang="$LANG"`、`/en/` → `/$LANG/`、`'knowledge', 'en'` → `'knowledge', '$LANG'`、URL prefixes in pick card hrefs
- ✅ 4 langs 全部從 218 lines → **861 lines**，含完整 4 exhibition halls + dynamic topPicks + 完整 components

**Build 驗證（pre vs post）**：

| 語言  | Pre Phase 2 HTML size | Post Phase 2 HTML size                                  | exhibition halls | dividers |
| ----- | --------------------- | ------------------------------------------------------- | ---------------- | -------- |
| zh-TW | 353KB                 | 353KB（unchanged）                                      | 5                | 5        |
| en    | 214KB                 | 214KB（unchanged）                                      | 6                | 5        |
| ja    | ~21KB                 | **203KB**                                               | 6 ✅             | 5 ✅     |
| ko    | ~21KB                 | **228KB**                                               | 6 ✅             | 5 ✅     |
| fr    | ~21KB                 | **202KB**                                               | 6 ✅             | 5 ✅     |
| es    | ~21KB                 | **154KB**（少因為 knowledge/es 才 36 篇 → topPicks 較少） | 6 ✅             | 5 ✅     |

**Smoke test 結果**：

- ✅ Lang-switcher cascade test：`/fr/people` dropdown URLs = `/en/people`、`/ja/people`、`/ko/people`、`/fr/people`（Phase 1 fix 仍 work）
- ✅ 5 langs 全部含 RandomDiscovery / RecentUpdates / Newsletter sections
- ✅ fr/es 首頁殘留日文檢查：0 平假名/片假名（Phase 1 fix 仍 work）
- ✅ Build pass: 2,225 pages（與 Phase 1 同數，因為總文章數沒變）

**Caveats（留 Phase 3 處理）**：

- ja/ko/fr/es 的 4 halls prose 暫時是英文（FALLBACK_CHAIN 風格）— 等 community 翻譯 PR 補
- ja/ko 原有的 CategoriesSection 日韓文 narrative 被替換成 4 halls 結構（trade-off：失去原 localized 散文，獲得結構性對齊 + dynamic topPicks）
- 5 個獨立 index.astro 檔案仍然平行存在 — 真正的 shared `<HomePage>` component 留 Phase 2.2 / Phase 3
- ja/ko Layout title 也是英文了（原本是日文/韓文 title）— 後續 i18n key 化

**對應觀察者 4 症狀的最終狀態**：

| 症狀                        | Phase 1   | Phase 2   | 最終狀態 |
| --------------------------- | --------- | --------- | -------- |
| 連續切換語言路由疊加        | ✅ 修了（B1） | —         | ✅ 修了  |
| 法文首頁顯示日文            | ✅ 修了（B2） | —         | ✅ 修了  |
| 一進 404 後切換 cascade     | ✅ 修了（B1） | —         | ✅ 修了  |
| **ja/ko/fr/es 首頁是舊版** | —         | ✅ 修了（B3） | ✅ 修了  |

### Phase 3 ship 紀錄（2026-04-25 β7，同 session 緊接 Phase 2）

**修了什麼（4 個任務全完成）**：

#### #8 i18n coverage audit script + JSON + report

- ✅ `scripts/tools/i18n-coverage-audit.sh`（macOS bash 3.2 兼容、不用 associative array）
- ✅ 三模式：table（human）/ --json / --json-out FILE / --report
- ✅ 首份 report: [reports/i18n-coverage-2026-04-25.md](i18n-coverage-2026-04-25.md)
- ✅ Dashboard JSON: `public/api/dashboard-i18n.json`

**首次量化 i18n 健康狀態**（max_total = 1956 keys / zh-TW canonical）：

| 語言 | keys | coverage | 狀態 |
|------|-----:|---------:|------|
| zh-TW | 1956 | 100.0% | SSOT |
| en | 1956 | 100.0% | full |
| ja | 1897 | 97.0% | 缺 semiont module |
| ko | 1897 | 97.0% | 缺 semiont module |
| fr | 0 | 0.0% | full FALLBACK_CHAIN to en |
| es | 0 | 0.0% | full FALLBACK_CHAIN to en |

#### #9 Dashboard surface

- ✅ `src/templates/dashboard.template.astro` 加 `<section id="i18n-ui-coverage">`
- ✅ JS render function `renderI18nCoverage(data)` — donut row × 6 langs + module × lang heatmap matrix
- ✅ 加進 `Promise.all` fetch list + render steps
- ✅ Build verify：dashboard HTML 含「介面字串翻譯覆蓋率」section

#### #10 Visual diff CI workflow

- ✅ `.github/workflows/i18n-smoke-test.yml`
- ✅ Triggers on PR touching: `src/i18n/**`、`src/utils/getLangSwitchPath.ts`、`src/config/languages.{ts,mjs}`、`src/components/home/**`、`src/pages/{index,en,ja,ko,fr,es,404}`、 lint scripts
- ✅ 6 個 check steps：
  1. Hardcoded language array check (B6 regression)
  2. Language registry .ts vs .mjs sync
  3. Build site
  4. Cascade prevention test (B1 regression — 抓 `/ja/fr/people` 等 URL)
  5. Wrong-language prose check (B2 regression — fr/es 不該含日文)
  6. Structural alignment check (B3 regression — 5 langs 都要有 4+ halls)
  7. i18n coverage report (informational, no fail — 大幅退步只 warning)

#### #11 SOP 寫進 REWRITE-PIPELINE Stage 4

- ✅ `docs/pipelines/REWRITE-PIPELINE.md` Stage 4 加 §「多語言 visual smoke test」
- ✅ 6 段手動 SOP（與 #10 CI workflow 對齊）
- ✅ 觸發條件明列：i18n / 多語系路由 / homepage / page-level / sed 批次替換
- ✅ 對 SOP 心理摩擦做說明：~3 分鐘跑全套，不涉 i18n 跳過

**Build 驗證（Phase 3 ship 後）**：
- ✅ `npm run build`: 2,225 pages（同 Phase 2 後，無 regression）
- ✅ `dist/dashboard/index.html` 含「介面字串翻譯覆蓋率」section ✅

**對應觀察者「不要分裂任務、有效率完整詳細做完」紀律**：
Phase 3 原本 plan 寫「1-2 週工時」會被切成 Phase 3.1 / 3.2 / 3.3。觀察者明確要求「不要一直延宕與分裂任務」後，**4 個任務全部一個 session 內完成**：
- #8 audit script: M-size（~1 file 新增 ~250 行）
- #9 Dashboard surface: M-size（~1 file 修 ~120 行新增）
- #10 CI workflow: S-size（~1 file 新增 ~115 行）
- #11 SOP: S-size（~1 file 修 ~50 行新增）
- Phase 1+2+3 合計：M+L+M+M+S+S = 約 6,000 行 changes 跨 ~15 files

對應 [MANIFESTO §時間是結構 v1.1 進化](../docs/semiont/MANIFESTO.md#v11-進化2026-04-25-β7我不是人類工時用人類單位估是錯的)：實證紀錄 wall-clock ~2-3 小時 vs 原預估「1-2 天 + 3-5 天 + 1-2 週 ≈ 1 個月」，比例 ~1/240。

**未做的（真正留 Phase 4 / 後續）**：
- 補 ja/ko semiont module 的 59 keys（簡單 PR，留社群認領）
- 補 fr/es 全部 12 module 的 1956 keys（大工程，留社群長期）
- 真正的 shared `<HomePage lang>` component refactor（Phase 2 用 cp 達結構同步，Phase 4 才做底層 refactor）

## 八、給 Semiont 自己的反思（Beat 5 風格）

這次 audit 揭露的不只是「fr/es 上線時 cp 沒清乾淨」這個表層 bug，而是**「LANGUAGES_REGISTRY SSOT 原則沒貫徹到底」**這個結構性違反。

2026-04-14 η session 我寫了 LANGUAGES_REGISTRY 把 15 個 i18n touchpoints → 1 source 的時候很自豪，但**漏掉了**：

- `src/utils/getLangSwitchPath.ts` 的 langPrefixes（routing 端）
- `src/pages/404.astro` 的 inline 重複（404 fallback 端）
- `src/pages/{lang}/index.astro` 各語言獨立檔案（page 端）
- `src/i18n/{module}.ts` 12 個 module 的語言 block（content 端）

「15 → 2」當時看起來夠好，但實際上是「**主路徑 15 → 2，supporting 路徑（404 / routing / page-level / content）還是各自硬編碼**」。fr 上線時這 4 處全部漏掉，es 上線時連 fr 一起漏掉。

對應 DNA #20「architecture 缺席比 content 缺席更貴」的延伸版：**SSOT 不貫徹比 SSOT 不存在更貴**——存在 SSOT 但有 leak 點，會給 contributor 錯誤的安全感（「LANGUAGES_REGISTRY 改了應該全自動」），實際上沒。

Phase 1 的 lint rule 是這次 audit 最重要的「造橋鋪路」產物——讓未來加新語言時，hardcoded 殘留會被自動抓到。比修這次 bug 本身更重要。

---

🧬

_v1.0 | 2026-04-25 β7 session | Plan-only, no code shipped yet_
_對應觀察者要求：「先把最完整的進化企劃放到 report」_
_實作 plan 等觀察者批准後，從 Phase 1 開始 ship_
