#!/usr/bin/env node
// Chép video từ ../ytb-content/<channel>/<NN-slug>/ sang content/<ngày>/<channel>__<NN-slug>/ và ghi content/schedule.json.
// Chỉ CHÉP (bản gốc giữ làm backup), chép lại file nào mới hơn → chạy lại bao nhiêu lần cũng được.
const fs = require('fs');
const path = require('path');
const { CONTENT_ROOT, CHANNELS } = require('./lib/paths');
const schedule = require('./lib/schedule');

const SRC = process.argv[2] || path.resolve(__dirname, '..', '..', 'ytb-content');

function copyNewer(from, to) {
  if (!fs.existsSync(from)) return 0;
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    let n = 0;
    for (const f of fs.readdirSync(from)) n += copyNewer(path.join(from, f), path.join(to, f));
    return n;
  }
  if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= st.mtimeMs - 2) return 0; // sai số 2ms do utimes làm tròn
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  fs.utimesSync(to, st.atime, st.mtime);
  return 1;
}

const videos = [];
let copied = 0;
for (const channel of CHANNELS) {
  const chDir = path.join(SRC, channel);
  if (!fs.existsSync(chDir)) continue;
  for (const folder of fs.readdirSync(chDir).sort()) {
    const m = folder.match(/^(\d{2})-([a-z0-9-]+)$/);
    const srcDir = path.join(chDir, folder);
    if (!m || !fs.existsSync(path.join(srcDir, 'script.json'))) continue;
    const script = JSON.parse(fs.readFileSync(path.join(srcDir, 'script.json'), 'utf8'));
    const v = { channel, number: parseInt(m[1], 10), slug: m[2], title: script.title };
    const dest = path.join(CONTENT_ROOT, schedule.dateFor(v.number), schedule.folderName(v));
    for (const item of ['script.json', 'credits.json', 'images', 'slides']) copied += copyNewer(path.join(srcDir, item), path.join(dest, item));
    videos.push(v);
  }
}
fs.mkdirSync(CONTENT_ROOT, { recursive: true });
const sched = schedule.build(videos);
fs.writeFileSync(path.join(CONTENT_ROOT, 'schedule.json'), JSON.stringify(sched, null, 2) + '\n');
console.log(`✅ ${videos.length} video, ${sched.length} ngày, chép ${copied} file mới → ${CONTENT_ROOT}`);
