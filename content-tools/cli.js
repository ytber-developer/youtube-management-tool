#!/usr/bin/env node
/**
 * npm run content -- <lệnh> <đích>
 *   đích: id video (2026-11-23/cosmic-what-if__01-...), ngày (2026-11-23), hoặc "all"
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
};

async function main() {
  const [cmd, target] = process.argv.slice(2);
  if (!COMMANDS[cmd]) {
    console.error(`Lệnh: ${Object.keys(COMMANDS).join(' | ')}\nVí dụ: npm run content -- check all`);
    process.exit(2);
  }
  const ids = resolveTargets(target);
  if (!ids.length) { console.error(`Không tìm thấy video cho "${target}"`); process.exit(2); }
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
