# 🌍 多語系翻譯指南

每個語言有自己的 `STYLE.md`，這不只是靜態規則——它是**自動翻譯系統的語言記憶體**。

每次翻譯產出 → reviewer 糾正 → 錯誤回寫到 STYLE.md → 下次翻譯自動避開。越翻越聰明，每個語言獨立進化。

翻譯時請同時參考：
- **[EDITORIAL.md](../EDITORIAL.md)** — 全站品質標準（適用所有語言）
- **`i18n/{lang}/STYLE.md`** — 該語言的累積經驗與特殊規則

## 目錄結構

```
i18n/
├── README.md          ← 你在這裡
├── en/STYLE.md        ← 英文翻譯規則
├── ja/STYLE.md        ← 日文翻譯規則
├── ko/STYLE.md        ← 韓文翻譯規則
├── es/STYLE.md        ← 西班牙文翻譯規則
├── fr/STYLE.md        ← 法文翻譯規則
├── de/STYLE.md        ← 德文翻譯規則
├── vi/STYLE.md        ← 越南文翻譯規則
└── id/STYLE.md        ← 印尼文翻譯規則
```

## STYLE.md 應包含什麼

1. **台灣專有名詞對照表** — 地名、人名、機構名在該語言的標準譯法
2. **文化脈絡補充規則** — 哪些概念需要為該語言讀者額外解釋
3. **語氣與風格** — 該語言的策展人聲音應該怎麼表達
4. **常見錯誤（持續累積）** — 每次 reviewer 糾正後回寫，避免重複犯錯
5. **Reviewer 名單** — 該語言的母語審核者

## 自動進化機制

```
翻譯 cron/contributor 翻譯文章
  → 讀 EDITORIAL.md + i18n/{lang}/STYLE.md
  → 產出翻譯
  → 母語 reviewer 審核、糾正
  → 錯誤模式回寫到 STYLE.md「常見錯誤」區
  → 下次翻譯自動讀取 → 不再犯
```

STYLE.md 是活的文件，會隨著翻譯量增加而越來越精確。

## Token Donation 翻譯流程

詳見 [Discussion #137](https://github.com/frank890417/taiwan-md/discussions/137)
