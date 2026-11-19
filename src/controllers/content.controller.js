const content = require('../services/content.service');
const paths = require('../../content-tools/lib/paths');

/** id = <date>/<folder>; trả null (→ 404) nếu sai định dạng hoặc không tồn tại */
function videoId(req) {
  const id = `${req.params.date}/${req.params.folder}`;
  return paths.resolveVideoDir(id) ? id : null;
}
const notFound = (res) => res.status(404).json({ success: false, message: 'Không tìm thấy video' });

exports.list = (req, res) => res.json({ success: true, data: content.list() });

exports.detail = (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  res.json({ success: true, data: content.detail(id) });
};

exports.file = (req, res) => {
  const id = videoId(req);
  const file = id && content.filePath(id, req.params.name);
  if (!file) return notFound(res);
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' } });
};
