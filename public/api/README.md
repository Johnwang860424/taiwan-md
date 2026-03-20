# Taiwan.md Knowledge API

Taiwan.md 的輕量級知識庫 API，提供結構化的文章資料和統計資訊，讓其他網站能夠查詢和嵌入 Taiwan.md 的內容。

## 🚀 快速開始

所有 API endpoints 都是靜態 JSON 檔案，無需授權即可存取：

```
https://taiwan.md/api/articles.json    # 所有文章列表
https://taiwan.md/api/stats.json       # 統計資料
https://taiwan.md/api/random.json      # 隨機文章
```

## 📋 API Endpoints

### 1. 文章列表 `/api/articles.json`

返回所有文章的 metadata，按標題排序。

**範例回應：**
```json
[
  {
    "title": "二二八事件",
    "description": "1947年改變台灣歷史軌跡的重大事件",
    "category": "History",
    "tags": ["歷史", "政治", "轉型正義"],
    "url": "https://taiwan.md/History/二二八事件",
    "readingTime": 9,
    "featured": false,
    "date": "2026-03-17",
    "path": "History/二二八事件.md"
  }
]
```

**欄位說明：**
- `title`: 文章標題
- `description`: 文章描述（來自 frontmatter）
- `category`: 文章分類（基於檔案路徑）
- `tags`: 標籤陣列
- `url`: 文章完整 URL
- `readingTime`: 預估閱讀時間（分鐘）
- `featured`: 是否為精選文章
- `date`: 發布日期
- `path`: 在 knowledge/ 目錄下的相對路徑

### 2. 統計資料 `/api/stats.json`

返回知識庫的整體統計資訊。

**範例回應：**
```json
{
  "totalArticles": 649,
  "totalCategories": 15,
  "estimatedContributors": 44,
  "totalTags": 1439,
  "categories": [
    {"name": "History", "count": 18},
    {"name": "Culture", "count": 23}
  ],
  "topTags": [
    {"name": "人物", "count": 48},
    {"name": "台灣", "count": 19}
  ],
  "languageDistribution": {
    "zh-TW": 649,
    "en": 0
  },
  "lastUpdated": "2026-03-20T07:40:53.353Z"
}
```

### 3. 隨機文章 `/api/random.json`

返回 20 篇隨機選取的文章，每次 build 時重新生成。

**格式與 `/api/articles.json` 相同，但只包含 20 筆資料。**

## 🔧 使用範例

### JavaScript 客戶端

```javascript
// 獲取所有文章
async function getAllArticles() {
  const response = await fetch('https://taiwan.md/api/articles.json');
  const articles = await response.json();
  return articles;
}

// 搜尋特定分類的文章
async function getArticlesByCategory(category) {
  const articles = await getAllArticles();
  return articles.filter(article => article.category === category);
}

// 獲取統計資料
async function getStats() {
  const response = await fetch('https://taiwan.md/api/stats.json');
  const stats = await response.json();
  return stats;
}

// 獲取隨機文章推薦
async function getRandomRecommendations() {
  const response = await fetch('https://taiwan.md/api/random.json');
  const randomArticles = await response.json();
  return randomArticles;
}
```

### 建立文章小工具

```html
<!-- 嵌入隨機台灣文章 -->
<div id="taiwan-widget"></div>

<script>
fetch('https://taiwan.md/api/random.json')
  .then(response => response.json())
  .then(articles => {
    const widget = document.getElementById('taiwan-widget');
    const article = articles[0]; // 取第一篇
    
    widget.innerHTML = \`
      <div style="border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
        <h3><a href="\${article.url}" target="_blank">\${article.title}</a></h3>
        <p>\${article.description}</p>
        <small>分類: \${article.category} • 閱讀時間: \${article.readingTime} 分鐘</small>
      </div>
    \`;
  });
</script>
```

## 📊 分類對照表

| 英文分類 | 中文說明 | 文章數量範圍 |
|----------|----------|------------|
| History | 歷史 | ~18 篇 |
| Culture | 文化 | ~23 篇 |
| People | 人物 | ~104 篇 |
| Art | 藝術 | ~23 篇 |
| Food | 飲食 | ~25 篇 |
| Technology | 科技 | ~20 篇 |
| Economy | 經濟 | ~16 篇 |
| Geography | 地理 | ~16 篇 |
| Music | 音樂 | ~19 篇 |
| Nature | 自然 | ~17 篇 |
| Society | 社會 | ~17 篇 |
| Lifestyle | 生活風格 | ~15 篇 |

## ⚙️ 技術實作

### 自動更新機制

API 資料會在每次網站 build 時自動重新生成：

```bash
# 手動生成 API（開發時使用）
node scripts/generate-api.js

# 建置網站（會自動執行 prebuild 生成 API）
npm run build
```

### 資料來源

- **文章內容**: `knowledge/` 目錄下的所有 `.md` 檔案
- **Metadata**: 從各檔案的 frontmatter 解析
- **分類**: 基於檔案路徑自動判斷
- **閱讀時間**: 基於字數估算（250 字/分鐘）

### CORS 政策

所有 API endpoints 都是靜態檔案，支援跨域存取，無需特別處理 CORS。

## 🎯 使用案例

1. **內容聚合站**: 建立台灣主題的內容導覽
2. **教育平台**: 嵌入台灣相關知識模組
3. **研究工具**: 分析台灣知識圖譜和主題分布
4. **社群機器人**: 提供隨機台灣知識問答
5. **學習 App**: 每日推薦台灣文化內容

## 🔄 更新頻率

- API 資料隨網站內容更新而更新
- 通常每週更新數次
- `lastUpdated` 欄位顯示最後更新時間

## 📞 聯絡與貢獻

- **專案**: [Taiwan.md GitHub Repository](https://github.com/taiwan-md/taiwan-md)
- **問題回報**: 透過 GitHub Issues
- **內容貢獻**: 歡迎提交 Pull Request

---

*Taiwan.md Knowledge API v1.0 - 讓台灣知識觸手可及 🇹🇼*