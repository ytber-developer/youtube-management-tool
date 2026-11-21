#!/usr/bin/env node
/**
 * npm run content -- <lệnh> <đích>
 *   đích: id video (2026-11-25/cosmic-what-if__03-...), ngày (2026-11-25), hoặc "all"
 *   lệnh: check (các lệnh khác được đăng ký thêm ở COMMANDS)
 */
const fs = require('fs');
const path = require('path');
const paths = require('./lib/paths');

function resolveTargets(target) {
  const all = paths.listVideoIds();
  if (!target || target === 'all') return all;
  if (/^\d{4}-\d{2}-\d{2}$/.test(target)) return all.filter(id => id.startsWith(target + '/'));
  if (paths.isValidId(target)) return all.includes(target) ? [target] : [];
  // cho phép gõ tắt phần thư mục, vd "cosmic-what-if__01" hoặc "inside-your-body__07"
  return all.filter(id => id.split('/')[1].startsWith(target));
}

const readScript = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));

const COMMANDS = {
  async check(id, dir) {
    const r = require('./lib/check').validateScript(readScript(dir));
    console.log(`${r.ok ? '✅' : '❌'} ${id}  ${r.words}/${r.target} từ${r.warnings.length ? `  ⚠️ ${r.warnings.length} cảnh báo` : ''}`);
    for (const e of r.errors) console.log(`     ❌ ${e}`);
    if (process.env.VERBOSE) for (const w of r.warnings) console.log(`     ⚠️ ${w}`);
    return r.ok;
  },
  async images(id, dir) {
    const r = await require('./lib/images').fetchForVideo(dir, { onlyMissing: !process.env.REFETCH });
    console.log(`${r.ok ? '✅' : '⚠️ '} ${id}  ${r.ok ? 'đủ ảnh' : `thiếu cảnh ${r.missing.join(', ')}`}`);
    return true; // thiếu ảnh không phải lỗi lệnh — xem trên trang /content
  },
  async slides(id, dir) {
    const r = await require('./lib/slides').renderVideo(dir);
    console.log(`✅ ${id}  ${r.count} slide${r.todo.length ? `  ⚠️ TODO cảnh ${r.todo.join(', ')}` : ''}`);
    return true;
  },
  async package(id, dir) {
    require('./lib/pack').writeAll(dir);
    console.log(`✅ ${id}  narration.txt + metadata.md`);
    return true;
  },
  async preview(id, dir) {
    const r = await require('./lib/video').renderPreview(dir);
    if (r.skipped) { console.log(`⏭️  ${id}  video hoạt hình — không có preview`); return true; }
    console.log(`✅ ${id}  preview.mp4 ${r.duration.toFixed(1)}s`);
    return true;
  },
  async render(id, dir) {
    if (!fs.existsSync(path.join(dir, 'voice.mp3'))) { console.log(`⏭️  ${id}  chưa có voice.mp3`); return true; }
    const r = await require('./lib/video').renderFinal(dir);
    console.log(`✅ ${id}  final.mp4 ${r.duration.toFixed(1)}s + captions.srt`);
    return true;
  },
  // Giọng Kokoro offline → voice.mp3 → final.mp4. VOICE=am_fenrir / SPEED=0.95 để thử giọng khác.
  // Không ghi đè giọng đã có (ví dụ giọng ElevenLabs thả tay) trừ khi REVOICE=1.
  async voice(id, dir) {
    if (fs.existsSync(path.join(dir, 'voice.mp3')) && !process.env.REVOICE) { console.log(`⏭️  ${id}  đã có voice.mp3 (REVOICE=1 để tạo lại)`); return true; }
    const t = Date.now();
    const r = await require('./lib/tts').synthesize(dir, { voice: process.env.VOICE, speed: process.env.SPEED ? +process.env.SPEED : undefined });
    console.log(`🎙️  ${id}  voice.mp3 (${r.voice}, ${((Date.now() - t) / 1000).toFixed(0)}s)`);
    return COMMANDS.render(id, dir);
  },
  // Làm hết mọi bước còn thiếu: ảnh (AI dự phòng) → slide → thumb → package → preview → giọng → video cuối
  async build(id, dir) {
    const t = Date.now();
    let last = '';
    const plan = await require('./lib/build').buildVideo(dir, {
      onProgress: (_, m) => { const step = m.split(':')[0]; if (step !== last) { last = step; process.stdout.write(`   … ${id.slice(11)}  ${step}\n`); } },
    });
    console.log(`✅ ${id}  ${plan.length ? plan.join(' → ') : 'đã đủ'} (${((Date.now() - t) / 60000).toFixed(1)} phút)`);
    return true;
  },
  // Đánh dấu đã đăng: npm run content -- uploaded <id> <link YouTube>   (link "-" để bỏ đánh dấu)
  async uploaded(id, dir) {
    const url = process.argv[4];
    if (!url) { console.error('Cần link: npm run content -- uploaded <id> https://youtu.be/…'); return false; }
    try { require('./lib/uploaded').markUploaded(dir, url); }
    catch (e) { console.error(`❌ ${e.message}`); return false; }
    console.log(`✅ ${id}  ${url === '-' ? 'bỏ đánh dấu đã đăng' : `đã đăng: ${url}`}`);
    return true;
  },
  async thumb(id, dir) {
    console.log(`✅ ${id}  ${path.relative(process.cwd(), await require('./lib/thumb').render(dir))}`);
    return true;
  },
};

async function main() {
  const [cmd, target] = process.argv.slice(2);
  if (!COMMANDS[cmd]) {
    console.error(`Lệnh: ${Object.keys(COMMANDS).join(' | ')}\nVí dụ: npm run content -- check all`);
    process.exit(2);
  }
  const ids = resolveTargets(target);
  if (!ids.length) { console.error(`Không tìm thấy video cho "${target}"`); process.exit(2); }
  if (cmd === 'uploaded' && ids.length > 1) { console.error(`"uploaded" chỉ nhận một video, "${target}" khớp ${ids.length}`); process.exit(2); }
  let failed = 0;
  for (const id of ids) {
    try { if ((await COMMANDS[cmd](id, paths.resolveVideoDir(id))) === false) failed++; }
    catch (e) { failed++; console.error(`❌ ${id}: ${e.message}`); }
  }
  if (ids.length > 1) console.log(`\n${ids.length - failed}/${ids.length} OK`);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { resolveTargets, COMMANDS };
