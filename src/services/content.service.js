/**
 * Content pipeline cho trang /content: danh sách video + trạng thái, chi tiết để đăng YouTube, và trạng thái hàng đợi
 * tự đăng (content.upload.service). Build/giọng/render vẫn chạy qua `npm run content -- …` (AI gọi).
 */
const fs = require('fs');
const path = require('path');
const LIB = path.resolve(__dirname, '..', '..', 'content-tools', 'lib');
const paths = require(path.join(LIB, 'paths'));
const { videoStatus } = require(path.join(LIB, 'status'));
const pack = require(path.join(LIB, 'pack'));

// File trang chi tiết được phép tải (không mở rộng ra cả thư mục video)
const FILES = ['thumbnail.png', 'final.mp4', 'captions.srt'];

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

function summary(id) {
  const dir = paths.resolveVideoDir(id);
  const script = readJson(path.join(dir, 'script.json'), {});
  const { date, channel, number, slug } = paths.parseId(id);
  const thumb = path.join(dir, 'thumbnail.png');
  return { id, date, channel, number, slug, title: script.title || slug, status: videoStatus(dir),
    thumbnail: fs.existsSync(thumb) ? Math.round(fs.statSync(thumb).mtimeMs) : null };
}

/** Danh sách + bản ghi hàng đợi tự đăng (`upload`, null nếu chưa xếp hàng) */
async function list() {
  const uploads = await require('./content.upload.service').statusMap();
  return paths.listVideoIds().map(id => ({ ...summary(id), upload: uploads[id] || null }));
}

/** Mọi thứ cần để đăng YouTube: tiêu đề, mô tả nguyên khối, tags, giờ đăng, file (mtime để chống cache) */
async function detail(id) {
  const dir = paths.resolveVideoDir(id);
  const raw = readJson(path.join(dir, 'script.json'), {});
  const script = raw && typeof raw === 'object' ? raw : {};
  const credits = readJson(path.join(dir, 'credits.json'), []);
  const mtime = (f) => (fs.existsSync(path.join(dir, f)) ? Math.round(fs.statSync(path.join(dir, f)).mtimeMs) : null);
  const uploads = await require('./content.upload.service').statusMap([id]);
  return {
    ...summary(id),
    upload: uploads[id] || null,
    thumbnailText: script.thumbnail_text || '',
    description: pack.youtubeDescription(script, Array.isArray(credits) ? credits : []),
    tags: Array.isArray(script.tags) ? script.tags : [],
    postTime: pack.postTime(paths.parseId(id).date),
    postAt: require('./content.upload.service').postInstant(paths.parseId(id).date).toISOString(),
    files: Object.fromEntries(FILES.map(f => [f, mtime(f)])),
  };
}

/** Đường dẫn tuyệt đối của một file trong FILES, hoặc null */
function filePath(id, name) {
  if (!FILES.includes(name)) return null;
  const f = path.join(paths.resolveVideoDir(id), name);
  return fs.existsSync(f) ? f : null;
}

module.exports = { list, detail, filePath };
