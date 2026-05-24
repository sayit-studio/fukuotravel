# 🗾 福岡旅遊筆記 2026

行程 + 購物清單管理 App，資料即時同步 Notion。

## 技術架構

```
public/index.html  ← 前端 SPA（行程 / 購物 / 小提醒）
server.js          ← Express API Server（橋接 Notion API）
```

## 環境需求

- Node.js 18+
- Notion Integration Token

---

## 首次設定

### 1. 建立 Notion Integration

1. 前往 https://www.notion.so/my-integrations
2. 點「New integration」→ 填入名稱（例：FukuoTravel）
3. 複製 **Internal Integration Token**

### 2. 分享資料庫給 Integration

進入 Notion，對兩個資料庫各自：
- 右上角「…」→「Connections」→ 選剛建立的 integration

### 3. 填入 .env

```env
NOTION_TOKEN=secret_xxxxxxxxxxxxx
ITINERARY_DB_ID=36ab3ad1d1cd8081ad14d0b8ff1d7575
SHOPPING_DB_ID=36ab3ad1d1cd80dbbc62d4c94b6f6ebd
PORT=3000
```

### 4. 安裝 & 啟動

```bash
npm install
npm start
# 開啟 http://localhost:3000
```

---

## 部署 Railway

1. 前往 https://railway.app → New Project → Deploy from GitHub Repo
2. 選擇 `sayit-studio/fukuotravel`
3. Variables 新增：
   ```
   NOTION_TOKEN=secret_xxxxxxxxxxxxx
   ITINERARY_DB_ID=36ab3ad1d1cd8081ad14d0b8ff1d7575
   SHOPPING_DB_ID=36ab3ad1d1cd80dbbc62d4c94b6f6ebd
   PORT=3000
   ```
4. Railway 自動 deploy，完成後取得網址（如 `fukuotravel.up.railway.app`）

## 更新流程

```bash
git add .
git commit -m "update: ..."
git push
# Railway 自動重新部署
```

---

## API 一覽

| Method | Path | 說明 |
|--------|------|------|
| GET    | `/api/itinerary?day=D1` | 取得某天行程 |
| GET    | `/api/shopping`         | 取得全部購物清單 |
| POST   | `/api/itinerary`        | 新增行程項目 |
| POST   | `/api/shopping`         | 新增購物項目 |
| PATCH  | `/api/item/:id`         | 更新完成狀態 / 排序 |
| PATCH  | `/api/reorder`          | 批次更新排序 |
| DELETE | `/api/item/:id`         | 刪除項目（archive） |
| GET    | `/health`               | 健康檢查 |
