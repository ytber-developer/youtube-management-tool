/**
 * Lấy ảnh cho từng cảnh theo script.json → images/sceneNN.jpg + credits.json
 * visual.type:
 *   nasa    → images.nasa.gov (ghi công NASA; ghim bằng visual.nasa_id) → Wikimedia Commons → tranh AI
 *   stock   → Pixabay (PIXABAY_API_KEY) → Openverse → tranh minh hoạ AI sinh trên máy (aigen.js). KHÔNG dùng Wikimedia
 *   science → Wikimedia Commons (chặt → nới) → Openverse → tranh AI kiểu tượng trưng (không nhãn, không chi tiết giải phẫu)
 *   diagram | outro → bỏ qua (SVG vẽ tay / slide kênh)
 * Giấy phép cho phép: NASA, Public Domain, CC0, CC BY, Pixabay Content License.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
require('./env').load();

const UA = 'ytb-content-tool/0.1 (personal educational video project)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const stripHtml = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const IMAGE_TYPES = ['nasa', 'stock', 'science'];

// ── kiểm tra thuần (có test) ─────────────────────────────────────────────────
function allowedLicense(short = '') {
  const s = short.toLowerCase();
  if (!s) return false;
  if (/\b(nc|nd|sa)\b|share ?alike|noncommercial|no ?deriv|gfdl|fair use/.test(s)) return false;
  return /public domain|^pd|cc0|cc[- ]by(?![- ]?sa)/.test(s);
}

const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'at', 'with', 'and', 'or', 'to', 'for', 'by', 'from', 'illustration', 'photo', 'image', 'close', 'up']);
function matchScore(query, text) {
  const t = (text || '').toLowerCase();
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  if (!words.length) return 1;
  const hit = words.filter(w => t.includes(w) || (w.endsWith('s') && t.includes(w.slice(0, -1))) || t.includes(w.replace(/ing$/, ''))).length;
  return hit / words.length;
}

// ── mạng + file ──────────────────────────────────────────────────────────────
async function getJson(url, headers = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
      if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 2) throw e; await sleep(1500); }
  }
  throw new Error(`HTTP 429 (rate limited) ${url.split('?')[0]}`);
}

function ensureJpeg(file) {
  try {
    const codec = execFileSync('ffprobe', ['-v', 'quiet', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file]).toString().trim();
    if (codec === 'mjpeg') return;
    const tmp = file + '.tmp.jpg';
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'quiet', '-y', '-i', file, '-frames:v', '1', '-q:v', '2', tmp]);
    fs.renameSync(tmp, file);
  } catch { /* imageSize sẽ trả 0 nếu file hỏng */ }
}

async function download(url, file) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status === 429 || r.status === 503) { await sleep(4000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    ensureJpeg(file);
    return;
  }
  throw new Error(`HTTP 429 (rate limited) ${url.split('?')[0]}`);
}

function imageSize(file) {
  try {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
    return { w, h };
  } catch { return { w: 0, h: 0 }; }
}

// ── NASA ──────────────────────────────────────────────────────────────────────
const NASA_BLOCK = /getty|associated press|\bAP Photo|reuters|©|copyright|all rights reserved/i;
function nasaCredit(m) {
  const c = (m.description || '').match(/(?:Image |Photo |Illustration )?[Cc]redits?:\s*([^\n<]{3,160})/);
  let credit = (c ? c[1] : (m.secondary_creator || m.photographer || '')).trim();
  credit = credit.replace(/\s{2,}.*$/, '').replace(/[.;]\s*(More info|Download|Read more).*$/i, '').trim();
  return credit || `NASA${m.center ? ` (${m.center})` : ''}`;
}

async function fetchNasa(query, used, outFile, pinnedId) {
  const d = await getJson(pinnedId
    ? `https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(pinnedId)}`
    : `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(query)}`);
  let items = (d.collection.items || []).slice(0, 15);
  if (!pinnedId) {
    items = items.map(it => ({ it, s: matchScore(query, `${it.data[0].title} ${it.data[0].description || ''} ${(it.data[0].keywords || []).join(' ')}`) }))
      .filter(x => x.s >= 0.5).sort((a, b) => b.s - a.s).map(x => x.it);
  }
  const tmp = outFile + '.fallback.jpg';
  let fallback = null;
  try {
    for (const it of items) {
      const m = it.data[0];
      if (used.has(m.nasa_id)) continue;
      const credit = nasaCredit(m);
      if (NASA_BLOCK.test(`${credit} ${m.description || ''}`)) continue;
      if (!/nasa|jpl|goddard|jsc|ksc|msfc|ames|langley|glenn|armstrong/i.test(`${credit} ${m.center || ''}`)) continue;
      const assets = await getJson(`https://images-api.nasa.gov/asset/${encodeURIComponent(m.nasa_id)}`);
      const hrefs = assets.collection.items.map(i => i.href.replace('http://', 'https://'));
      const pick = hrefs.find(h => /~large\.(jpe?g|png)$/i.test(h)) || hrefs.find(h => /~orig\.(jpe?g|png)$/i.test(h));
      if (!pick) continue;
      await download(pick, outFile);
      const { w, h } = imageSize(outFile);
      const info = { source: 'NASA Image and Video Library', id: m.nasa_id, title: m.title, credit, license: 'NASA (public domain)', url: `https://images.nasa.gov/details/${m.nasa_id}`, width: w, height: h };
      if (pinnedId || (w >= 1280 && w / h >= 1.2)) { used.add(m.nasa_id); return info; }
      if (!fallback && w >= 1000) { fs.copyFileSync(outFile, tmp); fallback = info; } // ảnh dọc/nhỏ: giữ làm dự phòng
    }
    if (fallback) { fs.renameSync(tmp, outFile); used.add(fallback.id); return fallback; }
    if (fs.existsSync(outFile) && !fallback) fs.rmSync(outFile); // không ảnh nào đạt → không để lại ảnh dở
    return null;
  } finally {
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
  }
}

