/**
 * Trạng thái một video, tính hoàn toàn từ file trên đĩa (không lưu riêng nên không bao giờ lệch).
 * steps: script, images, review, slides, preview, voice, final, uploaded → 'done' | 'todo' | 'stale' | 'error'
 */
const fs = require('fs');
const path = require('path');
const { validateScript, words } = require('./check');
const { IMAGE_TYPES } = require('./images');
const CHANNELS = require('./channels');
const narrationText = (script) => script.scenes.map(s => String(s.narration || '').trim()).join('\n\n');

const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const STAGES = [
  ['script', 'Kịch bản lỗi'], ['images', 'Thiếu ảnh'], ['review', 'Chờ duyệt ảnh'], ['slides', 'Cần dựng slide'],
  ['preview', 'Cần dựng preview'], ['voice', 'Chờ lồng tiếng'], ['final', 'Cần render video cuối'], ['uploaded', 'Chờ đăng'],
];

function videoStatus(dir) {
  const raw = readJson(path.join(dir, 'script.json'), {});
  const script = raw && typeof raw === 'object' ? raw : {};
  const scenes = Array.isArray(script.scenes) ? script.scenes.filter(s => s && typeof s === 'object') : [];
  const review = readJson(path.join(dir, 'review.json'), {});
  const check = validateScript(script);
  const n = (i) => String(i + 1).padStart(2, '0');

  // Ảnh / sơ đồ cần cho mỗi cảnh (trừ outro)
  const missingScenes = [];
  let imagesNeed = 0, inputsMtime = mtime(path.join(dir, 'script.json'));
  inputsMtime = Math.max(inputsMtime, mtime(path.join(dir, 'credits.json')));
  scenes.forEach((s, i) => {
    const t = s.visual?.type;
    if (t === 'outro') return;
    imagesNeed++;
    const file = path.join(dir, 'images', `scene${n(i)}.${t === 'diagram' ? 'svg' : 'jpg'}`);
    if (!fs.existsSync(file) || (!IMAGE_TYPES.includes(t) && t !== 'diagram')) missingScenes.push(i + 1);
    inputsMtime = Math.max(inputsMtime, mtime(file));
  });

  const slideFiles = scenes.map((_, i) => path.join(dir, 'slides', `scene${n(i)}.png`));
  const slidesOk = slideFiles.length > 0 && slideFiles.every(f => fs.existsSync(f));
  const slidesMtime = slidesOk ? Math.min(...slideFiles.map(mtime)) : 0;
  const slidesNewest = slidesOk ? Math.max(...slideFiles.map(mtime)) : 0;
  const fresh = (file, after) => (!fs.existsSync(file) ? 'todo' : mtime(file) >= after ? 'done' : 'stale');

  const voiceFile = path.join(dir, 'voice.mp3');
  // Giọng đọc theo lời kịch bản: lời đã đổi sau khi tạo giọng → giọng cũ, phải đọc lại (nếu không phụ đề lệch)
  const voiceState = (() => {
    if (!fs.existsSync(voiceFile)) return 'todo';
    const said = path.join(dir, 'voice.txt'); // lời đã đọc lúc tạo giọng (tts ghi); không có → giọng tay/cũ, coi là khớp
    if (!fs.existsSync(said)) return 'done';
    return fs.readFileSync(said, 'utf8').trim() === narrationText({ scenes }).trim() ? 'done' : 'stale';
  })();
  if (script.style === 'anim') { // hoạt hình: không có ảnh/slide/preview; video cuối phụ thuộc kịch bản + giọng
    missingScenes.length = 0; imagesNeed = 0;
    const anim = {
      script: check.ok ? 'done' : 'error', images: 'done', review: 'done', slides: 'done', preview: 'done',
      voice: voiceState,
      final: fresh(path.join(dir, 'final.mp4'), Math.max(mtime(path.join(dir, 'script.json')), mtime(voiceFile))),
      uploaded: review.uploadedUrl ? 'done' : 'todo',
    };
    return finish(anim);
  }
  const steps = {
    script: check.ok ? 'done' : 'error',
    images: missingScenes.length ? 'todo' : 'done',
    review: review.imagesReviewed ? 'done' : 'todo',
    slides: !slidesOk ? 'todo' : slidesMtime >= inputsMtime ? 'done' : 'stale',
    preview: fresh(path.join(dir, 'preview.mp4'), slidesNewest),
    voice: voiceState,
    final: fresh(path.join(dir, 'final.mp4'), Math.max(slidesNewest, mtime(voiceFile))),
    uploaded: review.uploadedUrl ? 'done' : 'todo',
  };
  return finish(steps);

  function finish(steps) {
  const pending = STAGES.find(([k]) => steps[k] !== 'done');
  const totalWords = scenes.reduce((a, s) => a + words(s.narration || ''), 0);
  return {
    steps,
    stage: pending ? (steps[pending[0]] === 'stale' ? `${pending[1]} (cũ)` : pending[1]) : 'Đã đăng',
    stageKey: pending ? pending[0] : 'done',
    imagesHave: imagesNeed - missingScenes.length,
    imagesNeed,
    missingScenes,
    durationEst: Math.round(totalWords / CHANNELS.WPM * 60),
    errors: check.errors,
    hasThumbnail: fs.existsSync(path.join(dir, 'thumbnail.png')),
    uploadedUrl: review.uploadedUrl || null,
  };
  }
}

module.exports = { videoStatus, STAGES };
