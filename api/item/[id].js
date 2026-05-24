// PATCH  /api/item/:id  → 更新 done / order
// DELETE /api/item/:id  → archive（軟刪除）
const { notionReq, setCors } = require('../_notion');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = req.query.id;

  try {
    // ── PATCH ────────────────────────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { done, order } = req.body;
      const properties = {};
      if (done  !== undefined) properties['完成'] = { checkbox: done  };
      if (order !== undefined) properties['排序'] = { number:   order };

      await notionReq(`/pages/${id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ properties }),
      });
      return res.json({ ok: true });
    }

    // ── DELETE (archive) ──────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      await notionReq(`/pages/${id}`, {
        method: 'PATCH',
        body:   JSON.stringify({ archived: true }),
      });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[item]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
};
