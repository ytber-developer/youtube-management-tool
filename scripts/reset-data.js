#!/usr/bin/env node
/**
 * Dọn toàn bộ dữ liệu vận hành của tool để bắt đầu lại sạch.
 *
 * Mặc định CHỈ IN KẾ HOẠCH (không đổi gì). Thêm --yes để chạy thật.
 *
 *   node scripts/reset-data.js                       # xem sẽ dọn những gì
 *   node scripts/reset-data.js --yes                 # dọn hết
 *   node scripts/reset-data.js --keep a@x.com,b@y.com --yes   # giữ lại vài account
 *
 * Không xoá thẳng: mọi thứ được CHUYỂN vào thư mục backup nằm NGOÀI thư mục tool
 * (../ytb-tool-backup-<thời gian>/). Kiểm tra xong thì tự xoá thư mục đó — nó chứa
 * mật khẩu / mã 2FA / phiên đăng nhập dạng không mã hoá.
 *
 * Trước khi chạy: TẮT tool (backend) và ĐÓNG mọi cửa sổ Chrome mà tool mở.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const ROOT = path.resolve(__dirname, '..');
const DB_FILE = path.join(ROOT, 'tool_ytb.db');
const args = process.argv.slice(2);
const APPLY = args.includes('--yes');
const keepArg = (args.find(a => a.startsWith('--keep=')) || '').slice(7) ||
  (args.includes('--keep') ? args[args.indexOf('--keep') + 1] || '' : '');
const KEEP = keepArg.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Cùng quy tắc đặt tên thư mục profile với session.service.js
const profileSlug = (email) => email.replace(/[@.+]/g, '_');
const keepSlugs = new Set(KEEP.map(profileSlug));

// Thư mục chứa dữ liệu: chuyển NỘI DUNG (giữ lại thư mục rỗng cho tool dùng tiếp)
const DATA_DIRS = ['browser-profiles', 'downloads', 'uploads', 'avatars', 'debug', 'videos-upload'];
// File dữ liệu lẻ ở thư mục gốc
const DATA_FILES = ['tool_ytb copy.db', 'fb-cookies.json', '2fa-setup-results.json', 'accounts-updated.csv'];
// Bảng dọn sạch (account_youtubes xử lý riêng để giữ lại --keep)
const WIPE_TABLES = ['uploaded_videos', 'upload_campaigns', 'watch_tasks', 'watch_campaigns', 'proxies'];

function dirSizeMB(p) {
  let total = 0;
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else { try { total += fs.statSync(full).size; } catch (err) { /* ignore */ } }
    }
  };
  if (fs.existsSync(p)) {
    if (fs.statSync(p).isDirectory()) walk(p); else total = fs.statSync(p).size;
  }
  return (total / 1024 / 1024).toFixed(1);
}

