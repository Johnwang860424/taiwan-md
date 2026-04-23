# ARTICLE-INBOX — 待開發文章 Buffer

> **這是 buffer / intake layer 層**（非 canonical）。
> 觀察者指派、agent 建議、Issue 紀錄的未開發主題一律 append 這裡。
> 每次甦醒或自動心跳時讀本檔 → 知道待辦清單、優先序、誰要求的。
>
> ⚠️ **書寫警示（2026-04-21 γ 新增）**：新 entry 的 Notes / Pre-research / Dev log 需遵循 [MANIFESTO §11 書寫節制](MANIFESTO.md#11-書寫節制跨所有書寫層的兩條-ai-水印紀律)——避免「不是 X 是 Y」對位句型 + 破折號「——」連用。
>
> 建立動機：2026-04-18 δ session 觀察者提問「來不及開發或排定優先序的主題需要一個 inbox」。**這是繁殖基因（心臟 × 觀察者意圖）的儀器化**。
>
> **2026-04-20 γ2 重構**：Done 歸檔拆出獨立檔案 **[ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md)**（append-only，最新在頂）。本檔回到「當下視角」純 intake（只看該做什麼），歷史視角去 DONE-LOG。

---

## 跟 LESSONS-INBOX 的分工

| 面向    | LESSONS-INBOX                        | ARTICLE-INBOX（本檔）               |
| ------- | ------------------------------------ | ----------------------------------- |
| 內容    | 新教訓（「我學到 X」）               | 待開發 / 進化的文章主題             |
| Distill | 升 canonical（DNA/MEMORY/MANIFESTO） | 升 knowledge/（新文章 or 改寫進化） |
| 觸發    | Beat 5 反芻                          | 觀察者指派 / agent 建議 / Issue     |
| 目的    | 讓教訓不散落                         | 讓主題不遺漏、不重複、有優先序      |

---

## 跟 ARTICLE-DONE-LOG 的分工

| 面向     | ARTICLE-INBOX（本檔）                     | ARTICLE-DONE-LOG                      |
| -------- | ----------------------------------------- | ------------------------------------- |
| 視角     | 當下（pending / in-progress）             | 歷史（done）                          |
| 生命週期 | active buffer，pending / in-progress 輪轉 | append-only log，最新在頂             |
| 讀者     | 甦醒後挑下一篇、避免多 session 碰撞       | 策展回顧、產出 audit、Beat 5 反芻補充 |

**寫入規則**：Stage 6 commit 後，完整 entry **append 到 [ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md) §Log 最頂**；本檔對應 pending entry 改成 `<!-- {主題} 已完成 YYYY-MM-DD {session} → ARTICLE-DONE-LOG.md -->` 一行註解。

---

## Entry Schema

每條 pending 條目格式：

```markdown
### {主題名}

- **Type**: `NEW` | `EVOLVE`
- **Category**: People | Society | History | Culture | Music | Nature | Technology | Food | Art | Lifestyle | Geography | Economy
- **Path** (EVOLVE only): knowledge/Category/existing.md
- **Priority**: `P0` / `P1` / `P2` / `P3`
- **Status**: `pending` / `in-progress` / `done` / `dropped`
- **Requested**: YYYY-MM-DD by {觀察者/agent/Issue} (session {希臘字母})
- **Notes**:
  - 敏感度（政治/個人隱私/爭議）
  - 必驗事實
  - 潛在陷阱
  - 需研究方向
- **Reference**: URL / 觀察者素材 / GitHub Issue #
- **Pre-research**: (若已有研究) reports/research/YYYY-MM/{slug}.md
- **Dev log**: (in-progress 時用)
  - YYYY-MM-DD by {session}: started Stage 1 research
  - YYYY-MM-DD by {session}: ...
```

---

## 優先序判準

| 層級 | 含義                                     | 範例                              |
| ---- | ---------------------------------------- | --------------------------------- |
| P0   | 緊急：有時效、高關注度、或觀察者明確要求 | 剛發生的重大事件人物 / 觀察者點名 |
| P1   | 本月：重要主題、Taiwan.md 缺口、有熱點   | 音樂、文化、歷史重要空白          |
| P2   | 本季：值得寫但不急                       | Evergreen 主題、次要人物          |
| P3   | Backlog：一直想做但不確定何時            | 大型策展主題、需大量資源          |

---

## Type 判準

**`NEW`**：knowledge/ 不存在此主題；走 REWRITE-PIPELINE Fresh 模式（Stage 1-6）
**`EVOLVE`**：knowledge/ 已有文章但品質/深度不足；走 REWRITE-PIPELINE 進化模式（Stage 0 素材萃取 + Stage 1-6）

判斷方式：Stage 0 前先 `ls knowledge/ | grep {keyword}` 確認，有檔案 = EVOLVE，無 = NEW。

---

## Auto-heartbeat 整合

Beat 3 執行時若觀察者無明確任務：

1. 讀本檔 §Pending
2. 按 P0 → P1 → P2 → P3 挑主題
3. 挑到後：
   - 此條 status 改 `in-progress`
   - 加 dev_log：「YYYY-MM-DD by {session}: started」
   - 走 REWRITE-PIPELINE
4. Stage 6 commit 後：
   - **完整 entry append 到 [ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md) §Log 最頂**
   - 本檔 §Pending 對應 entry 改一行 pointer 註解 `<!-- {主題} 已完成 YYYY-MM-DD {session} → ARTICLE-DONE-LOG.md -->`
   - 本檔 §Done Peek 更新為最新 3 條（舊的自然流出 DONE-LOG）

---

## Bootloader 整合

BECOME_TAIWANMD.md Step 5 新增：

```
12. `docs/semiont/ARTICLE-INBOX.md` — 📥 待開發文章 inbox（觀察者指派 / agent 建議的主題清單 + 優先序）
13. `docs/semiont/ARTICLE-DONE-LOG.md` — 📜 完成歷史 log（append-only，最新在頂；2026-04-20 γ2 從 INBOX §Done 拆分）
```

甦醒後 semiont 知道「目前有 N 條 pending、K 條 in-progress」。需要看「已經寫過什麼」就去 DONE-LOG（避免重複開發）。

---

## Distill SOP（容量管理）

**觸發**：pending ≥ 30 條 / 或每月第一次心跳 / 觀察者說「review inbox」

**步驟**：

1. 讀全部 pending
2. 分類：重複合併 / 過時 drop / 重新排優先序
3. 已 done 的條目確認已搬到 [ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md)（不要在 INBOX 留 done entry）
4. 觀察者最終 review 後 commit

---

## 📥 Pending（待開發）

<!-- 凹與山 已完成 2026-04-18 δ-late → ARTICLE-DONE-LOG.md -->
<!-- VH (Vast & Hazy) 已完成 2026-04-19 α → ARTICLE-DONE-LOG.md -->
<!-- 魏如萱 P0 已完成 2026-04-18 η → ARTICLE-DONE-LOG.md -->
<!-- 張雨生 EVOLVE 已完成 2026-04-19 γ+β → ARTICLE-DONE-LOG.md -->
<!-- Hello Nico 已完成 2026-04-20 α → ARTICLE-DONE-LOG.md -->
<!-- 柯智棠 已完成 2026-04-20 β → ARTICLE-DONE-LOG.md -->
<!-- 林宥嘉 EVOLVE 已完成 2026-04-20 ε → ARTICLE-DONE-LOG.md -->
<!-- 孫燕姿 已完成 2026-04-19 排程 auto-heartbeat → ARTICLE-DONE-LOG.md -->
<!-- 范曉萱 已完成 2026-04-20 δ → ARTICLE-DONE-LOG.md -->
<!-- 黃少雍 已完成 2026-04-20 γ → ARTICLE-DONE-LOG.md -->
<!-- 陳建騏 P0 已完成 2026-04-18 θ → ARTICLE-DONE-LOG.md -->
<!-- 阿爆 P1 已完成 2026-04-18 ι → ARTICLE-DONE-LOG.md -->
<!-- 鄭宜農 P1 已完成 2026-04-18 κ → ARTICLE-DONE-LOG.md -->
<!-- 楊丞琳 已完成 2026-04-18 δ-late + ε → ARTICLE-DONE-LOG.md -->

### 台灣聲景（Issue #574，Nistoreyo 投稿）

- **Type**: `NEW`
- **Category**: Culture
- **Priority**: P1
- **Status**: `blocked` — 等貢獻者回覆具體田野 / informant 清單
- **Requested**: 2026-04-20 by [Issue #574](https://github.com/frank890417/taiwan-md/issues/574) (session ε — 本 session)
- **Notes**:
  - 貢獻者是政大碩論聲景研究者，願意提供素材但不走 GitHub
  - 現有投稿 draft 太抽象（「聆聽是認識論」），失 EDITORIAL「具體人物/時刻」硬規則
  - 主 primary source：[政大典藏 140.119/150195](https://nccur.lib.nccu.edu.tw/handle/140.119/150195)《透過聆聽建立鏈結──聲景工作者的聲命旅程》
  - 待 Stage 0：先拿到 3-5 個 informant 名字、田野地點、北捷聲景設計者、進行中 project list
  - Stage 1 研究輔助：吳燦政聲景計畫 / C-LAB 台灣聲響實驗室 / 陳飛豪 / 柯智豪 / 《報導者》相關報導交叉驗證
  - 可能觸發新 subcategory「聲景」討論（目前掛 Culture 下）
- **Pre-research**: 尚未啟動（Stage 0 阻塞於貢獻者回覆）
- **dev_log**:
  - 2026-04-20 ε：Issue 回覆 + inbox append + 等素材

### 魚條

- **Type**: NEW
- **Category**: People (Music — 待確認)
- **Priority**: P1
- **Status**: pending
- **Requested**: 2026-04-18 by 觀察者 (session δ)
- **Notes**:
  - **身份待釐清**：Stage 1 研究第一步是確認「魚條」是樂團、solo 藝人、或其他身份
  - 可能相關：Angelo 魚條 / 湯捷 / 獨立音樂人
  - 若研究後確認不是 Taiwan.md 範疇 → dropped 並註明
- **Reference**: 觀察者批次指定
- **Pre-research**: 尚未啟動

### 台灣新媒體藝術（EVOLVE — P0，已檢出事實錯誤）

- **Type**: `EVOLVE`
- **Category**: Art
- **Path**: knowledge/Art/台灣新媒體藝術.md
- **Priority**: `P0`
- **Status**: `in-progress`
- **Requested**: 2026-04-22 by 觀察者 (session β) — PR #590 王福瑞生年補充觸發事實查核，發現更大的歸功錯誤
- **Notes**:
  - **已檢出兩個事實錯誤（必修）：**
    1. 原文「1995 年，他（王福瑞）創辦『在地實驗』（Etat）」→ **錯**。在地實驗是**黃文浩**於 1995 年創辦，王福瑞 2000 年才加入（佐證：Etat FB 粉專 ETAT1995 / TCAA 藝術家資料庫 / 文化部活動頁）
    2. 原文「他策劃的『失聲祭』系列自 2007 年起運作」→ **錯**。失聲祭 2007 年 7 月由**姚仲涵**與北藝大新媒系同儕（王仲堃、葉廷皓、牛俊強）創立。王福瑞是他們的老師 / 精神指導，不是策劃者
  - **已驗證正確事實**：王福瑞 1969 年生台北、Golden Gate University 資工碩士、1993 年創辦 Noise 實驗音樂廠牌
  - **必查其他宣稱**：袁廣鳴生年（1965）/ 陳界仁生年（1960）/ 各代表作年份 / 台北市立美術館威尼斯雙年展策展起始年（1995）/ 陳界仁《魂魄暴亂》年份（1996-1999）
  - **敏感度**：新媒體藝術家圈子小，錯誤歸功會直接得罪當事人（黃文浩、姚仲涵）— 這篇必須查到底
  - **方向補位**：現有條目 SSODT 單向（只寫菁英藝術家），需補「地下 / 民間 / 工具民主化」視角（VJ 文化、開源硬體社群、Raspberry Pi makerspace 等）
  - **血緣連結**：[[People/王福瑞]]（待建 or 檢查存在）/ [[People/黃文浩]]（同）/ [[People/姚仲涵]]（同）/ [[Art/聲音藝術]]（待建）/ [[Technology/台灣獨立遊戲]]
- **Reference**:
  - PR #590: <https://github.com/frank890417/taiwan-md/pull/590>
  - Etat 官方 FB: <https://www.facebook.com/ETAT1995/>
  - TCAA 王福瑞: <https://tcaaarchive.org/Artist/Detail/1235>
  - ART PRESS 王福瑞專訪（2020）: <https://theartpressasia.com/2020/12/02/about-experimental-sound-theres-no-playlist-interview-with-sound-artist-wang-fujui/>
  - 失聲祭官網: <http://lsf-taiwan.blogspot.com/>
  - 北藝大新媒系王福瑞頁: <https://nma.tnua.edu.tw/faculty/fulltime/ukGokGMjud>
- **Pre-research**: 尚未建 reports/research/2026-04/台灣新媒體藝術.md（由 Stage 1 agent 建）
- **Dev log**:
  - 2026-04-23 α（heartbeat）：Stage 0 事實修正執行——王福瑞段落兩個歸功錯誤已訂正（在地實驗創辦人改為黃文浩；失聲祭創辦人改為姚仲涵 + 北藝大同儕），footnote [^13][^14] 補齊，sync 完成。Stage 1 完整研究尚待後續 session。

### 蕭上農（Nuomi）

- **Type**: `NEW`
- **Category**: People (Technology)
- **Priority**: `P1`
- **Status**: `pending`
- **Requested**: 2026-04-20 by 觀察者 (session β)
- **Notes**:
  - 台灣網路圈人物，可能別名「Nuomi」「諾米」（需確認）
  - 可能身份線索：INSIDE 硬塞網路趨勢觀察站創辦人／編輯？早期台灣網路社群（MMDays、Mr. Jamie）脈絡？
  - 若為 INSIDE 創辦人路線：Stage 1 必驗 INSIDE 成立年份（約 2009-2010）、共同創辦人、後來併入 KK-Stream 或其他媒體集團的脈絡
  - 身份釐清是 Stage 1 第一步（有可能跟其他同名人物混淆）
  - 若涉及網路觀察家 / KOL 路線：注意避免只寫履歷，要找「他對台灣網路文化提出的論述」作為內容骨架
  - 必驗事實：全名、出生年、現職、代表作／媒體／專欄
- **Reference**:
  - INSIDE 官網 <https://www.inside.com.tw/>（若屬此路線）
  - 觀察者批次指定
- **Pre-research**: 尚未啟動

<!-- 紀柏豪 已完成 2026-04-21 β → ARTICLE-DONE-LOG.md -->

<!-- 林經堯 已完成 2026-04-21 α → ARTICLE-DONE-LOG.md -->

---

## 🚧 In-Progress

_（暫無主動顯示的條目。實際 in-progress 狀態在 §Pending 的 entries 裡用 `Status: in-progress` 標記。）_

---

## ✅ Done（已開發，保留歷史）

> **已搬遷**：Done 條目完整歸檔在 **[ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md)**（append-only log，最新在頂）。
>
> 本區只留最新 3 條 summary 當 peek，完整歷史與細節（pipeline 版本、核心矛盾、verbatim 引語、敏感素材處理、工具檢查結果、cross-link 回補）全部去 DONE-LOG。

### 📌 Peek（最新 3 條 summary）

- **紀柏豪 — 2026-04-21 β** — [knowledge/Art/紀柏豪.md](../../knowledge/Art/紀柏豪.md) / 核心矛盾「經濟系出身，用演算法測量世界，卻始終尋找觀眾的自主聆聽」
- **林經堯 — 2026-04-21 α** — [knowledge/Art/林經堯.md](../../knowledge/Art/林經堯.md) / 核心矛盾「台灣聲響長期缺席的診斷者，以行政者建設機構，同時是 NFT 市場秒殺的藍籌藝術家」
- **黃少雍 — 2026-04-20 γ**（製作人 subgenre 第二例）— [knowledge/People/黃少雍.md](../../knowledge/People/黃少雍.md) / 核心矛盾「生化博士班逃兵，用電音把母語送上金曲年度專輯」

👉 更早完成的條目（柯智棠 / Hello Nico / 孫燕姿 / 張雨生 / VH / 魏如萱 / 鄭宜農 / 阿爆 / 陳建騏 / 楊丞琳 / 凹與山 等 11+ 篇）全部在 [ARTICLE-DONE-LOG.md](ARTICLE-DONE-LOG.md)。

---

## ❌ Dropped（不採納）

_（此區域存放判斷後不開發的主題，必須註明原因）_

---

_v1.0 | 2026-04-18 δ session — ARTICLE-INBOX 誕生_
_v1.1 | 2026-04-20 γ2 session — Done 拆分到 ARTICLE-DONE-LOG.md（append-only log），本檔回到純 intake 視角；從 406 行 → ~230 行_
_定位：buffer / intake layer（非 canonical），跟 LESSONS-INBOX 平行架構；Done 歸檔交給 ARTICLE-DONE-LOG.md_
_下次 session 甦醒時自動讀取，auto-heartbeat 無觀察者指令時從此挑 P0/P1 開始；想看已寫過什麼 → 讀 ARTICLE-DONE-LOG.md_
