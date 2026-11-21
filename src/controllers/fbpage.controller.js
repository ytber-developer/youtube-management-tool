const fbpage = require('../services/fbpage.service');

const idOf = (req) => {
  const id = `${req.params.date}/${req.params.slug}`;
  return fbpage.isValidId(id) ? id : null;
};
const notFound = (res) => res.status(404).json({ success: false, message: 'Không tìm thấy bài' });

exports.list = (req, res) => {
  try { res.json({ success: true, data: fbpage.list() }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.detail = (req, res) => {
  const id = idOf(req);
  if (!id) return notFound(res);
  try {
    const d = fbpage.detail(id);
    return d ? res.json({ success: true, data: d }) : notFound(res);
  } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

/** PATCH { factChecked?, postedUrl?, postedAt?, note? } */
exports.update = (req, res) => {
  const id = idOf(req);
  if (!id) return notFound(res);
  try { res.json({ success: true, message: 'Đã lưu', data: fbpage.update(id, req.body || {}) }); } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

exports.video = (req, res) => {
  const id = idOf(req);
  const file = id && fbpage.filePath(id);
  if (!file) return notFound(res);
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' } });
};
