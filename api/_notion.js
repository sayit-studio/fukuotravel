// 共用 Notion helpers — 底線開頭不會被 Vercel 當作 API route
const fetch = require('node-fetch');

const NOTION_API = 'https://api.notion.com/v1';

const CAT_MAP = {
  '美食': 'food',  '甜食': 'sweet',  '景點': 'sight',
  '購物': 'shop',  '百貨': 'dept',   '交通': 'transport', '機場': 'airport',
};
const CAT_REVERSE = Object.fromEntries(
  Object.entries(CAT_MAP).map(([k, v]) => [v, k])
);

function notionHeaders() {
  return {
    'Authorization':  `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type':   'application/json',
  };
}

async function notionReq(endpoint, options = {}) {
  const res  = await fetch(NOTION_API + endpoint, {
    ...options,
    headers: { ...notionHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(
      new Error(data.message || 'Notion API error'),
      { status: res.status, data }
    );
  }
  return data;
}

function parseItinerary(page) {
  const p = page.properties;
  return {
    id:      page.id,
    name:    p['名稱']?.title?.[0]?.plain_text        ?? '',
    cat:     CAT_MAP[p['分類']?.select?.name]         ?? 'note',
    zone:    p['區域']?.select?.name                  ?? '',
    station: p['車站']?.rich_text?.[0]?.plain_text    ?? '',
    hours:   p['營業時間']?.rich_text?.[0]?.plain_text ?? '',
    note:    p['備註']?.rich_text?.[0]?.plain_text    ?? '',
    done:    p['完成']?.checkbox                      ?? false,
    order:   p['排序']?.number                        ?? 0,
    day:     p['所屬天']?.select?.name                ?? '',
  };
}

function parseShopping(page) {
  const p = page.properties;
  return {
    id:    page.id,
    name:  p['名稱']?.title?.[0]?.plain_text     ?? '',
    area:  p['區域']?.select?.name               ?? '',
    sub:   p['備註']?.rich_text?.[0]?.plain_text ?? '',
    done:  p['完成']?.checkbox                   ?? false,
    order: p['排序']?.number                     ?? 0,
  };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { notionReq, parseItinerary, parseShopping, CAT_REVERSE, setCors };
