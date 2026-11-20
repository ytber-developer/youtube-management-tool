/**
 * Ghép video từ slides + phụ đề (+ giọng đọc):
 *   renderPreview(dir) → preview.mp4 (chưa lồng tiếng, thời lượng ước tính 163 từ/phút, phụ đề ước tính)
 *   renderFinal(dir)   → final.mp4 + captions.srt (cần voice.mp3; mốc câu từ voice.timings.json, dự phòng canh theo khoảng lặng)
 * Mỗi cảnh zoom chậm (xen kẽ vào/ra), chuyển cảnh mờ 0.6s ở ranh giới cảnh, phụ đề PNG trong suốt,
 * cảnh outro không in phụ đề (vẫn có trong SRT), giữ thêm 1.2s cuối.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const align = require('./align');
const captions = require('./captions');
const slides = require('./slides');
const { W, H, FONT, launchBrowser } = require('./theme');

const FPS = 30, FADE = 0.6, TAIL = 1.2;

const run = (args, onLine) => new Promise((resolve, reject) => {
  const p = execFile('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 }, (err, _o, stderr) => err ? reject(new Error(stderr.split('\n').slice(-6).join('\n'))) : resolve());
  if (onLine) p.stderr.on('data', d => onLine(String(d)));
});

function sceneSentences(script) {
  const out = [];
  script.scenes.forEach((s, i) => align.splitSentences(s.narration).forEach(text => out.push({ scene: i, text })));
  return out;
}

const captionHtml = (text) => `<html><head><style>
  html,body{margin:0;background:transparent;width:${W}px;height:${H}px}
  .c{position:absolute;left:0;right:0;bottom:110px;text-align:center}
  span{display:inline-block;padding:14px 30px;border-radius:14px;background:rgba(0,0,0,.62);color:#fff;font-family:${FONT};font-weight:700;font-size:54px;line-height:1.2}
</style></head><body>${text ? `<div class="c"><span>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></div>` : ''}</body></html>`;

async function renderCaptionTrack(dir, cues, skipFrom, total) {
  const capDir = path.join(dir, 'caps');
  fs.rmSync(capDir, { recursive: true, force: true }); fs.mkdirSync(capDir);
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const blank = path.join(capDir, 'blank.png');
  let list = '', t = 0;
  const push = (file, d) => { if (d > 0.001) list += `file '${file}'\nduration ${d.toFixed(3)}\n`; };
  try {
    await page.setContent(captionHtml('')); await page.screenshot({ path: blank, omitBackground: true });
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (c.start >= skipFrom) break; // cảnh outro: không in phụ đề
      const f = path.join(capDir, `c${String(i).padStart(4, '0')}.png`);
      await page.setContent(captionHtml(c.text)); await page.screenshot({ path: f, omitBackground: true });
      push(blank, c.start - t); push(f, c.end - c.start); t = c.end;
    }
  } finally { await browser.close(); }
  push(blank, Math.max(total - t, 0.5));
  list += `file '${blank}'\n`;
  const listFile = path.join(capDir, 'list.txt');
  fs.writeFileSync(listFile, list);
  return listFile;
}

async function render(dir, { mode, onProgress = () => {} }) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const sents = sceneSentences(script);
  const voice = path.join(dir, 'voice.mp3');
  let timings, total;
  if (mode === 'final') {
    if (!fs.existsSync(voice)) throw new Error('Chưa có voice.mp3');
    onProgress(0.02, 'canh câu');
    const r = await align.sentenceTimings(dir, sents.map(s => s.text), voice);
    timings = r.timings;
    total = r.duration + TAIL;
  } else {
    timings = align.estimateTimings(sents.map(s => s.text));
    total = timings[timings.length - 1].end + TAIL;
  }

  // Ranh giới cảnh = giữa câu cuối của cảnh trước và câu đầu của cảnh sau
  const nScenes = script.scenes.length, starts = [0];
  for (let i = 1; i < nScenes; i++) {
    const first = sents.findIndex(s => s.scene === i);
    starts.push((timings[first - 1].end + timings[first].start) / 2);
  }
  const ends = [...starts.slice(1), total];
  const durs = starts.map((s, i) => (ends[i] - s) + (i === 0 || i === nScenes - 1 ? FADE / 2 : FADE));

  const slideFiles = script.scenes.map((_, i) => path.join(dir, 'slides', `scene${String(i + 1).padStart(2, '0')}.png`));
  if (slideFiles.some(f => !fs.existsSync(f))) { onProgress(0.05, 'dựng slide'); await slides.renderVideo(dir); }

  onProgress(0.1, 'dựng phụ đề');
  const { CAPTION_DISPLAY } = require('./channels');
  const display = (txt) => CAPTION_DISPLAY.reduce((a, [re, rep]) => a.replace(re, rep), txt);
  const cues = captions.buildCues(sents.map(s => display(s.text)), timings);
  if (mode === 'final') fs.writeFileSync(path.join(dir, 'captions.srt'), captions.toSrt(cues));
  const capList = await renderCaptionTrack(dir, cues, starts[nScenes - 1] + FADE / 2, total);

  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:2'];
  slideFiles.forEach((f, i) => args.push('-loop', '1', '-t', durs[i].toFixed(3), '-i', f));
  args.push('-f', 'concat', '-safe', '0', '-i', capList);
  if (mode === 'final') args.push('-i', voice); else args.push('-f', 'lavfi', '-t', total.toFixed(2), '-i', 'anullsrc=r=44100:cl=stereo');
  let fc = '';
  slideFiles.forEach((_, i) => {
    const N = Math.round(durs[i] * FPS);
    const z = i % 2 === 0 ? `1+0.06*on/${N}` : `1.06-0.06*on/${N}`;
    fc += `[${i}:v]scale=2880:1620,zoompan=z='${z}':d=${N}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p,setsar=1[v${i}];`;
  });
  let prev = 'v0';
  for (let i = 1; i < nScenes; i++) {
    const out = i === nScenes - 1 ? 'vbase' : `x${i}`;
    fc += `[${prev}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${(starts[i] - FADE / 2).toFixed(3)}[${out}];`;
    prev = out;
  }
  if (nScenes === 1) fc += '[v0]null[vbase];';
  fc += `[${nScenes}:v]fps=${FPS},format=rgba[cap];[vbase][cap]overlay=0:0:format=auto,format=yuv420p[vout];`;
  fc += mode === 'final' ? `[${nScenes + 1}:a]apad=pad_dur=${TAIL},afade=t=out:st=${(total - 1).toFixed(2)}:d=1[aout]` : `[${nScenes + 1}:a]anull[aout]`;
  const out = path.join(dir, mode === 'final' ? 'final.mp4' : 'preview.mp4');
  args.push('-filter_complex', fc, '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(2), '-movflags', '+faststart', out + '.part.mp4');

  onProgress(0.15, 'ghép video');
  try {
    await run(args, (chunk) => {
      const m = chunk.match(/out_time_ms=(\d+)/g);
      if (m) onProgress(0.15 + 0.85 * Math.min(1, (+m[m.length - 1].split('=')[1] / 1e6) / total), 'ghép video');
    });
    fs.renameSync(out + '.part.mp4', out);
  } finally {
    // ffmpeg lỗi giữa chừng → không để lại file tạm hàng trăm MB
    fs.rmSync(out + '.part.mp4', { force: true });
    fs.rmSync(path.join(dir, 'caps'), { recursive: true, force: true });
  }
  onProgress(1, `${path.basename(out)} ${total.toFixed(1)}s`);
  return { video: out, srt: mode === 'final' ? path.join(dir, 'captions.srt') : null, duration: total };
}

// Video hoạt hình (script.style === 'anim') dựng bằng lib/animate.js; không có preview
const animStyle = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8')).style === 'anim'; } catch { return false; } };

module.exports = {
  renderPreview: (dir, opts = {}) => (animStyle(dir) ? Promise.resolve({ skipped: 'anim' }) : render(dir, { ...opts, mode: 'preview' })),
  renderFinal: (dir, opts = {}) => (animStyle(dir) ? require('./animate').renderFinal(dir, opts) : render(dir, { ...opts, mode: 'final' })),
  animStyle,
  sceneSentences,
};
