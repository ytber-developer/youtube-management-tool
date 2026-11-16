const fs = require('fs');
const path = require('path');
const content = require('../services/content.service');
const paths = require('../../content-tools/lib/paths');

const FILE_EXT = /\.(png|jpe?g|svg|mp4|mp3|srt|txt|md|json)$/i;

/** id = <date>/<folder>; trả null (→ 404) nếu sai định dạng hoặc không tồn tại */
function videoId(req) {
  const id = `${req.params.date}/${req.params.folder}`;
  return paths.resolveVideoDir(id) ? id : null;
}
const notFound = (res) => res.status(404).json({ success: false, message: 'Không tìm thấy video' });

exports.list = (req, res) => res.json({ success: true, data: content.list() });

exports.jobs = (req, res) => res.json({ success: true, data: content.jobs() });

exports.detail = (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  res.json({ success: true, data: content.detail(id) });
};

exports.file = (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  const dir = paths.resolveVideoDir(id);
  const file = path.resolve(dir, req.params[0] || '');
  if (!file.startsWith(dir + path.sep) || !FILE_EXT.test(file) || !fs.existsSync(file)) return notFound(res);
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' } });
};

exports.action = (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  try {
    res.json({ success: true, data: content.enqueue(id, req.params.action) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
};

exports.review = (req, res) => {
  const id = videoId(req);
  if (!id) return notFound(res);
  res.json({ success: true, data: content.updateReview(id, req.body) });
};

exports.voice = async (req, res) => {
  const id = videoId(req);
  if (!id) { if (req.file) fs.rmSync(req.file.path, { force: true }); return notFound(res); }
  if (!req.file) return res.status(400).json({ success: false, message: 'Chỉ nhận file giọng đọc .mp3, .m4a hoặc .wav (tối đa 50 MB)' });
  try {
    res.json({ success: true, message: 'Đã nhận giọng đọc, đang render video cuối', data: await content.saveVoice(id, req.file.path, req.file.originalname) });
  } catch (e) {
    res.status(e.code === 'NOT_AUDIO' ? 400 : 500).json({ success: false, message: e.code === 'NOT_AUDIO' ? e.message : `Không xử lý được file giọng: ${e.message}` });
  }
};