// ── Wikimedia Commons ────────────────────────────────────────────────────────
let lastCommons = 0;
async function fetchCommons(query, used, outFile, { minWidth = 1200, minScore = 0.6 } = {}) {
  const wait = 2500 - (Date.now() - lastCommons); if (wait > 0) await sleep(wait);
  lastCommons = Date.now();
  const d = await getJson('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30' +
    `&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|size|extmetadata|mime&iiurlwidth=1920`);
  const cands = [];
  for (const p of Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const md = ii.extmetadata || {};
    const lic = stripHtml(md.LicenseShortName?.value);
    if (!allowedLicense(lic) || !/jpe?g|png/.test(ii.mime || '') || used.has(p.title) || ii.width < minWidth) continue;
    const score = matchScore(query, [p.title, stripHtml(md.ObjectName?.value), stripHtml(md.ImageDescription?.value), stripHtml(md.Categories?.value)].join(' '));
    if (score >= minScore) cands.push({ p, ii, md, lic, score, landscape: ii.width / ii.height >= 1.2 });
  }
  cands.sort((a, b) => (b.score - a.score) || (b.landscape - a.landscape));
  const c = cands[0];
  if (!c) return null;
  await download(c.ii.thumburl || c.ii.url, outFile);
  const { w, h } = imageSize(outFile);
  used.add(c.p.title);
  return { source: 'Wikimedia Commons', id: c.p.title, title: stripHtml(c.md.ObjectName?.value) || c.p.title.replace(/^File:/, ''),
    credit: `${stripHtml(c.md.Artist?.value) || 'Unknown author'} / ${c.lic}`, license: c.lic, url: c.ii.descriptionurl, width: w, height: h };
}

