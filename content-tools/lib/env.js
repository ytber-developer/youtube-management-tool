// Nạp API key (PIXABAY_API_KEY, ELEVENLABS_API_KEY…) từ .env của repo, dự phòng ../ytb-content/.env.
// Không ghi đè biến đã có trong môi trường. Không bao giờ in giá trị key.
const fs = require('fs');
const path = require('path');

let loaded = false;
function load() {
  if (loaded) return;
  loaded = true;
  const files = [path.resolve(__dirname, '..', '..', '.env'), path.resolve(__dirname, '..', '..', '..', 'ytb-content', '.env')];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

module.exports = { load };
