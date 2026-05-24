require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── NOTION CONFIG ─────────────────────────────────────────────────────────────
const NOTION_API   = 'https://api.notion.com/v1';
const ITINERARY_DB = process.env.ITINERARY_DB_ID;
const SHOPPING_DB  = process.env.SHOPPING_DB_ID;

const notionHeaders = () => ({
  'Authorization':  `Bearer ${process.env.NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type':   'application/json',
});

// ── FIELD MAPPING ─────────────────────────────────────────────────────────────
// Notion 分類 → HTML cat key
const CAT_MAP = {
  '美食': 'food',  '甜食': 'sweet',  '景點': 'sight',
  '購物': 'shop',  '百貨': 'dept',   '交通': 'transport', '機場': 'airport',
};
const CAT_REVERSE = Object.fromEntries(Object.entries(CAT_MAP).map(([k,v]) => [v, k]));

// ── PARSERS ───────────────────────────────────────────────────────────────────
function parseItinerary(page) {
  const p = page.properties;
  return {
    id:      page.id,
    name:    p['名稱']?.title?.[0]?.plain_text       ?? '',
    cat:     CAT_MAP[p['分類']?.select?.name]        ?? 'note',
    zone:    p['區域']?.select?.name                 ?? '',
    station: p['車站']?.rich_text?.[0]?.plain_text   ?? '',
    hours:   p['營業時間']?.rich_text?.[0]?.plain_text ?? '',
    note:    p['備註']?.rich_text?.[0]?.plain_text    ?? '',
    done:    p['完成']?.checkbox                     ?? false,
    order:   p['排序']?.number                       ?? 0,
    day:     p['所屬天']?.select?.name               ?? '',
  };
}

function parseShopping(page) {
  const p = page.properties;
  return {
    id:    page.id,
    name:  p['名稱']?.title?.[0]?.plain_text      ?? '',
    area:  p['區域']?.select?.name                ?? '',
    sub:   p['備註']?.rich_text?.[0]?.plain_text  ?? '',
    done:  p['完成']?.checkbox                    ?? false,
    order: p['排序']?.number                      ?? 0,
  };
}

// ── HELPER ────────────────────────────────────────────────────────────────────
async function notionReq(endpoint, options = {}) {
  const res = await fetch(NOTION_API + endpoint, {
    ...options,
    headers: { ...notionHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Notion API error'), { status: res.status, data });
  return data;
}

// ── GET /api/itinerary?day=D1 ─────────────────────────────────────────────────
app.get('/api/itinerary', async (req, res) => {
  const day = (req.query.day || 'D1').toUpperCase();
  try {
    const data = await notionReq(`/databases/${ITINERARY_DB}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: '所屬天', select: { equals: day } },
        sorts:  [{ property: '排序', direction: 'ascending' }],
        page_size: 100,
      }),
    });
    res.json(data.results.map(parseItinerary));
  } catch (e) {
    console.error('GET /api/itinerary', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── GET /api/shopping ─────────────────────────────────────────────────────────
app.get('/api/shopping', async (req, res) => {
  try {
    const data = await notionReq(`/databases/${SHOPPING_DB}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sorts:     [{ property: '排序', direction: 'ascending' }],
        page_size: 100,
      }),
    });
    res.json(data.results.map(parseShopping));
  } catch (e) {
    console.error('GET /api/shopping', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── PATCH /api/item/:id ───────────────────────────────────────────────────────
app.patch('/api/item/:id', async (req, res) => {
  const { done, order } = req.body;
  const properties = {};
  if (done  !== undefined) properties['完成'] = { checkbox: done };
  if (order !== undefined) properties['排序'] = { number:   order };
  try {
    await notionReq(`/pages/${req.params.id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ properties }),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/item', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── POST /api/itinerary ───────────────────────────────────────────────────────
app.post('/api/itinerary', async (req, res) => {
  const { name, cat, zone, station, hours, note, day } = req.body;
  try {
    // Get max 排序 for this day
    const q = await notionReq(`/databases/${ITINERARY_DB}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: '所屬天', select: { equals: day } },
        sorts:  [{ property: '排序', direction: 'descending' }],
        page_size: 1,
      }),
    });
    const maxOrder = q.results.length > 0 ? (q.results[0].properties['排序']?.number ?? 0) : 0;

    const page = await notionReq('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: ITINERARY_DB },
        properties: {
          '名稱':     { title:      [{ text: { content: name       } }] },
          '分類':     { select:     { name: CAT_REVERSE[cat] || '美食'  } },
          '區域':     { select:     { name: zone    || '其他'           } },
          '車站':     { rich_text:  [{ text: { content: station || '' } }] },
          '營業時間': { rich_text:  [{ text: { content: hours   || '' } }] },
          '備註':     { rich_text:  [{ text: { content: note    || '' } }] },
          '所屬天':   { select:     { name: day                        } },
          '完成':     { checkbox:   false                               },
          '排序':     { number:     maxOrder + 1                        },
        },
      }),
    });
    res.json(parseItinerary(page));
  } catch (e) {
    console.error('POST /api/itinerary', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── POST /api/shopping ────────────────────────────────────────────────────────
app.post('/api/shopping', async (req, res) => {
  const { name, area, sub } = req.body;
  try {
    // Get max 排序 for this area
    const q = await notionReq(`/databases/${SHOPPING_DB}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: '區域', select: { equals: area } },
        sorts:  [{ property: '排序', direction: 'descending' }],
        page_size: 1,
      }),
    });
    const maxOrder = q.results.length > 0 ? (q.results[0].properties['排序']?.number ?? 0) : 0;

    const page = await notionReq('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: SHOPPING_DB },
        properties: {
          '名稱': { title:    [{ text: { content: name        } }] },
          '區域': { select:   { name: area || '超市其他'           } },
          '備註': { rich_text: [{ text: { content: sub || '' } }] },
          '完成': { checkbox:  false                               },
          '排序': { number:    maxOrder + 1                        },
        },
      }),
    });
    res.json(parseShopping(page));
  } catch (e) {
    console.error('POST /api/shopping', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── DELETE /api/item/:id  (archive in Notion) ─────────────────────────────────
app.delete('/api/item/:id', async (req, res) => {
  try {
    await notionReq(`/pages/${req.params.id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ archived: true }),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/item', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── PATCH /api/reorder ────────────────────────────────────────────────────────
// body: [{id, order}, ...]
app.patch('/api/reorder', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  try {
    await Promise.all(items.map(({ id, order }) =>
      notionReq(`/pages/${id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ properties: { '排序': { number: order } } }),
      })
    ));
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/reorder', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🗾  福岡 Travel running on port ${PORT}`));
