#!/usr/bin/env node
/**
 * Tìm ảnh ứng viên (chỉ giấy phép được phép) để chọn tay rồi ghim vào script.json.
 *   npm run content:search -- "goosebumps arm" [--source openverse|commons|nasa|all] [--sheet out.jpg]
 * In: số thứ tự, nguồn, kích thước, giấy phép, tiêu đề, và dòng ghim cần dán vào visual.
 * --sheet: ghép ảnh thu nhỏ có đánh số thành 1 file để xem nhanh.
 */
const fs = require('fs');
const path = require('path');
require('./lib/env').load();

const { openverse, commons, nasa, pinLine, UA } = require('./lib/candidates');

async function sheet(cands, out) {
  const { launchBrowser } = require('./lib/theme');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const cols = 5, cw = 320, ch = 200;
    await page.setViewport({ width: cols * cw, height: Math.ceil(cands.length / cols) * (ch + 24) });
    // Tải ảnh thu nhỏ bằng Node (có User-Agent) rồi nhúng data URI — trình duyệt headless hay bị chặn
    const srcs = await Promise.all(cands.map(async c => {
      try {
        const r = await fetch(c.thumb, { headers: { 'User-Agent': UA } });
        if (!r.ok) return '';
        return `data:${r.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
      } catch { return ''; }
    }));
    const cells = cands.map((c, i) => `<div style="width:${cw}px;height:${ch + 24}px;position:relative;overflow:hidden;background:#222">
      <img src="${srcs[i]}" style="width:${cw}px;height:${ch}px;object-fit:cover">
      <div style="position:absolute;left:0;top:0;background:#ff0;color:#000;font:bold 22px sans-serif;padding:2px 8px">${i + 1}</div>
      <div style="color:#fff;font:12px sans-serif;padding:3px 6px;white-space:nowrap;overflow:hidden">${c.source} · ${c.w || '?'}×${c.h || '?'}</div></div>`).join('');
    await page.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;width:${cols * cw}px">${cells}</body>`, { waitUntil: 'load', timeout: 60000 });
    await page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
  } finally { await browser.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
  const src = opt('--source', 'all');
  const out = opt('--sheet', null);
  const q = args.join(' ').trim();
  if (!q) { console.error('Dùng: npm run content:search -- "<từ khoá>" [--source openverse|commons|nasa|all] [--sheet out.jpg]'); process.exit(2); }
  const fns = { openverse, commons, nasa };
  const list = [];
  for (const k of src === 'all' ? Object.keys(fns) : [src]) {
    try { list.push(...(await fns[k](q)).slice(0, src === 'all' ? 8 : 20)); } catch (e) { console.error(`⚠️  ${k}: ${e.message}`); }
  }
  list.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. ${c.source.padEnd(9)} ${String(c.w || '?').padStart(5)}×${String(c.h || '?').padEnd(5)} ${c.lic.padEnd(18)} ${c.title.slice(0, 60)}  →  ${pinLine(c)}`));
  if (out && list.length) { await sheet(list, path.resolve(out)); console.log(`🖼  ${out}`); }
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
