// GET  /api/shopping  → 取得全部購物清單
// POST /api/shopping  → 新增購物項目
const { notionReq, parseShopping, setCors } = require('./_notion');

const DB = process.env.SHOPPING_DB_ID;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const data = await notionReq(`/databases/${DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          sorts:     [{ property: '排序', direction: 'ascending' }],
          page_size: 100,
        }),
      });
      return res.json(data.results.map(parseShopping));
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, area, sub } = req.body;

      // 取該區域最大排序值
      const q = await notionReq(`/databases/${DB}/query`, {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: '區域', select: { equals: area } },
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
            '名稱': { title:     [{ text: { content: name        } }] },
            '區域': { select:    { name: area || '超市其他'           } },
            '備註': { rich_text: [{ text: { content: sub || ''   } }] },
            '完成': { checkbox:  false                                 },
            '排序': { number:    maxOrder + 1                          },
          },
        }),
      });
      return res.json(parseShopping(page));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[shopping]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
};
