/**
 * Content pipeline cho trang /content: danh sách video, chi tiết, tác vụ (hàng đợi tuần tự),
 * duyệt/đánh dấu đã đăng, nhận voice.mp3. Mọi logic dựng nằm ở content-tools/lib.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const LIB = path.resolve(__dirname, '..', '..', 'content-tools', 'lib');
const paths = require(path.join(LIB, 'paths'));
const { videoStatus } = require(path.join(LIB, 'status'));
const { createQueue } = require(path.join(LIB, 'queue'));

const ACTIONS = {
  images: (dir, p) => require(path.join(LIB, 'images')).fetchForVideo(dir, { onProgress: p }),
  slides: (dir, p) => require(path.join(LIB, 'slides')).renderVideo(dir, { onProgress: p }),
  thumb: (dir) => require(path.join(LIB, 'thumb')).render(dir),
  package: (dir) => require(path.join(LIB, 'pack')).writeAll(dir),
  preview: (dir, p) => require(path.join(LIB, 'video')).renderPreview(dir, { onProgress: p }),
  render: (dir, p) => require(path.join(LIB, 'video')).renderFinal(dir, { onProgress: p }),
};

const queue = createQueue(async (job, onProgress) => {
  const dir = paths.resolveVideoDir(job.videoId);
  if (!dir) throw new Error('Video không tồn tại');
  await ACTIONS[job.action](dir, onProgress);
});

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const activeJob = (id) => queue.list().filter(j => j.videoId === id && (j.state === 'running' || j.state === 'queued')).pop() || null;

function summary(id) {
  const dir = paths.resolveVideoDir(id);
  const script = readJson(path.join(dir, 'script.json'), {});
  const { date, channel, number, slug } = paths.parseId(id);
  return { id, date, channel, number, slug, title: script.title, thumbnailText: script.thumbnail_text, status: videoStatus(dir), job: activeJob(id) };
}

const list = () => paths.listVideoIds().map(summary);

function detail(id) {
  const dir = paths.resolveVideoDir(id);
  if (!dir) return null;
  const script = readJson(path.join(dir, 'script.json'), {});
  return {
    ...summary(id),
    script,
    credits: readJson(path.join(dir, 'credits.json'), []),
    review: readJson(path.join(dir, 'review.json'), {}),
    narration: readText(path.join(dir, 'narration.txt')),
    metadata: readText(path.join(dir, 'metadata.md')),
    files: Object.fromEntries(['thumbnail.png', 'preview.mp4', 'voice.mp3', 'final.mp4', 'captions.srt', 'slides/contact.jpg']
      .map(f => [f, fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).mtimeMs : null])),
    slides: (script.scenes || []).map((s, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { scene: i + 1, file: `slides/scene${n}.png`, exists: fs.existsSync(path.join(dir, 'slides', `scene${n}.png`)), headline: s.headline, type: s.visual?.type };
    }),
  };
}

function enqueue(id, action) {
  if (!ACTIONS[action]) { const e = new Error(`Tác vụ không hợp lệ: ${action}`); e.status = 400; throw e; }
  return queue.enqueue({ videoId: id, action });
}

function updateReview(id, body = {}) {
  const dir = paths.resolveVideoDir(id);
  const file = path.join(dir, 'review.json');
  const review = readJson(file, {});
  if (typeof body.imagesReviewed === 'boolean') review.imagesReviewed = body.imagesReviewed;
  if (body.uploadedUrl === null || body.uploadedUrl === '') delete review.uploadedUrl;
  else if (typeof body.uploadedUrl === 'string') review.uploadedUrl = body.uploadedUrl.trim().slice(0, 300);
  fs.writeFileSync(file, JSON.stringify(review, null, 2) + '\n');
  return review;
}

/** Lưu file giọng thành voice.mp3 (chuyển định dạng nếu cần) rồi xếp hàng render video cuối */
function saveVoice(id, tmpFile, originalName) {
  const dir = paths.resolveVideoDir(id);
  const out = path.join(dir, 'voice.mp3');
  return new Promise((resolve, reject) => {
    const done = (err) => { fs.rmSync(tmpFile, { force: true }); if (err) return reject(err); resolve(enqueue(id, 'render')); };
    if (/\.mp3$/i.test(originalName)) { fs.copyFile(tmpFile, out, done); return; }
    execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmpFile, '-codec:a', 'libmp3lame', '-q:a', '2', out], (err) => done(err));
  });
}

module.exports = { list, detail, enqueue, updateReview, saveVoice, jobs: () => queue.list(), ACTIONS: Object.keys(ACTIONS) };
