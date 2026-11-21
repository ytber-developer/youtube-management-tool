/**
 * Quản lý bài đăng của page Facebook "Hôm Nay Mới Biết" (trang /fb-page).
 * Nguồn dữ liệu là file trên đĩa trong content-vi/ (không dùng DB):
 *   - calendar.md          bảng lịch 30 ngày (ngày, mảng, hook, định dạng) → các bài "chưa viết"
 *   - <date>/<slug>.md     bài đã viết (fb-script-writer): kịch bản, caption, hashtag, nguồn
 *   - <date>/reel.json     lời đọc + cảnh của video; <date>/reel.mp4 là video đã dựng (bài ảnh: <date>/photo/reel.json + reel.mp4)
 *   - posts.json           trạng thái người dùng tự đánh dấu: đã kiểm chứng, đã đăng (link/giờ), ghi chú
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'content-vi');
const STATE_FILE = path.join(ROOT, 'posts.json');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const isValidId = (id) => {
  const [date, slug, extra] = String(id).split('/');
  return !extra && DATE_RE.test(date || '') && SLUG_RE.test(slug || '');
};
const mdPath = (id) => path.join(ROOT, `${id}.md`);

const formatKey = (s) => (/ảnh|anh|photo/i.test(s) ? 'photo' : 'reels');

/** Bảng trong calendar.md → [{ date, area, hook, format, answer }] */
function parseCalendar() {
  const text = readText(path.join(ROOT, 'calendar.md'));
  const year = (text.match(/\d{2}\/\d{2}\/(\d{4})/) || [])[1] || String(new Date().getFullYear());
  const rows = [];
  for (const line of text.split('\n')) {
    const c = line.split('|').map(s => s.trim());
    const m = /^(\d{2})\/(\d{2})\b/.exec(c[1] || '');
    if (!m || c.length < 6) continue;
    rows.push({ date: `${year}-${m[2]}-${m[1]}`, area: c[2], hook: c[3], format: formatKey(c[4]), answer: c[5] });
  }
  return rows;
}

/** Tách markdown bài viết thành các trường + các mục "## ..." */
function parsePost(id) {
  const text = readText(mdPath(id));
  if (!text) return null;
  const sections = {};
  let cur = null;
  const head = [];
  for (const line of text.split('\n')) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) { cur = h[1].trim(); sections[cur] = []; } else if (cur) sections[cur].push(line); else head.push(line);
  }
  const sec = (name) => (sections[name] || []).join('\n').trim();
  const meta = (key) => (head.map(l => new RegExp(`^-\\s*${key}:\\s*(.+)$`).exec(l)).find(Boolean) || [])[1] || '';
  const hashtags = sec('Hashtag').split(/\s+/).filter(t => t.startsWith('#'));
  const script = sec('Kịch bản');
  const narration = (script.match(/Lời đọc liền mạch:\s*\n"?([^\n]+?)"?\s*(?:\n|$)/) || [])[1] || '';
  return {
    title: (head.find(l => l.startsWith('# ')) || '').replace(/^#\s+/, '') || id,
    area: meta('Mảng'), format: formatKey(meta('Định dạng')), hook: meta('Hook'),
    script, narration, caption: sec('Caption'), hashtags, sources: sec('Nguồn thông tin'), imageSources: sec('Nguồn ảnh'),
  };
}

