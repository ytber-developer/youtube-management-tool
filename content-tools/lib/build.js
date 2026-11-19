/**
 * "Làm hết": chạy mọi bước còn thiếu/cũ cho một video, không cần Claude.
 * images → slides → thumb → package → preview → voice (Kokoro) → render
 */
const fs = require('fs');
const path = require('path');
const { videoStatus } = require('./status');

const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);

/** Bước cần chạy, tính từ trạng thái trên đĩa. Kịch bản lỗi → không làm gì (phải sửa kịch bản trước). */
function planBuild({ steps, hasThumbnail, hasPackage }) {
  if (steps.script !== 'done') return [];
  const plan = [];
  const redo = (k) => steps[k] !== 'done';
  if (redo('images')) plan.push('images');
  const slides = redo('images') || redo('slides');
  if (slides) plan.push('slides');
  if (!hasThumbnail || redo('images')) plan.push('thumb');
  if (!hasPackage || redo('images')) plan.push('package');
  if (slides || redo('preview')) plan.push('preview');
  if (redo('voice')) plan.push('voice');
  if (slides || redo('voice') || redo('final')) plan.push('render');
  return plan;
}

function stateOf(dir) {
  const st = videoStatus(dir);
  const script = mtime(path.join(dir, 'script.json'));
  const pkg = ['narration.txt', 'metadata.md'].every(f => mtime(path.join(dir, f)) >= script && mtime(path.join(dir, f)) > 0);
  return { steps: st.steps, hasThumbnail: st.hasThumbnail, hasPackage: pkg && mtime(path.join(dir, 'metadata.md')) >= mtime(path.join(dir, 'credits.json')) };
}

const RUN = {
  images: (dir, p) => require('./images').fetchForVideo(dir, { onProgress: p }),
  slides: (dir, p) => require('./slides').renderVideo(dir, { onProgress: p }),
  thumb: (dir) => require('./thumb').render(dir),
  package: (dir) => require('./pack').writeAll(dir),
  preview: (dir, p) => require('./video').renderPreview(dir, { onProgress: p }),
  voice: (dir, p) => require('./tts').synthesize(dir, { onProgress: p }),
  render: (dir, p) => require('./video').renderFinal(dir, { onProgress: p }),
};

/** Chạy toàn bộ kế hoạch; dừng nếu ảnh vẫn thiếu sau bước images (slide sẽ có thẻ TODO đỏ). */
async function buildVideo(dir, { onProgress = () => {}, log = () => {} } = {}) {
  const plan = planBuild(stateOf(dir));
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    const p = (x, m) => onProgress((i + Math.min(1, x || 0)) / plan.length, `${step}: ${m || ''}`);
    p(0, 'bắt đầu');
    const r = await RUN[step](dir, p);
    log(step, r);
    if (step === 'images' && r && !r.ok) throw new Error(`Còn thiếu ảnh cảnh ${r.missing.join(', ')} — xem skill source-visuals`);
  }
  onProgress(1, plan.length ? `xong: ${plan.join(' → ')}` : 'đã đủ, không cần làm gì');
  return plan;
}

module.exports = { planBuild, stateOf, buildVideo };
