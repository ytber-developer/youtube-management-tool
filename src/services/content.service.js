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
  build: (dir, p) => require(path.join(LIB, 'build')).buildVideo(dir, { onProgress: p }),
  // Giọng Kokoro offline rồi render luôn video cuối
  tts: async (dir, p) => {
    await require(path.join(LIB, 'tts')).synthesize(dir, { onProgress: (x, m) => p(x * 0.4, m) });
    await require(path.join(LIB, 'video')).renderFinal(dir, { onProgress: (x, m) => p(0.4 + x * 0.6, m) });
  },
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
  return { id, date, channel, number, slug, title: script.title || slug, thumbnailText: script.thumbnail_text, status: videoStatus(dir), job: activeJob(id) };
}

const list = () => paths.listVideoIds().map(summary);

function detail(id) {
  const dir = paths.resolveVideoDir(id);
  if (!dir) return null;
  const raw = readJson(path.join(dir, 'script.json'), {});
  // Chuẩn hoá để giao diện không vỡ khi script đang viết dở (trạng thái đã báo "Kịch bản lỗi")
  const arr = (v) => (Array.isArray(v) ? v : []);
  const script = { ...raw, title: raw.title || '', description: raw.description || '', thumbnail_text: raw.thumbnail_text || '',
    tags: arr(raw.tags), sources: arr(raw.sources),
    scenes: arr(raw.scenes).filter(sc => sc && typeof sc === 'object').map(sc => ({ narration: '', headline: '', sub: '', ...sc, visual: sc.visual || { type: 'unknown' } })) };
  return {
    ...summary(id),
    script,
    credits: readJson(path.join(dir, 'credits.json'), []),
    review: readJson(path.join(dir, 'review.json'), {}),
    narration: readText(path.join(dir, 'narration.txt')),
    metadata: readText(path.join(dir, 'metadata.md')),
    files: Object.fromEntries(['thumbnail.png', 'preview.mp4', 'voice.mp3', 'final.mp4', 'captions.srt', 'slides/contact.jpg']
      .map(f => [f, fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).mtimeMs : null])),
    slides: script.scenes.map((s, i) => {
      const n = String(i + 1).padStart(2, '0');
      return { scene: i + 1, file: `slides/scene${n}.png`, exists: fs.existsSync(path.join(dir, 'slides', `scene${n}.png`)), headline: s.headline, type: s.visual?.type };
    }),
  };
}

function enqueue(id, action) {
  if (!Object.hasOwn(ACTIONS, action)) { const e = new Error(`Tác vụ không hợp lệ: ${action}`); e.status = 400; throw e; }
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
// Có luồng âm thanh hợp lệ (ffprobe đọc được, độ dài > 0)?
function probeAudio(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', file],
      (err, stdout) => {
        if (err) return resolve(false);
        try {
          const j = JSON.parse(stdout);
          resolve((j.streams || []).some(st => st.codec_type === 'audio') && +(j.format?.duration) > 0);
        } catch { resolve(false); }
      });
  });
}

// Ghi ra voice.part.mp3 rồi mới đổi tên → voice.mp3 cũ chỉ bị thay khi file mới hợp lệ hoàn toàn
async function saveVoice(id, tmpFile, originalName) {
  const dir = paths.resolveVideoDir(id);
  const out = path.join(dir, 'voice.mp3');
  const part = path.join(dir, 'voice.part.mp3');
  try {
    if (!(await probeAudio(tmpFile))) {
      const e = new Error('File không phải âm thanh hợp lệ (cần .mp3, .m4a hoặc .wav)');
      e.code = 'NOT_AUDIO';
      throw e;
    }
    if (/\.mp3$/i.test(originalName)) await fs.promises.copyFile(tmpFile, part);
    else await new Promise((resolve, reject) => execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmpFile, '-vn', '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', part], (err) => (err ? reject(err) : resolve())));
    await fs.promises.rename(part, out);
  } finally {
    fs.rmSync(tmpFile, { force: true });
    fs.rmSync(part, { force: true });
  }
  return enqueue(id, 'render');
}

module.exports = { list, detail, enqueue, updateReview, saveVoice, jobs: () => queue.list(), ACTIONS: Object.keys(ACTIONS) };
