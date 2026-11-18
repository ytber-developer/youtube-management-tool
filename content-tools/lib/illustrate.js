/**
 * Tranh minh hoạ ghép từ Fluent Emoji Flat (Microsoft, MIT) — nhẹ (~1 s/ảnh), không cần mô hình AI.
 * Dùng khi không có ảnh miễn phí hợp lệ cho một cảnh. Chọn icon:
 *   - visual.icons: ["anatomical-heart", "stethoscope"] trong script.json (ưu tiên), hoặc
 *   - tự tìm theo từ khoá của visual.query/note qua API tìm kiếm Iconify.
 * Bố cục: 1 icon chính lớn ở giữa + tối đa 3 icon phụ, trên nền gradient của kênh.
 */
const fs = require('fs');
const { THEMES, launchBrowser } = require('./theme');

const PREFIX = 'fluent-emoji-flat';
const STOP = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'under', 'of', 'in', 'on', 'at', 'to', 'by', 'a', 'an',
  'illustration', 'photo', 'image', 'close', 'view', 'side', 'front', 'diagram', 'micrograph', 'microscopy', 'scan', 'his', 'her', 'their',
  'person', 'people', 'man', 'woman', 'during', 'after', 'before', 'while', 'very', 'up', 'out']);
// Các biến thể màu da: giữ bản mặc định (vàng) cho đồng bộ
const SKIN = /-(light|dark|medium|medium-light|medium-dark)$/;

function keywords(text = '') {
  return text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w));
}

const cache = new Map();
async function iconifySearch(word) {
  if (cache.has(word)) return cache.get(word);
  let icons = [];
  try {
    const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(word)}&prefix=${PREFIX}&limit=12`);
    if (r.ok) icons = ((await r.json()).icons || []).map(n => n.replace(`${PREFIX}:`, '')).filter(n => !SKIN.test(n));
  } catch { /* mạng lỗi → coi như không có icon */ }
  cache.set(word, icons);
  return icons;
}

const known = new Map();
async function iconExists(name) {
  if (!known.has(name)) {
    let ok = false;
    try { ok = (await fetch(`https://api.iconify.design/${PREFIX}.json?icons=${encodeURIComponent(name)}`).then(r => r.json())).icons?.[name] != null; } catch { /* mạng lỗi */ }
    known.set(name, ok);
  }
  return known.get(name);
}

/** → { main, side[] } hoặc null nếu không tìm được icon nào. Icon chỉ định sai tên thì bỏ, hết thì tự tìm. */
async function pickIcons(visual = {}, search = iconifySearch, exists = iconExists) {
  if (Array.isArray(visual.icons) && visual.icons.length) {
    const ok = [];
    for (const n of visual.icons) if (await exists(n)) ok.push(n);
    if (ok.length) return { main: ok[0], side: ok.slice(1, 4) };
  }
  const chosen = [];
  for (const w of keywords(`${visual.query || ''} ${visual.note || ''}`)) {
    if (chosen.length >= 4) break;
    const hit = (await search(w)).find(n => !chosen.includes(n));
    if (hit) chosen.push(hit);
  }
  return chosen.length ? { main: chosen[0], side: chosen.slice(1) } : null;
}

function creditFor(icons) {
  return {
    source: 'Illustration (Fluent Emoji)',
    id: `emoji:${[icons.main, ...icons.side].join('+')}`,
    title: [icons.main, ...icons.side].join(', '),
    credit: 'Illustration with Fluent Emoji by Microsoft',
    license: 'MIT',
    url: 'https://github.com/microsoft/fluentui-emoji',
    illustration: true,
  };
}

async function svgOf(name) {
  const r = await fetch(`https://api.iconify.design/${PREFIX}/${encodeURIComponent(name)}.svg`);
  if (!r.ok) throw new Error(`icon ${name}: HTTP ${r.status}`);
  return r.text();
}

// Chữ tiêu đề của slide nằm bên trái/trên → hình đặt nửa phải, icon phụ ở rìa phải và dưới
const SIDE_POS = [[1360, 70, 170, 10], [700, 600, 190, -6], [1380, 640, 170, 8]];

function html(theme, main, side) {
  const sized = (svg, s) => svg.replace('<svg', `<svg width="${s}" height="${s}"`);
  return `<body style="margin:0;width:1600px;height:900px;overflow:hidden;position:relative;background:${theme.diagramBg}">
    <div style="position:absolute;width:900px;height:900px;border-radius:50%;left:700px;top:0px;background:radial-gradient(circle,rgba(255,255,255,.30),rgba(255,255,255,0) 65%)"></div>
    <div style="position:absolute;width:300px;height:300px;border-radius:50%;left:1300px;top:580px;background:${theme.accent}26"></div>
    <div style="position:absolute;left:860px;top:170px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.4))">${sized(main, 580)}</div>
    ${side.map((x, i) => `<div style="position:absolute;left:${SIDE_POS[i][0]}px;top:${SIDE_POS[i][1]}px;transform:rotate(${SIDE_POS[i][3]}deg);filter:drop-shadow(0 16px 20px rgba(0,0,0,.35))">${sized(x, SIDE_POS[i][2])}</div>`).join('')}
  </body>`;
}

/**
 * Vẽ cả lô (một trình duyệt). jobs: [{ scene, visual, out }] → [{ scene, info }] cho các cảnh vẽ được.
 */
async function renderBatch(jobs, channel, onProgress = () => {}) {
  const theme = THEMES[channel] || THEMES['inside-your-body'];
  const done = [];
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      onProgress(i / jobs.length, `minh hoạ cảnh ${j.scene}`);
      const icons = await pickIcons(j.visual);
      if (!icons) continue;
      let main, side;
      try {
        main = await svgOf(icons.main);
        side = (await Promise.all(icons.side.map(n => svgOf(n).catch(() => null)))).filter(Boolean);
      } catch { continue; }
      await page.setContent(html(theme, main, side), { waitUntil: 'load' });
      await page.screenshot({ path: j.out, type: 'jpeg', quality: 88 });
      if (fs.existsSync(j.out)) done.push({ scene: j.scene, info: { ...creditFor(icons), width: 1600, height: 900 } });
    }
  } finally { await browser.close(); }
  return done;
}

module.exports = { keywords, pickIcons, creditFor, renderBatch };
