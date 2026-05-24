// PATCH /api/reorder  → 批次更新排序
// body: [{id, order}, ...]
const { notionReq, setCors } = require('./_notion');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const items = Array.isArray(req.body) ? req.body : [];
  try {
    await Promise.all(
      items.map(({ id, order }) =>
        notionReq(`/pages/${id}`, {
          method: 'PATCH',
          body:   JSON.stringify({ properties: { '排序': { number: order } } }),
        })
      )
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[reorder]', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
};
