/**
 * Video hoạt hình nhân vật (script.style === "anim"): mỗi cảnh có `anim` = { action, props[], face, text, bg, camera }.
 * voice.mp3 → mốc câu (voice.timings.json, dự phòng silencedetect + DP) → mốc thời gian từng cảnh → Chrome vẽ từng khung (anim/stage.js +
 * anim/character.js) → JPEG đẩy thẳng vào ffmpeg → final.mp4 + captions.srt. Thumbnail: renderThumb().
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { launchBrowser } = require('./theme');
const { sentenceTimings } = require('./align');
const { sceneSentences } = require('./video');
const { buildCues, toSrt } = require('./captions');
const { CAPTION_DISPLAY } = require('./channels');

const ANIM = path.join(__dirname, '..', 'anim');
const FPS = 30, W = 1920, H = 1080, TAIL = 1.2;

const LOOK = {
  'cosmic-what-if': { shirt: '#ffb347', emblem: 'star', accent: '#ffb347', defaultBg: 'space', brand: ['COSMIC', 'WHAT IF?'] },
  'inside-your-body': { shirt: '#2ec4b6', emblem: 'heart', accent: '#e85d75', defaultBg: 'paper', brand: ['INSIDE', 'YOUR BODY'] },
};

const isAnim = (script) => script.style === 'anim';

/** Mọi icon Fluent Emoji mà các cảnh dùng (trừ đạo cụ vẽ tay như black-hole) */
function iconsOf(script) {
  const set = new Set();
  for (const s of script.scenes) for (const p of (s.anim && s.anim.props) || []) if (p.icon && p.icon !== 'black-hole') set.add(p.icon);
  return [...set];
}

async function loadImages(names) {
  const { svgOf } = require('./illustrate');
  const out = {};
  for (const n of names) {
    try { out[n] = 'data:image/svg+xml;base64,' + Buffer.from(await svgOf(n)).toString('base64'); }
    catch { /* icon không tồn tại → bỏ, cảnh vẫn chạy */ }
  }
  return out;
}

/** Mốc thời gian: câu → cảnh (liền nhau, không hở), cảnh cuối kéo tới hết đuôi */
function timeline(script, timings, duration) {
  const sents = sceneSentences(script);
  const scenes = script.scenes.map((s, i) => ({ anim: s.anim || { action: 'talk' }, outro: s.visual?.type === 'outro' || s.anim?.outro, idx: i, start: Infinity, end: 0 }));
  sents.forEach((x, j) => { const sc = scenes[x.scene]; sc.start = Math.min(sc.start, timings[j].start); sc.end = Math.max(sc.end, timings[j].end); });
  scenes[0].start = 0;
  for (let i = 1; i < scenes.length; i++) scenes[i].start = Math.max(scenes[i - 1].start + 0.1, scenes[i].start - 0.15);
  for (let i = 0; i < scenes.length - 1; i++) scenes[i].end = scenes[i + 1].start;
  const total = duration + TAIL;
  scenes[scenes.length - 1].end = total;
  scenes.forEach((s, i) => { s.anim = { seed: i, ...s.anim }; });
  return { scenes, sents, total };
}

