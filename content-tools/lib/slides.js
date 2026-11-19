/**
 * Dựng slide 1920x1080 cho mọi cảnh: ảnh nền + headline/sub + ghi nguồn; cảnh diagram dùng images/sceneNN.svg;
 * cảnh outro là slide nhận diện kênh. Thiếu ảnh/sơ đồ → thẻ TODO (đánh dấu để duyệt).
 * Kết quả: slides/sceneNN.png + slides/contact.jpg
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { THEMES, W, H, FONT, dataUri, starField, launchBrowser } = require('./theme');

const css = (t) => `
  body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${t.base};font-family:${FONT}}
  .bg{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat}
  .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(${t.shade},.92) 0%,rgba(${t.shade},.75) 34%,rgba(${t.shade},.15) 62%,rgba(${t.shade},0) 100%),
         linear-gradient(0deg,rgba(${t.shade},.75) 0%,rgba(${t.shade},0) 30%)}
  .txt{position:absolute;left:120px;top:240px;width:880px}
  h1{margin:0;color:#fff;font-weight:800;font-size:88px;line-height:1.08;letter-spacing:2px;text-transform:uppercase;text-shadow:0 4px 24px rgba(0,0,0,.6)}
  h1 em{font-style:normal;color:${t.accent}}
  p{margin:28px 0 0;color:${t.sub};font-size:40px;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,.7)}
  .brand{position:absolute;left:60px;bottom:36px;color:${t.brand};font-weight:800;font-size:24px;letter-spacing:3px}
  .brand b{color:${t.accent}}
  .credit{position:absolute;right:50px;bottom:36px;max-width:1100px;text-align:right;color:rgba(255,255,255,.65);font-size:20px;text-shadow:0 1px 4px #000}
  .diagram{position:absolute;right:70px;top:110px;width:900px;height:760px;display:flex;align-items:center;justify-content:center}
  .diagram svg{width:100%;height:100%}
  .todo{position:absolute;right:90px;top:180px;width:820px;padding:40px;border:4px dashed rgba(255,255,255,.5);border-radius:24px;color:#fff;font-size:30px;line-height:1.4;background:rgba(0,0,0,.35)}
  .todo b{display:block;color:#ff7a7a;font-size:26px;letter-spacing:3px;margin-bottom:14px}`;

function sceneHtml(t, scene, n, dir, credit) {
  const v = scene.visual || {};
  const img = path.join(dir, 'images', `scene${n}.jpg`);
  const svg = path.join(dir, 'images', `scene${n}.svg`);
  let visual, shade = '<div class="shade"></div>', todo = false;
  if (v.type !== 'diagram' && fs.existsSync(img)) {
    visual = `<div class="bg" style="background-image:url(${dataUri(img)});${v.bgPosition ? `background-position:${v.bgPosition};` : ''}${v.bgSize ? `background-size:${v.bgSize};` : ''}"></div>`;
  } else if (fs.existsSync(svg)) {
    visual = `<div class="bg" style="background:${t.diagramBg}"></div>${t.stars ? starField(n) : ''}<div class="diagram">${fs.readFileSync(svg, 'utf8')}</div>`;
    shade = '';
  } else {
    todo = true;
    visual = `<div class="todo"><b>TODO · ${v.type === 'diagram' ? 'DIAGRAM' : 'MISSING IMAGE'}</b>${(v.spec || v.query || v.note || '').replace(/</g, '&lt;')}</div>`;
    shade = '';
  }
  return { todo, html: `<html><head><style>${css(t)}</style></head><body>${visual}${shade}
    <div class="txt"><h1>${scene.headline || ''}</h1>${scene.sub ? `<p>${scene.sub}</p>` : ''}</div>
    <div class="brand">${t.name}</div>${credit ? `<div class="credit">${credit}</div>` : ''}</body></html>` };
}

function outroHtml(t) {
  return `<html><head><style>${css(t)}
    .o{position:absolute;inset:0;background:${t.outro.bg};display:flex;flex-direction:column;align-items:center;justify-content:center}
    .o img{width:300px;height:300px;border-radius:50%;box-shadow:0 0 80px rgba(255,255,255,.18)}
    .o h2{margin:50px 0 0;color:#fff;font-weight:800;font-size:96px;letter-spacing:3px}
    .o h2 b{color:${t.accent}}
    .o p{margin:18px 0 0;color:${t.sub};font-size:40px;text-shadow:none}
  </style></head><body><div class="o"><img src="${dataUri(t.avatar)}"><h2>${t.outro.title}</h2><p>${t.outro.line}</p></div></body></html>`;
}

function contactSheet(files, out) {
  if (files.length < 2) return;
  const cols = 4;
  const fc = files.map((_, i) => `[${i}]scale=480:270[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') +
    `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|') + ':fill=black';
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', fc, out]);
}

/** @returns {Promise<{todo: number[], count: number}>} */
async function renderVideo(dir, { onProgress = () => {}, browser } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const t = THEMES[script.channel];
  if (!t) throw new Error(`no theme for channel ${script.channel}`);
  const credFile = path.join(dir, 'credits.json');
  const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : [];
  const outDir = path.join(dir, 'slides'); fs.mkdirSync(outDir, { recursive: true });
  const own = !browser; browser = browser || await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const todo = [], files = [];
  try {
    for (let i = 0; i < script.scenes.length; i++) {
      const n = String(i + 1).padStart(2, '0'), scene = script.scenes[i];
      onProgress(i / script.scenes.length, `slide ${i + 1}/${script.scenes.length}`);
      let html;
      if (scene.visual?.type === 'outro') html = outroHtml(t);
      else {
        const c = credits.find(x => x.scene === i + 1 && !x.missing && x.credit);
        const r = sceneHtml(t, scene, n, dir, c ? `${c.source === 'Pixabay' ? '' : 'Image: '}${c.credit}` : '');
        html = r.html; if (r.todo) todo.push(i + 1);
      }
      await page.setContent(html, { waitUntil: 'load' });
      const file = path.join(outDir, `scene${n}.png`);
      await page.screenshot({ path: file });
      files.push(file);
    }
  } finally {
    await page.close();
    if (own) await browser.close();
  }
  contactSheet(files, path.join(outDir, 'contact.jpg'));
  onProgress(1, todo.length ? `TODO cảnh ${todo.join(', ')}` : `${files.length} slide`);
  return { todo, count: files.length };
}

// Video hoạt hình không dùng slide
const renderAny = (dir, opts) => (require('./video').animStyle(dir) ? Promise.resolve({ todo: 0, count: 0, skipped: 'anim' }) : renderVideo(dir, opts));

module.exports = { renderVideo: renderAny };