// ── Pixabay ──────────────────────────────────────────────────────────────────
async function fetchPixabay(query, used, outFile) {
  if (!process.env.PIXABAY_API_KEY) return null;
  const d = await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(query.slice(0, 100))}` +
    '&image_type=photo&orientation=horizontal&safesearch=true&per_page=20&order=popular');
  const hit = (d.hits || []).find(x => !used.has(`pixabay:${x.id}`) && x.imageWidth >= 1600);
  if (!hit) return null;
  await download(hit.largeImageURL, outFile);
  used.add(`pixabay:${hit.id}`);
  const { w, h } = imageSize(outFile);
  return { source: 'Pixabay', id: String(hit.id), title: hit.tags, credit: `${hit.user} / Pixabay`, license: 'Pixabay Content License', url: hit.pageURL, width: w, height: h };
}

// ── Openverse ────────────────────────────────────────────────────────────────
async function fetchOpenverse(query, used, outFile) {
  const d = await getJson('https://api.openverse.org/v1/images/?page_size=20&mature=false&license=cc0,pdm,by&aspect_ratio=wide&size=large' +
    `&q=${encodeURIComponent(query)}`);
  for (const r of d.results || []) {
    if (used.has(`ov:${r.id}`)) continue;
    const lic = r.license === 'pdm' ? 'Public Domain Mark' : r.license === 'cc0' ? 'CC0' : `CC BY ${r.license_version || ''}`.trim();
    if (!allowedLicense(lic)) continue;
    if (matchScore(query, `${r.title || ''} ${(r.tags || []).map(t => t.name).join(' ')}`) < 0.6) continue;
    try { await download(r.url, outFile); } catch { continue; }
    const { w, h } = imageSize(outFile);
    if (w < 1280 || w / h < 1.2) continue;
    used.add(`ov:${r.id}`);
    return { source: `Openverse (${r.provider || r.source})`, id: r.id, title: r.title || query,
      credit: `${r.creator || 'Unknown author'} / ${lic}`, license: lic, url: r.foreign_landing_url || r.url, width: w, height: h };
  }
  if (fs.existsSync(outFile)) fs.rmSync(outFile);
  return null;
}

// Thứ tự nguồn miễn phí cho từng loại cảnh ('ai' chạy theo lô ở fetchForVideo vì phải nạp mô hình)
const SOURCE_ORDER = {
  nasa: ['nasa', 'commons', 'ai'],
  science: ['commons', 'commons-relaxed', 'openverse', 'ai'],
  stock: ['pixabay', 'openverse', 'ai'],
};
const SOURCES = {
  nasa: (q, used, out, v) => fetchNasa(q, used, out, v.nasa_id),
  commons: (q, used, out) => fetchCommons(q, used, out),
  'commons-relaxed': (q, used, out) => fetchCommons(q, used, out, { minWidth: 900, minScore: 0.5 }),
  openverse: (q, used, out) => fetchOpenverse(q, used, out),
  pixabay: (q, used, out) => fetchPixabay(q, used, out),
};

async function fetchOne(v, used, out) {
  const order = (SOURCE_ORDER[v.type] || []).filter(k => SOURCES[k]);
  if (v.nasa_id) return fetchNasa(v.query, used, out, v.nasa_id); // ảnh đã ghim luôn thắng
  for (const k of order) {
    const info = await SOURCES[k](v.query, used, out, v);
    if (info) return info;
  }
  if (v.query.split(' ').length > 3) { // thử lại với truy vấn ngắn hơn ở nguồn chính
    const short = v.query.split(' ').slice(0, 3).join(' ');
    return SOURCES[order[0]](short, used, out, {});
  }
  return null;
}

/**
 * @param {string} dir thư mục video
 * @param {{onProgress?: (p:number, msg:string)=>void, onlyMissing?: boolean}} opts
 */
async function fetchForVideo(dir, { onProgress = () => {}, onlyMissing = true, ai = true } = {}) {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const imgDir = path.join(dir, 'images'); fs.mkdirSync(imgDir, { recursive: true });
  const credFile = path.join(dir, 'credits.json');
  const old = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : [];
  const used = new Set(old.filter(c => c.id && !c.missing).map(c => c.source === 'Pixabay' ? `pixabay:${c.id}` : String(c.source || '').startsWith('Openverse') ? `ov:${c.id}` : c.id));
  const credits = [], missing = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const v = script.scenes[i].visual || {}, n = String(i + 1).padStart(2, '0');
    const out = path.join(imgDir, `scene${n}.jpg`);
    onProgress(i / script.scenes.length, `cảnh ${i + 1}/${script.scenes.length}`);
    if (!IMAGE_TYPES.includes(v.type)) { credits.push({ scene: i + 1, type: v.type || 'none' }); continue; }
    const prev = old.find(c => c.scene === i + 1 && !c.missing && c.credit);
    if (onlyMissing && prev && fs.existsSync(out) && (!v.nasa_id || prev.id === v.nasa_id)) { credits.push(prev); continue; }
    let info = null;
    try { info = await fetchOne(v, used, out); } catch (e) { info = null; onProgress(i / script.scenes.length, `cảnh ${i + 1}: ${e.message}`); }
    if (info) credits.push({ scene: i + 1, type: v.type, query: v.query, file: `images/scene${n}.jpg`, ...info });
    else { missing.push(i + 1); credits.push({ scene: i + 1, type: v.type, query: v.query, missing: true }); }
    await sleep(300);
  }
  // Cảnh đời thường không có ảnh miễn phí hợp lệ → tranh minh hoạ AI (một lô, nạp mô hình một lần)
  const aigen = require('./aigen');
  const aiScenes = missing.filter(n => SOURCE_ORDER[script.scenes[n - 1].visual.type]?.includes('ai'));
  if (ai && aiScenes.length && aigen.available()) {
    const jobs = aiScenes.map(n => ({ scene: n, out: path.join(imgDir, `scene${String(n).padStart(2, '0')}.jpg`), prompt: aigen.buildPrompt(script.scenes[n - 1], script.channel), seed: 1000 + n }));
    const made = await aigen.generate(jobs, (p, m) => onProgress(0.5 + p / 2, m));
    for (const j of jobs.filter(x => made.includes(x.scene))) {
      const k = credits.findIndex(c => c.scene === j.scene);
      const { w, h } = imageSize(j.out);
      credits[k] = { scene: j.scene, type: script.scenes[j.scene - 1].visual.type, query: script.scenes[j.scene - 1].visual.query, file: path.relative(dir, j.out), ...aigen.creditFor(j), width: w, height: h };
      missing.splice(missing.indexOf(j.scene), 1);
    }
  }
  fs.writeFileSync(credFile, JSON.stringify(credits, null, 2) + '\n');
  onProgress(1, missing.length ? `thiếu cảnh ${missing.join(', ')}` : 'đủ ảnh');
  return { ok: missing.length === 0, missing };
}

module.exports = { fetchForVideo, fetchOne, allowedLicense, matchScore, IMAGE_TYPES, SOURCE_ORDER, ensureJpeg };
