/**
 * Chọn ảnh thật tự động bằng CLIP (Xenova/clip-vit-base-patch32, chạy trên máy qua @huggingface/transformers).
 * Lấy ~20–40 ảnh ứng viên đúng giấy phép, chấm độ khớp giữa ảnh thu nhỏ và nội dung cảnh, tải bản đầy đủ của ảnh
 * khớp nhất. Không ảnh nào đạt MIN_SCORE → để nguồn sau (minh hoạ emoji) lo. Tắt bằng CLIP=0.
 * Mô hình (~90 MB bản q8) tải về một lần, lưu trong cache của transformers.js.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const candidates = require('./candidates');

const MODEL = 'Xenova/clip-vit-base-patch32';
// Hiệu chỉnh trên ảnh thật: đúng chủ đề ~0.30, trang lạc đề ~0.24, không liên quan ~0.13
const MIN_SCORE = 0.26;

// "Điều cần tránh": ảnh giống mấy mô tả này hơn giống cảnh thì loại. CLIP đọc được chữ trong ảnh nên poster/bìa/hộp game
// có đúng từ khoá dễ được điểm cao giả; kênh sức khoẻ không dùng ảnh hút thuốc, rượu…
const AVOID_ALWAYS = ['a person smoking a cigarette', 'vaping smoke', 'glasses of alcohol', 'a gun or weapon', 'nudity', 'blood and gore',
  'a poster with large text', 'a book cover', 'a board game box', 'a company logo', 'a screenshot of a website', 'a meme with text'];
const AVOID_NON_SCIENCE = ['a chart with numbers and a color scale', 'a page of printed text'];
function negativesFor(type, query = '') {
  const base = type === 'science' ? AVOID_ALWAYS : [...AVOID_ALWAYS, ...AVOID_NON_SCIENCE];
  const kw = require('./illustrate').keywords(query).slice(0, 2).join(' ');
  // Chống "đọc chữ": ảnh chỉ in từ khoá (bìa, hộp, biển hiệu) thường giống câu này hơn giống cảnh thật
  return kw ? [...base, `the words "${kw}" written in large letters`] : base;
}

// Nguồn ứng viên cho từng loại cảnh
const POOLS = { nasa: ['nasa', 'commons'], science: ['commons', 'openverse'], stock: ['openverse', 'commons'] };

// Kho ảnh tìm theo từ khoá: truy vấn dài hay trả về rỗng → thêm biến thể 2 từ khoá và 1 từ khoá chính
function queryVariants(query = '') {
  const kw = require('./illustrate').keywords(query);
  return [...new Set([query.trim(), kw.slice(0, 2).join(' '), kw[0]].filter(Boolean))];
}

function clipText(visual = {}) {
  return [visual.query, visual.note].filter(Boolean).join('. ').split(/\s+/).slice(0, 35).join(' ');
}

/** Ảnh dọc hoặc nhỏ bị trừ điểm nhẹ (slide 16:9); kích thước 0 = không rõ, không trừ. */
function chooseBest(cands, min = MIN_SCORE) {
  let best = null, bestAdj = -Infinity;
  for (const c of cands) {
    if (!(c.score >= min)) continue;
    if (c.neg != null && c.neg >= c.score) continue; // giống "điều cần tránh" hơn giống cảnh
    let adj = c.score;
    if (c.w && c.h && c.w / c.h < 1.2) adj -= 0.02;
    if (c.w && c.w < 1000) adj -= 0.02;
    if (adj > bestAdj) { best = c; bestAdj = adj; }
  }
  return best;
}

const enabled = () => process.env.CLIP !== '0';
function available() {
  try { require.resolve('@huggingface/transformers'); return true; } catch { return false; }
}

