/**
 * Thumbnail 1280x720: ảnh nền của cảnh 1 (hoặc ảnh đầu tiên có sẵn), lớp tối, thumbnail_text cỡ lớn,
 * avatar kênh ở góc. Kết quả: <video>/thumbnail.png
 */
const fs = require('fs');
const path = require('path');
const { THEMES, FONT, dataUri, starField, launchBrowser } = require('./theme');

const TW = 1280, TH = 720;

function pickBackground(dir, script) {
  for (let i = 0; i < script.scenes.length; i++) {
    const n = String(i + 1).padStart(2, '0');
    const img = path.join(dir, 'images', `scene${n}.jpg`);
    if (script.scenes[i].visual?.type !== 'diagram' && fs.existsSync(img)) return { img, v: script.scenes[i].visual || {} };
  }
  return null;
}

function thumbHtml(t, script, bg) {
  const words = String(script.thumbnail_text || script.title || '').toUpperCase().split(/\s+/).filter(Boolean);
  // từ cuối tô màu nhấn của kênh
  const text = words.map((w, i) => (i === words.length - 1 ? `<em>${w}</em>` : w)).join(' ');
  const size = text.replace(/<[^>]+>/g, '').length > 16 ? 112 : 136;
  return `<html><head><style>
    body{margin:0;width:${TW}px;height:${TH}px;overflow:hidden;background:${t.base};font-family:${FONT}}
    .bg{position:absolute;inset:0;background-size:cover;background-position:${bg?.v.bgPosition || 'center'}}
    .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(${t.shade},.88) 0%,rgba(${t.shade},.55) 45%,rgba(${t.shade},0) 75%)}
    h1{position:absolute;left:60px;top:50%;transform:translateY(-50%);width:760px;margin:0;color:#fff;font-weight:900;font-size:${size}px;
       line-height:1.0;letter-spacing:1px;text-shadow:0 6px 30px rgba(0,0,0,.8), 0 0 2px #000;-webkit-text-stroke:2px rgba(0,0,0,.35)}
    h1 em{font-style:normal;color:${t.accent}}
    img.av{position:absolute;right:36px;bottom:30px;width:110px;height:110px;border-radius:50%;box-shadow:0 0 30px rgba(0,0,0,.6)}
  </style></head><body>
    ${bg ? `<div class="bg" style="background-image:url(${dataUri(bg.img)})"></div>` : `<div class="bg" style="background:${t.diagramBg}"></div>${t.stars ? starField(7, TW, TH) : ''}`}
    <div class="shade"></div><h1>${text}</h1><img class="av" src="${dataUri(t.avatar)}">
  </body></html>`;
}

async function render(dir, { browser } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const t = THEMES[script.channel];
  const own = !browser; browser = browser || await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: TW, height: TH });
    await page.setContent(thumbHtml(t, script, pickBackground(dir, script)), { waitUntil: 'load' });
    const out = path.join(dir, 'thumbnail.png');
    await page.screenshot({ path: out });
    return out;
  } finally {
    await page.close();
    if (own) await browser.close();
  }
}

module.exports = { render };
