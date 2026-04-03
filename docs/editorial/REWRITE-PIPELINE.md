# REWRITE-PIPELINE.md — 文章改寫流程

> **職責分工（五份文件，不重複）：**
>
> - **本文件** → 流程（Stage 0→1→2→3、防崩潰機制）
> - **RESEARCH.md** → 研究方法論（怎麼搜、怎麼判斷、怎麼避坑）
> - **EDITORIAL.md** → 品質標準（好文章長什麼樣、風格、禁止事項）
> - **RESEARCH-TEMPLATE.md** → 研究模板（Stage 1 輸出格式）
> - **QUALITY-CHECKLIST.md** → 驗證清單（Stage 3 逐項檢查）
> - **TERMINOLOGY.md** → 用語規範（台灣在地用語標準，A 類必換 + B 類判斷）
>
> ⚠️ **每個 Stage 都必須讀對應的文件。不讀 = 不合格。**

---

## 為什麼需要 Pipeline？

**診斷（實戰觀察）：**

1. **Token 耗盡** → 後半段變草稿
2. **沒有中間 checkpoint** → 品質無聲下滑
3. **結尾最後寫** → 精力不夠，結尾變罐頭（峰終定律）
4. **富文本被遺忘** → EDITORIAL 規範到後面沒人記得

**解法：三階段分離 + 結尾先行 + 後半段品質鎖。**

---

## 進化模式 vs 全新模式

> ⚠️ **如果原本已有一篇文章，使用「進化模式」，不是「全新模式」。**

### 進化模式（Evolution）

**適用**：文章已存在，需要品質提升。

**核心原則**：舊文是素材庫，不是骨架。全文重寫，不在舊文上修補。

> ⚠️ **為什麼不在舊文上「修改」？** AI 讀了品質不佳的舊文會不自覺模仿它的語氣、結構、甚至壞習慣（清單堆砌、塑膠句式）。把舊文當骨架 = 讓病毒感染新內容。正確做法：從舊文中**只提取事實**，然後用全新模式重寫。

**Stage 0: 素材萃取（進化模式專屬）**