let modelP = null;
function loadModel() {
  if (!modelP) {
    modelP = (async () => {
      const T = await import('@huggingface/transformers');
      const [tok, text, proc, vision] = await Promise.all([
        T.AutoTokenizer.from_pretrained(MODEL),
        T.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' }),
        T.AutoProcessor.from_pretrained(MODEL),
        T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' }),
      ]);
      return { T, tok, text, proc, vision };
    })();
  }
  return modelP;
}

const unit = (arr) => { const n = Math.hypot(...arr) || 1; return arr.map(x => x / n); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

const embedText = async (m, texts) => {
  const { text_embeds } = await m.text(m.tok(texts, { padding: true, truncation: true }));
  const d = text_embeds.dims[1];
  return texts.map((_, i) => unit(Array.from(text_embeds.data.slice(i * d, (i + 1) * d))));
};

/** Gắn c.score (cosine ảnh–cảnh) và c.neg (cosine lớn nhất với "điều cần tránh"); ảnh tải lỗi → score 0. */
async function score(text, cands, type = 'stock', query = text) {
  const m = await loadModel();
  const [q, ...negs] = await embedText(m, [text, ...negativesFor(type, query)]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-'));
  try {
    // Tải ảnh thu nhỏ song song (8 luồng), chấm điểm tuần tự
    const files = new Array(cands.length).fill(null);
    let next = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < cands.length) {
        const i = next++;
        const c = cands[i];
        if (!c.thumb) continue;
        try {
          const r = await fetch(c.thumb, { headers: { 'User-Agent': candidates.UA }, signal: AbortSignal.timeout(20000) });
          if (!r.ok) continue;
          files[i] = path.join(tmp, `${i}.img`);
          fs.writeFileSync(files[i], Buffer.from(await r.arrayBuffer()));
        } catch { files[i] = null; }
      }
    }));
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      c.score = 0;
      if (!files[i]) continue;
      try {
        const { image_embeds } = await m.vision(await m.proc(await m.T.RawImage.read(files[i])));
        const v = unit(Array.from(image_embeds.data));
        c.score = dot(q, v);
        c.neg = Math.max(...negs.map(n => dot(n, v)));
      } catch { /* ảnh hỏng → bỏ qua */ }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return cands;
}

/**
 * Chọn và tải ảnh cho một cảnh. fetchPinned(pin, out) do images.js cung cấp (vẫn kiểm tra giấy phép khi tải).
 * → info (kèm clipScore) hoặc null.
 */
async function pick(visual, used, out, fetchPinned) {
  const text = clipText(visual);
  const pool = [], seen = new Set();
  for (const src of POOLS[visual.type] || []) {
    for (const q of queryVariants(visual.query)) {
      if (pool.length >= 45) break;
      try {
        for (const c of (await candidates[src](q)).slice(0, 15)) {
          if (!seen.has(c.pin.value)) { seen.add(c.pin.value); pool.push(c); }
        }
      } catch { /* nguồn lỗi (vd Openverse 403 do giới hạn lượt) → bỏ */ }
      await new Promise(r => setTimeout(r, 400)); // nhẹ tay với API công cộng
    }
  }
  const fresh = pool.filter(c => !used.has(c.pin.value) && !used.has(`ov:${c.pin.value}`));
  if (!fresh.length) return null;
  await score(text, fresh, visual.type, visual.query);
  const ranked = fresh.filter(c => c.score >= MIN_SCORE && !(c.neg >= c.score)).sort((a, b) => b.score - a.score);
  // Ảnh tốt nhất tải lỗi (giấy phép đổi, file mất) → thử ảnh kế tiếp
  for (let tries = 0; tries < 3 && ranked.length; tries++) {
    const best = chooseBest(ranked);
    if (!best) break;
    try {
      const info = await fetchPinned(best.pin, out);
      if (info) return { ...info, clipScore: Number(best.score.toFixed(3)) };
    } catch { /* thử ảnh khác */ }
    ranked.splice(ranked.indexOf(best), 1);
  }
  return null;
}

module.exports = { MIN_SCORE, chooseBest, clipText, queryVariants, negativesFor, enabled, available, score, pick };
