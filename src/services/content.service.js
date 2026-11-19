/**
 * Content pipeline cho trang /content: chỉ đọc — danh sách video + trạng thái, và chi tiết để đăng YouTube.
 * Mọi thao tác (build, giọng, render, đánh dấu đã đăng) chạy qua `npm run content -- …` (AI gọi).
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

const list = () => paths.listVideoIds().map(summary);

/** Mọi thứ cần để đăng YouTube: tiêu đề, mô tả nguyên khối, tags, giờ đăng, file (mtime để chống cache) */
function detail(id) {
  const dir = paths.resolveVideoDir(id);
  const raw = readJson(path.join(dir, 'script.json'), {});
  const script = raw && typeof raw === 'object' ? raw : {};
  const credits = readJson(path.join(dir, 'credits.json'), []);
  const mtime = (f) => (fs.existsSync(path.join(dir, f)) ? Math.round(fs.statSync(path.join(dir, f)).mtimeMs) : null);
  return {
    ...summary(id),
    thumbnailText: script.thumbnail_text || '',
    description: pack.youtubeDescription(script, Array.isArray(credits) ? credits : []),
    tags: Array.isArray(script.tags) ? script.tags : [],
    postTime: pack.postTime(paths.parseId(id).date),
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