> 完整素材萃取方法論見 [`RESEARCH.md` §七](RESEARCH.md#七進化模式的素材萃取stage-0)

核心步驟：

1. **提取事實清單**：人名、年份、數字、引語、有效 URL
2. **標記問題類型**：`[LIST-DUMP]` / `[THIN]` / `[STALE]` / `[PLASTIC]` / `[FLAT-END]`
3. **列出缺口**：「舊文缺什麼？Stage 1 需要補什麼研究？」

**⚠️ 萃取完畢後，舊文不再被參考。只看事實清單進入 Stage 1。**

**然後進入 Stage 1（研究），研究範圍 = 舊文缺口 + 正常研究流程。**

### 全新模式（Fresh）

**適用**：文章不存在。

直接從 Stage 1 開始，按標準流程走。

> 💡 **實際上進化模式 = 全新模式 + 免費的 Stage 0 素材。** 寫作品質完全相同，只是省了部分研究時間。

---

## 四階段流程

```
Stage 1: RESEARCH（研究）──────→ 研究筆記
          │ 品質門檻 ✓ 才進下一步
Stage 2: WRITE（寫作）────────→ 中文全文（預設只產中文）
          │ 品質門檻 ✓ 才進下一步
Stage 3: VERIFY（驗證）───────→ commit + push
          │
Stage 4: TRANSLATION（可選）──→ 詢問操作者：要不要產英文版？
```

---

### Stage 1: RESEARCH（預算 35-40%）

**目標**：產出一份結構化研究筆記，讓 Stage 2「不需要再搜尋」就能寫。

**必讀：** `cat RESEARCH.md`（方法論）+ `cat RESEARCH-TEMPLATE.md`（填空模板）

**流程：**

1. 讀 RESEARCH.md（搜尋策略、來源判斷、避坑指南）
2. 讀 RESEARCH-TEMPLATE.md，按模板格式填寫
3. 搜尋至少 8 次（中文 4+ / 英文 2+ / 一手來源 2+）
4. **⚠️ 每個事實記錄來源 URL**——研究筆記 = 事實 + 來源配對表（Stage 2 寫 footnote 用）
5. **⚠️ 在研究階段就準備結尾素材**——不要等寫到最後才想
6. **⚠️ 先偵測重複文章**（見 RESEARCH.md §六）——不要寫完才發現重疊

**品質門檻（見 RESEARCH-TEMPLATE.md 底部 checklist）：**
全部打勾才進 Stage 2。不合格 → 回去搜尋。

---

### Stage 2: WRITE（預算 40-45%）

**必讀：** `cat docs/editorial/EDITORIAL.md | head -300`

**輸入**：Stage 1 研究筆記 + EDITORIAL.md

**流程（寫作順序強制）：**

```
1. 先讀 EDITORIAL.md（不假設記得，特別注意 §來源引用）
2. 先寫結尾（3-5 行）← 最重要！
3. 寫開場 + 30 秒概覽
4. 寫正文（按敘事弧線，不按百科排列）
     ↳ 邊寫邊插 [^n] footnote（從 Stage 1 的事實 - 來源配對表對應）
5. 文末寫 footnote 定義（見下方腳註格式規範）
6. 回頭檢查富文本數量 + footnote 密度（每 300 字 ≥ 1 個）
```

**⚠️ Footnote 邊寫邊插，不要事後補。** 事後對應來源極度耗時（實測：sub-agent 超時 3 次）。Stage 1 研究筆記裡已有「事實→來源」配對，寫作時直接引用。

**腳註格式規範（v2.9 新增）：**

```markdown
[^1]: [《嚴家淦總統行誼訪談錄》](https://www.drnh.gov.tw/p/404-1003-12925.php?Lang=zh-tw) — 國史館出版，2013 年嚴家淦逝世二十週年紀念叢書，收錄對其親朋故舊的口述訪談，還原其從財經改革到總統任內的完整歷程。
```

**格式要點：**

- **連結 + 破折號 + 完整描述**：`[^n]: [來源名稱](URL) — 詳細說明文字`
- **說明文字長度**：至少 20-30 字，描述來源的出版背景、內容特色、歷史價值
- **不要只有連結**：`[^1]: [URL]` 或 `[^1]: URL` 都不夠好
- **不要「同上」**：重複引用同一來源時，也要寫完整說明（可簡化但不空白）
- **位置**：腳註定義放在文章最底部，不需要 `## 參考資料` 標題

**為什麼要這樣寫？**

- 讀者可以一鍵複製連結，同時了解來源的背景和可信度
- 完整描述讓文章更有學術嚴謹性
- 避免「同上」讓讀者不知道指的是哪篇文章

**範例對比：**

| 壞範例                  | 好範例                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `[^1]: [維基百科](URL)` | `[^1]: [維基百科：耕者有其田](URL) — 收錄台灣土地改革三個階段的詳細歷史數據和政策內容。`            |
| `[^2]: 同上`            | `[^2]: [同上](URL) — 收錄公地放領 1951-1976 年間放領 138,957 公頃土地給 286,287 戶農戶的詳細數據。` |
| `[^3]: URL`             | `[^3]: [國史館](URL) — 中華民國政府官方檔案機構，收藏 1949 年政府遷台相關史料。`                    |

**⚠️ 本 Pipeline 只產中文版。英文版由獨立的翻譯流程處理。**

- Rewrite Pipeline 的職責 = 產出高品質**中文版**文章。句號。
- **不要在 rewrite 過程中「順便」產英文版。** 這會分散 token 預算，導致中文品質下降。
- 英文版什麼時候產？→ 中文版 commit 後，走翻譯流程（另一個任務）。
- 100% 的 token 預算都給中文。

**⚠️ Frontmatter 完整性鐵律：**

- `subcategory` 必填 — 參照 `docs/taxonomy/SUBCATEGORY.md` 該 category 的子分類表
- 跨主題文章加統一 tag（如原住民相關文章統一加 `原住民族` tag）
- 不確定歸哪個 subcategory → 先查 SUBCATEGORY.md，沒有合適的 → 在 SUBCATEGORY.md 新增

**⚠️ SSOT 鐵律：只改 `knowledge/`，不直接改 `src/content/`。**
寫完後用 `bash scripts/sync.sh` 同步到 src/content/，再 build。
直接改 src/content/ 會被 sync.sh 覆蓋回舊版。

**截圖分享點（2000+ 字文章必備）：**

- 2000 字以上的文章，至少埋 **1 個截圖分享點**
- 格式：blockquote 金句（`> ...`）
- 標準：**脫離上下文仍有意義** — 有人截圖這一句貼到社群，不需要讀全文也能理解和被打動
- 好範例：`> 「數位身分證可以是智慧政府的基礎，也可以是威權政府的基礎建設。」——邱文聰`
- 壞範例：`> 這件事後來產生了深遠的影響。`（脫離上下文 = 廢話）

**防崩潰機制：**

- **結尾先行**：結尾是品質崩塌的起點。先寫結尾 = 保底。
- **後半段品質鎖**：寫到 60% 時暫停自問——「我還有足夠 token 寫好結尾嗎？」不夠 → 現在寫結尾，中間精簡。
- **反百科指令**：不要線性排列事實（北→南→危機→展望）。找驚訝切角，用敘事弧線串連。讀者要想說「欸你知道嗎⋯⋯」不是「我讀了一篇百科」。

**品質門檻（全部打勾才進 Stage 3）：**

- [ ] 結尾不是罐頭？
- [ ] 文章第一個名字是具體的人？
- [ ] 至少 2 句真人引語？
- [ ] 每個轉折有因果鏈？（誰→因為什麼→導致什麼）
- [ ] 開場前三句有具體事實？
- [ ] 富文本達標？（見 EDITORIAL.md）
- [ ] 挑戰是編織在故事裡？
- [ ] **本 pipeline 只產中文。** 沒有偷跑英文版？

---

### Stage 3: VERIFY（預算 15-20%）

**必讀：** `cat QUALITY-CHECKLIST.md`

**流程：嚴格按照 QUALITY-CHECKLIST.md 逐項執行。**

包含五大步驟：

1. **五指檢測**（手動 60 秒）
2. **結構驗證**（逐項打勾）
3. **塑膠掃描**（手動 90 秒，重點掃後半段）
4. **自動驗證**（quality-scan ≤ 3 + build）
5. **Commit**（全部通過才執行）

**⚠️ 不合格 = 不 commit。修正後從 QUALITY-CHECKLIST.md 重新驗證。**

---

### Stage 4: TRANSLATION（可選）

**Stage 3 通過 + commit 後，詢問操作者：**

> 「中文版已完成並推上 main。要不要現在走翻譯 pipeline 產英文版？」

| 回答               | 動作                                         |
| ------------------ | -------------------------------------------- |
| ✅ 要              | 基於剛 commit 的中文定稿，走翻譯流程產英文版 |
| ❌ 不要 / 之後再說 | 結束。英文版留給下一輪或其他人               |

**翻譯流程規則：**

- 英文版是「重寫」不是逐句翻譯 — 用英文讀者的語境重新敘事
- 事實和結構以中文定稿為準，不另外加料或刪減
- 英文版寫入 `knowledge/en/{Category}/` 對應路徑
- 寫完跑 `bash scripts/core/sync.sh`

**⚠️ 這一步永遠在中文版 commit 之後。不要在 Stage 2 偷跑。**

---

## 品質分級

| 等級       | 條件                                 | 動作                    |
| ---------- | ------------------------------------ | ----------------------- |
| ✅ PASS    | hollow ≤ 3 + 五指全過 + 結尾不是罐頭 | commit + push           |
| ⚠️ PARTIAL | hollow ≤ 3 但結尾/富文本不足         | 標記待改善，下輪優先    |
| ❌ FAIL    | hollow > 3 或有事實錯誤              | 不 commit，回到 Stage 1 |

---

## Cron 特殊規則

Cron 在單一 session 執行，無法真正分三個 session，但在 prompt 中強制分階段思考。

**Token 預算分配：**

| 階段 | 佔比   | 常見錯誤                          |
| ---- | ------ | --------------------------------- |
| 研究 | 35-40% | 搜太多、每個結果都 web_fetch 全文 |
| 寫作 | 40-45% | 前半段太細、後半段沒力            |
| 驗證 | 15-20% | 跳過驗證直接 commit               |

**Cron 鐵律（與手動執行不同的地方）：**

- **每批最多 1 篇**：v1 時期每批 3 篇，品質明顯不穩。改成每批 1 篇後品質大幅提升。
- **不要 `git add -A`**：只 add 改動的文章和同步後的 `src/content/` 對應目錄。
- **不要跑 `npm run build`**：Build 由 CI/CD 處理。sub-agent 跑 build 容易 timeout 且浪費資源。
- **至少 7 分鐘**：研究 3min + 寫作 2min + 驗證 2min = 最低要求。

**選文指令：**

```bash
cd ~/taiwan-md && git pull
# 佇列頂端，跳過已重寫的
head -30 scripts/tools/rewrite-queue.txt
git log --oneline --since='2026-03-20' | grep -i 'rewrite:' | head -30
```

**Commit 指令：**

```bash
bash scripts/core/sync.sh
bash scripts/tools/quality-scan.sh knowledge/[Category]/[文章名].md   # ≤ 3 才 commit
git add knowledge/[Category]/[文章名].md src/content/
git commit -m "rewrite: [文章名] — EDITORIAL v4 + Pipeline v2.5"
git push
```

**Cron 狀態（2026-04-03）：**

| Cron                              | 狀態        | 說明                       |
| --------------------------------- | ----------- | -------------------------- |
| Taiwan.md Article Quality Rewrite | ❌ disabled | 每小時 1 篇，Opus model    |
| taiwan-md-rewrite (v1)            | ❌ disabled | 舊版每小時 3 篇，已淘汰    |
| taiwan-md-content-sprint          | ❌ disabled | 內容衝刺（新文章），已淘汰 |

**重啟條件（品質革命 Phase 1）：**

1. 確認 EDITORIAL v4 的新標準（引語、因果鏈、切入人物）已整合到 prompt
2. 設定 featured 文章優先佇列（124 篇門面文章先洗）
3. 目標：pass rate → 30%（3 個月內）

---

## 實戰教訓（7 天 Cron 血淚）

1. **一次一篇**：多個 sub-agent 同時跑 = 搶檔案 + timeout + 殭屍 session
2. **至少 7 分鐘**：研究 3min + 寫作 2min + 驗證 2min = 最低要求
3. **prompt 裡寫「立刻執行，不要重述任務」**：否則 AI 花 30% 時間重述指令
4. **量化指標是 pre-filter 不是品質保證**：塑膠句數=0 ≠ 好文章，必須逐篇讀
5. **塑膠會變種**：AI 把被禁句式微調成看似不同的版本（"展現了"→"印證了"→"彰顯了"）
6. **Build 驗證不能省**：YAML frontmatter 偶爾壞掉，一篇壞 = 整個 category 炸
7. **結尾最後寫 = 品質最差**：Pipeline v2 改成結尾先行（Stage 2 先寫結尾再寫正文）

---

## Quick Commands（手動執行用）

```bash
# 寫完文章後一次跑完 Stage 3 驗證
bash scripts/core/sync.sh
npm run build
bash scripts/tools/quality-scan.sh
# 全部通過才 commit
git add -A && git commit -m "content: 深度研究重寫「{主題}」" && git push
```

---

_版本：v2.9 | 2026-04-04_
_v2.8→v2.9：腳註格式規範新增（完整描述文字 + 連結，範例對比表）_
_v2.7→v2.8：wikilink 格式修正（不帶 .md 副檔名和 URL）_
_v2.6→v2.7：Stage 1 研究筆記移至 docs/reports/research/，不留在 docs/semiont/_
_v2.5→v2.6：Stage 2 新增截圖分享點規則（2000+ 字文章至少 1 個 blockquote 金句）_
_v2.4→v2.5：整合 REWRITE-PIPELINE-CRON.md（Cron 鐵律、選文指令、血淚教訓）+ rewrite-pipeline.sh（Quick Commands）。兩檔案已刪除，本文件為唯一 SSOT。_
_v2.3→v2.4：Pipeline 預設只產中文。新增 Stage 4 TRANSLATION（可選），中文 commit 後才詢問操作者是否產英文版。職責分離：rewrite=中文品質 / 翻譯=英文版_
_v2.2→v2.3：RESEARCH.md 獨立（研究方法論從 EDITORIAL.md 遷出），Stage 0 素材萃取指向 RESEARCH.md，Stage 1 新增必讀 RESEARCH.md + 重複文章偵測_
_v2.1→v2.2：進化模式重設計——舊文從「骨架」降級為「素材庫」，全文重寫避免品質感染_
_v2.0→v2.1：新增 QUALITY-CHECKLIST.md（Stage 3 驗證清單獨立）、每個 Stage 加「必讀」指令_
_五文件分工：Pipeline（流程）+ RESEARCH（研究方法論）+ EDITORIAL（品質）+ RESEARCH-TEMPLATE（模板）+ QUALITY-CHECKLIST（驗證）_

---

## 研究筆記存放規範（v2.7 新增）

Stage 1 產出的研究筆記（RESEARCH-TEMPLATE）不留在 `docs/semiont/` 或 `docs/editorial/`。

**存放位置**：`docs/reports/research/`

**命名格式**：`[文章名]-RESEARCH.md` 或 `STAGE1-[文章名].md`

**用途**：記錄研究過程、事實素材、引語來源。作為可追溯的檔案，方便未來回顧。

**清理時機**：文章 commit 後，研究筆記可選擇性刪除或保留（作為專案歷史）。

---

## Wikilink 規範（v2.8 新增）

Taiwan.md 使用 Astro 的 wikilink 語法連結站內文章。

**正確格式**：`[[文章名]]` 或 `[[path/文章名]]`

**錯誤格式**：

- ❌ `[[文章名]](./文章名.md)`（帶 `.md` 副檔名）
- ❌ `[[文章名]](./路徑)`（帶 URL 格式）

**說明**：Astro 的 wikilink 不需要 `.md` 副檔名，也不需要括號內的 URL。系統會自動解析 `[[文章名]]` 到對應的 Markdown 檔案。

**範例**：

```markdown
- [[戒嚴時期]]
- [[History/二二八事件]]
- [[Food/夜市文化]]
```

**適用場景**：

- 延伸閱讀
- 正文中的內部連結
- 相關文章推薦
