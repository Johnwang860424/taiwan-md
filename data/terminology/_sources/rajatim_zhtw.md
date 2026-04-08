# rajatim/zhtw — 來源說明

## 專案資訊

- **GitHub**: https://github.com/rajatim/zhtw
- **授權**: MIT (Copyright 2025 tim Insight)
- **用途**: 簡體中文 → 台灣繁體中文轉換器（CLI 工具）
- **萃取日期**: 2026-04-08

## 概述

zhtw 是一個專為程式碼倉庫設計的簡繁轉換工具，採「寧可少轉不可錯轉」策略。
雙層轉換架構：詞彙層（術語對照）+ 字元層（單字映射）。
涵蓋 10+ 專業領域，支援 CI/CD 整合。

## 資料規模

| 分類                 | 檔案                        | 條目數     |
| -------------------- | --------------------------- | ---------- |
| 基礎 IT/社交         | cn/base.json                | 179        |
| 進階 IT              | cn/it.json                  | 208        |
| 商業                 | cn/business.json            | 81         |
| 日常生活             | cn/daily.json               | 231        |
| 電子商務             | cn/ecommerce.json           | 116        |
| 教育                 | cn/education.json           | 113        |
| 金融                 | cn/finance.json             | 146        |
| 遊戲                 | cn/gaming.json              | 150        |
| 地名                 | cn/geography.json           | 166        |
| 法律                 | cn/legal.json               | 173        |
| 醫療                 | cn/medical.json             | 230        |
| 常用詞               | cn/common.json              | 909        |
| 用戶提交             | cn/imported.json            | 27         |
| 港→台                | hk/base.json + hk/tech.json | 61         |
| **合計（人工策展）** |                             | **~2,790** |

另有 opencc.json (28,103 條 OpenCC/MediaWiki 匯入，Apache-2.0/GPL-2.0+) 及 safe_chars.json (6,343 字元映射)，未萃取。

## 萃取方法

1. 排除 opencc.json（批量匯入，非原創策展）
2. 排除 chars.json（字元級消歧義，非詞彙級）
3. 排除 common.json（大部分為純簡繁字形轉換，非用語分歧）
4. 與 Taiwan.md 現有 1,823 條比對，去重後匯入 1,267 條新詞
5. 自動分類映射：base/it → tech、medical → daily（醫療）、legal/finance/business/ecommerce → business 等
6. fork_type 由啟發式判斷：字元重疊率 < 30% → A（完全不同），否則 → B（同概念不同翻譯）

## 特別價值

- **醫療領域**（159 條新增）：我們原本醫療詞條接近零
- **法律領域**（122 條新增）：全新領域覆蓋
- **金融領域**（110 條新增）：大幅擴充商業範疇
- **電商領域**（92 條新增）：現代數位生活用語
- **遊戲領域**（84 條新增）：網路文化重要一環
- **地名對照**（132 條新增）：兩岸國名翻譯差異
- **香港→台灣**（27 條新增）：三地比較視角
