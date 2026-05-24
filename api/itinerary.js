// GET  /api/itinerary?day=D1  → 查詢某天行程
// POST /api/itinerary          → 新增行程項目
const { notionReq, parseItinerary, CAT_REVERSE, setCors } = require('./_notion');

const DB = process.env.ITINERARY_DB_ID;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const day  = (req.query.day || 'D1').toUpperCase();
      const data = await notionReq(`/databases/${DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: '所屬天', select: { equals: day } },
          sorts:  [{ property: '排序', direction: 'ascending' }],
          page_size: 100,
        }),
      });
      return res.json(data.results.map(parseItinerary));
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, cat, zone, station, hours, note, day } = req.body;

      // 取該天最大排序值
      const q = await notionReq(`/databases/${DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: '所屬天', select: { equals: day } },
          sorts:  [{ property: '排序', direction: 'descending' }],
          page_size: 1,
        }),
      });
      const maxOrder = q.results.length > 0
        ? (q.results[0].properties['排序']?.number ?? 0) : 0;

      const page = await notionReq('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: DB },
          properties: {
            '名稱':     { title:     [{ text: { content: name         } }] },
            '分類':     { select:    { name: CAT_REVERSE[cat] || '美食'  } },
            '區域':     { select:    { name: zone    || '其他'            } },
            '車站':     { rich_text: [{ text: { content: station || '' } }] },
            '營業時間': { rich_text: [{ text: { content: hours   || '' } }] },
            '備註':     { rich_text: [{ text: { content: note    || '' } }] },
            '所屬天':   { select:    { name: day                          } },
            '完成':     { checkbox:  false                                 },
            '排序':     { number:    maxOrder + 1                          },
          },
        }),
      });
      return res.json(parseItinerary(page));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[itinerary]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
};