const loadState = () => readJson(STATE_FILE, {});
function saveState(state) {
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

/** File video của bài: <slug>.mp4, hoặc reel.mp4 nếu đó là bài Reels duy nhất của ngày */
function videoFile(id, format) {
  const [date, slug] = id.split('/');
  const own = path.join(ROOT, date, `${slug}.mp4`);
  if (fs.existsSync(own)) return own;
  // Bài ảnh dựng thành video ngắn riêng trong <date>/photo/reel.mp4 (không đụng reel.mp4 của Reels cùng ngày)
  if (format === 'photo') {
    const ph = path.join(ROOT, date, 'photo', 'reel.mp4');
    return fs.existsSync(ph) ? ph : null;
  }
  if (format !== 'reels') return null;
  const shared = path.join(ROOT, date, 'reel.mp4');
  const reelsInDay = fs.readdirSync(path.join(ROOT, date)).filter(f => f.endsWith('.md') && formatKey(readText(path.join(ROOT, date, f)).match(/^-\s*Định dạng:\s*(.+)$/m)?.[1] || '') === 'reels');
  return fs.existsSync(shared) && reelsInDay.length <= 1 ? shared : null;
}

function stageOf({ written, factChecked, hasVideo, format, posted }) {
  if (posted) return 'posted';
  if (!written) return 'planned';
  if (factChecked && hasVideo) return 'ready';
  return factChecked ? 'checked' : 'written';
}

function summarize(id, p, cal, state) {
  const st = state[id] || {};
  const vf = videoFile(id, p.format);
  const posted = st.postedUrl || st.postedAt ? { url: st.postedUrl || null, at: st.postedAt || null } : null;
  return {
    id, date: id.split('/')[0], title: p.title, area: p.area || cal?.area || '', format: p.format, hook: p.hook || cal?.hook || '',
    hashtags: p.hashtags, factChecked: !!st.factChecked, note: st.note || '', posted,
    video: vf ? { mtime: Math.round(fs.statSync(vf).mtimeMs), size: fs.statSync(vf).size } : null,
    stage: stageOf({ written: true, factChecked: !!st.factChecked, hasVideo: !!vf, format: p.format, posted }),
  };
}

/** Lịch + bài đã viết, gộp theo (ngày, định dạng). Bài ngoài lịch vẫn được liệt kê. */
function list() {
  const state = loadState();
  const cal = parseCalendar();
  const posts = [];
  if (fs.existsSync(ROOT)) {
    for (const date of fs.readdirSync(ROOT).filter(d => DATE_RE.test(d)).sort()) {
      for (const f of fs.readdirSync(path.join(ROOT, date)).filter(f => f.endsWith('.md')).sort()) {
        const id = `${date}/${f.slice(0, -3)}`;
        if (isValidId(id)) { const p = parsePost(id); if (p) posts.push({ id, p }); }
      }
    }
  }
  const used = new Set();
  const out = cal.map((row) => {
    const hit = posts.find(x => !used.has(x.id) && x.id.startsWith(row.date) && x.p.format === row.format);
    if (hit) { used.add(hit.id); return summarize(hit.id, hit.p, row, state); }
    return { id: null, date: row.date, title: row.hook, area: row.area, format: row.format, hook: row.hook, hashtags: [], factChecked: false, note: '', posted: null, video: null, stage: 'planned', answer: row.answer };
  });
  posts.filter(x => !used.has(x.id)).forEach(x => out.push(summarize(x.id, x.p, null, state)));
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.format === 'reels' ? -1 : 1) - (b.format === 'reels' ? -1 : 1));
}

function detail(id) {
  const p = parsePost(id);
  if (!p) return null;
  const state = loadState();
  const cal = parseCalendar().find(r => id.startsWith(r.date) && r.format === p.format);
  const reel = readJson(path.join(ROOT, id.split('/')[0], 'reel.json'), null);
  return { ...summarize(id, p, cal, state), script: p.script, narration: p.narration || (reel?.scenes || []).map(s => s.narration).join(' '),
    caption: p.caption, sources: p.sources, imageSources: p.imageSources, answer: cal?.answer || '' };
}

/** Cập nhật trạng thái người dùng tự đánh dấu. patch: { factChecked?, postedUrl?, postedAt?, note? } (null/'' = xoá) */
function update(id, patch) {
  if (!isValidId(id) || !fs.existsSync(mdPath(id))) throw new Error('Không tìm thấy bài');
  const state = loadState();
  const cur = { ...(state[id] || {}) };
  if ('factChecked' in patch) cur.factChecked = !!patch.factChecked;
  if ('postedUrl' in patch) {
    const u = String(patch.postedUrl || '').trim();
    if (u && !/^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.watch)\//i.test(u)) throw new Error('Link phải là link Facebook (https://…facebook.com/…)');
    if (u) cur.postedUrl = u; else delete cur.postedUrl;
  }
  if ('postedAt' in patch) {
    if (patch.postedAt && Number.isNaN(Date.parse(patch.postedAt))) throw new Error('Giờ đăng không hợp lệ');
    if (patch.postedAt) cur.postedAt = new Date(patch.postedAt).toISOString(); else delete cur.postedAt;
  }
  if ('note' in patch) { const n = String(patch.note || '').slice(0, 1000); if (n) cur.note = n; else delete cur.note; }
  if (Object.keys(cur).length) state[id] = cur; else delete state[id];
  saveState(state);
  return detail(id);
}

const filePath = (id) => (isValidId(id) && fs.existsSync(mdPath(id)) ? videoFile(id, parsePost(id)?.format) : null);

module.exports = { isValidId, list, detail, update, filePath };
