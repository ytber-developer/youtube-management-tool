const content = require('../services/content.service');
const contentUpload = require('../services/content.upload.service');
const paths = require('../../content-tools/lib/paths');

/** id = <date>/<folder>; trả null (→ 404) nếu sai định dạng hoặc không tồn tại */
function videoId(req) {
  const id = `${req.params.date}/${req.params.folder}`;
  return paths.resolveVideoDir(id) ? id : null;
}
const notFound = (res) => res.status(404).json({ success: false, message: 'Không tìm thấy video' });

const fail = (res, e) => res.status(400).json({ success: false, message: e.message });

exports.list = async (req, res) => {
  try { res.json({ success: true, data: await content.list() }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.detail = async (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  try { res.json({ success: true, data: await content.detail(id) }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

/** POST /content/upload { ids: string[], accountId: number, scheduleAt?: ISO } — upload bắt đầu ngay, công khai lúc scheduleAt */
exports.queueUpload = async (req, res) => {
  const { ids, accountId, scheduleAt } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !ids.every(paths.isValidId)) return fail(res, new Error('ids phải là mảng id video (<date>/<folder>)'));
  if (!Number.isInteger(Number(accountId))) return fail(res, new Error('Thiếu accountId'));
  try {
    const r = await contentUpload.queue(ids, Number(accountId), { scheduleAt: scheduleAt || null });
    res.json({ success: true, message: `Đã xếp hàng ${r.queued.length}/${ids.length} video`, data: r });
  } catch (e) { fail(res, e); }
};

/** DELETE /content/upload/:date/:folder — bỏ khỏi hàng đợi khi chưa upload */
exports.cancelUpload = async (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  try { res.json({ success: true, message: 'Đã bỏ khỏi hàng đợi', data: await contentUpload.cancel(id) }); } catch (e) { fail(res, e); }
};

exports.file = (req, res) => {
  const id = videoId(req);
  const file = id && content.filePath(id, req.params.name);
  if (!file) return notFound(res);
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' } });
};
