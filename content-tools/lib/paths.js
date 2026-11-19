// Vị trí thư mục content/ và kiểm tra id video (<YYYY-MM-DD>/<channel>__<NN>-<slug>).
const fs = require('fs');
const path = require('path');

const CONTENT_ROOT = process.env.CONTENT_ROOT || path.resolve(__dirname, '..', '..', 'content');
const CHANNELS = ['cosmic-what-if', 'inside-your-body'];
const ID_RE = /^\d{4}-\d{2}-\d{2}\/(cosmic-what-if|inside-your-body)__\d{2}-[a-z0-9-]+$/;

function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

function resolveVideoDir(id) {
  if (!isValidId(id)) return null;
  const dir = path.join(CONTENT_ROOT, id);
  if (!dir.startsWith(CONTENT_ROOT + path.sep)) return null;
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

function listVideoIds() {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  const ids = [];
  for (const date of fs.readdirSync(CONTENT_ROOT).sort()) {
    const dateDir = path.join(CONTENT_ROOT, date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fs.statSync(dateDir).isDirectory()) continue;
    for (const folder of fs.readdirSync(dateDir).sort()) {
      const id = `${date}/${folder}`;
      if (isValidId(id) && fs.statSync(path.join(dateDir, folder)).isDirectory()) ids.push(id);
    }
  }
  return ids;
}

/** Tách id → { date, channel, number, slug } */
function parseId(id) {
  const [date, folder] = id.split('/');
  const [channel, rest] = folder.split('__');
  return { date, channel, number: parseInt(rest.slice(0, 2), 10), slug: rest.slice(3) };
}

module.exports = { CONTENT_ROOT, CHANNELS, isValidId, resolveVideoDir, listVideoIds, parseId };