async function renderFinal(dir, { onProgress = () => {} } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const voice = path.join(dir, 'voice.mp3');
  if (!fs.existsSync(voice)) throw new Error('Chưa có voice.mp3');
  onProgress(0.02, 'canh câu');
  const flat = sceneSentences(script);
  const { timings, duration } = await sentenceTimings(dir, flat.map(s => s.text), voice);
  const { scenes, total } = timeline(script, timings, duration);
  const display = (txt) => CAPTION_DISPLAY.reduce((a, [re, rep]) => a.replace(re, rep), txt);
  const cues = buildCues(flat.map(s => display(s.text)), timings);
  fs.writeFileSync(path.join(dir, 'captions.srt'), toSrt(cues));

  onProgress(0.05, 'tải đạo cụ');
  const look = LOOK[script.channel] || LOOK['cosmic-what-if'];
  const images = await loadImages(iconsOf(script));
  const out = path.join(dir, 'final.mp4');
  const part = out + '.part.mp4';
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', voice,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k',
    '-af', `apad=pad_dur=${TAIL}`, '-t', total.toFixed(2), '-movflags', '+faststart', part]);
  let ffErr = ''; ff.stderr.on('data', d => { ffErr = (ffErr + d).slice(-2000); });
  const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg: ${ffErr.trim().split('\n').pop()}`)))));
  const write = (buf) => new Promise(res => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    await page.setContent(`<html><body style="margin:0"><canvas id="c" width="${W}" height="${H}"></canvas></body></html>`);
    await page.addScriptTag({ path: path.join(ANIM, 'character.js') });
    await page.addScriptTag({ path: path.join(ANIM, 'stage.js') });
    await page.evaluate((cfg) => window.Stage.init(cfg), {
      ...look, images, scenes, total,
      sentences: timings.map(x => ({ start: x.start, end: x.end })),
      cues: cues.map(c => ({ start: c.start, end: c.end, lines: [c.text] })),
    });
    const n = Math.ceil(total * FPS);
    for (let f = 0; f < n; f++) {
      const dataUrl = await page.evaluate((t) => { window.Stage.frame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.9); }, f / FPS);
      await write(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
      if (f % 60 === 0) onProgress(0.08 + 0.9 * f / n, `khung ${f}/${n}`);
    }
  } finally {
    ff.stdin.end();
    await browser.close();
  }
  try {
    await ffDone;
    fs.renameSync(part, out);
  } finally { fs.rmSync(part, { force: true }); }
  onProgress(1, `final.mp4 ${total.toFixed(1)}s`);
  return { video: out, srt: path.join(dir, 'captions.srt'), duration: total };
}

/** Thumbnail 1280×720: nhân vật (biểu cảm mạnh) + đạo cụ chính + chữ to */
async function renderThumb(dir) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const look = LOOK[script.channel] || LOOK['cosmic-what-if'];
  const hero = script.thumbnail_anim || script.scenes.find(s => s.anim?.props?.length)?.anim || { action: 'shocked' };
  // Thumbnail xem ở cỡ nhỏ: nhân vật to gấp rưỡi, đạo cụ chính cỡ xl, không chữ cảnh
  const heroProps = hero.props || [];
  let main = heroProps.findIndex(p => !p.at || ['right', 'center', 'far-right'].includes(p.at));
  if (main < 0) main = 0;
  const props = heroProps.map((p, i) => (i === main ? { ...p, size: 'xl' } : p));
  const anim = { ...hero, props, action: hero.thumbAction || 'shocked', text: null, camera: 'none', big: 1.4 };
  const images = await loadImages((anim.props || []).map(p => p.icon).filter(n => n !== 'black-hole'));
  const out = path.join(dir, 'thumbnail.png');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent('<html><body style="margin:0"><canvas id="c" width="1280" height="720"></canvas></body></html>');
    await page.addScriptTag({ path: path.join(ANIM, 'character.js') });
    await page.addScriptTag({ path: path.join(ANIM, 'stage.js') });
    await page.evaluate(async (cfg) => {
      await window.Stage.init(cfg);
      window.Stage.frame(0.9);
      // chữ thumbnail: to, viết hoa, từ cuối màu nhấn
      const c = document.getElementById('c'), x = c.getContext('2d');
      const words = cfg.thumbText.toUpperCase().split(/\s+/);
      const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [words.join(' ')];
      const px = lines.length === 1 && lines[0].length <= 14 ? 124 : 104;
      x.font = `900 ${px}px "Avenir Next", "Helvetica Neue", Arial, sans-serif`; x.textAlign = 'right'; x.textBaseline = 'top'; x.lineJoin = 'round';
      lines.forEach((l, i) => {
        const y = 40 + i * (px + 8), last = i === lines.length - 1;
        x.lineWidth = 18; x.strokeStyle = '#151515'; x.strokeText(l, 1240, y);
        x.fillStyle = last ? cfg.accent : '#ffffff'; x.fillText(l, 1240, y);
      });
    }, { ...look, images, total: 2, scenes: [{ start: 0, end: 2, anim }], sentences: [], cues: [], thumbText: script.thumbnail_text || script.title });
    await (await page.$('#c')).screenshot({ path: out });
  } finally { await browser.close(); }
  return out;
}

module.exports = { isAnim, renderFinal, renderThumb, iconsOf, timeline, LOOK };