function db() {
  const conn = new sqlite3.Database(DB_FILE);
  const run = (sql, params = []) => new Promise((res, rej) => conn.run(sql, params, function (err) { err ? rej(err) : res(this.changes); }));
  const all = (sql, params = []) => new Promise((res, rej) => conn.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
  const close = () => new Promise(res => conn.close(() => res()));
  return { run, all, close };
}

async function main() {
  console.log(APPLY ? '🧹 DỌN DỮ LIỆU (chạy thật)\n' : '👀 CHẠY THỬ — chỉ in kế hoạch, không thay đổi gì (thêm --yes để chạy thật)\n');
  if (KEEP.length) console.log(`Giữ lại account: ${KEEP.join(', ')}\n`);

  // ── Kế hoạch: database ──
  let counts = {};
  if (fs.existsSync(DB_FILE)) {
    const d = db();
    for (const t of [...WIPE_TABLES, 'account_youtubes']) {
      try { counts[t] = (await d.all(`SELECT COUNT(*) AS n FROM ${t}`))[0].n; } catch (e) { counts[t] = null; }
    }
    const kept = KEEP.length
      ? (await d.all(`SELECT email FROM account_youtubes WHERE lower(email) IN (${KEEP.map(() => '?').join(',')})`, KEEP)).map(r => r.email)
      : [];
    await d.close();
    console.log('Database tool_ytb.db:');
    for (const t of WIPE_TABLES) if (counts[t] !== null) console.log(`  - ${t}: xoá ${counts[t]} dòng`);
    if (counts.account_youtubes !== null) {
      console.log(`  - account_youtubes: xoá ${counts.account_youtubes - kept.length} account, giữ ${kept.length}${kept.length ? ` (${kept.join(', ')})` : ''}`);
    }
    const missing = KEEP.filter(k => !kept.map(e => e.toLowerCase()).includes(k));
    if (missing.length) console.log(`  ℹ️  Account cần giữ chưa có trong DB (sẽ import sau): ${missing.join(', ')}`);
  } else {
    console.log('Database: không tìm thấy tool_ytb.db (bỏ qua)');
  }

  // ── Kế hoạch: thư mục / file ──
  console.log('\nFile & thư mục (chuyển vào backup):');
  const moves = [];
  for (const dir of DATA_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (dir === 'browser-profiles' && keepSlugs.has(name)) continue;
      if (name === '.gitkeep') continue;
      moves.push({ from: path.join(full, name), rel: path.join(dir, name) });
    }
    console.log(`  - ${dir}/: ${fs.readdirSync(full).length} mục, ${dirSizeMB(full)} MB`);
  }
  for (const f of DATA_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) { moves.push({ from: full, rel: f }); console.log(`  - ${f}`); }
  }

  if (!APPLY) {
    console.log('\n→ Chưa thay đổi gì. Tắt tool + đóng Chrome của tool, rồi chạy lại kèm --yes.');
    return;
  }

  // ── Chạy thật ──
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const backupDir = path.resolve(ROOT, '..', `ytb-tool-backup-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`\n📦 Backup: ${backupDir}`);

  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, path.join(backupDir, 'tool_ytb.db'));
    const d = db();
    for (const t of WIPE_TABLES) {
      if (counts[t] === null) continue;
      const n = await d.run(`DELETE FROM ${t}`);
      console.log(`  ✅ ${t}: đã xoá ${n} dòng`);
    }
    if (counts.account_youtubes !== null) {
      const n = KEEP.length
        ? await d.run(`DELETE FROM account_youtubes WHERE lower(email) NOT IN (${KEEP.map(() => '?').join(',')})`, KEEP)
        : await d.run('DELETE FROM account_youtubes');
      try { await d.run('UPDATE account_youtubes SET proxy_id = NULL'); } catch (e) { /* cột chưa có */ }
      console.log(`  ✅ account_youtubes: đã xoá ${n} account`);
    }
    await d.run('VACUUM'); // ghi đè vùng trống để dữ liệu đã xoá không còn nằm trong file
    await d.close();
  }

  let failed = 0;
  for (const m of moves) {
    const dest = path.join(backupDir, m.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.renameSync(m.from, dest);
    } catch (e) {
      if (e.code === 'EXDEV') { // khác ổ đĩa → copy rồi xoá
        try { fs.cpSync(m.from, dest, { recursive: true }); fs.rmSync(m.from, { recursive: true, force: true }); continue; } catch (e2) { e = e2; }
      }
      failed++;
      console.warn(`  ⚠️  Không chuyển được ${m.rel}: ${e.code || e.message}${e.code === 'EBUSY' || e.code === 'EPERM' ? ' (Chrome/tool còn đang mở?)' : ''}`);
    }
  }
  console.log(`  ✅ Đã chuyển ${moves.length - failed}/${moves.length} file/thư mục vào backup`);
  if (failed) console.log('  → Đóng Chrome/tool rồi chạy lại lệnh để chuyển nốt.');
  console.log(`\nXong. Kiểm tra tool chạy ổn rồi XOÁ thư mục backup (chứa dữ liệu nhạy cảm):\n  ${backupDir}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
