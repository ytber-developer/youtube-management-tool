/**
 * Ảnh bìa dọc 1080x1920 cho Reels / YouTube Short / TikTok của page tiếng Việt.
 * Nền = images/s1.png, tiêu đề = hook lấy từ dòng "# " của file .md. Kết quả: content-vi/<ngày>/cover.png
 * Dùng: node content-tools/cover-vi.js <ngày|all>
 * Chữ nằm trong vùng an toàn (giữa), vì app che phần trên/dưới và lưới profile cắt 3:4.
 */
const fs = require('fs');
const path = require('path');
const { FONT, BRANDING, dataUri, launchBrowser } = require('./lib/theme');

const ROOT = path.resolve(__dirname, '..', 'content-vi');
const W = 1080, H = 1920;
const ACCENT = '#ffd23f';

function hookOf(dir) {
  const md = fs.readdirSync(dir).find(f => f.endsWith('.md'));
  const line = fs.readFileSync(path.join(dir, md), 'utf8').split('\n').find(l => l.startsWith('# '));
  return line.slice(2).trim();
}

function html(dir) {
  const words = hookOf(dir).toUpperCase().split(/\s+/);
  const n = words.length;
  // 2 từ cuối tô màu nhấn; chữ nhỏ dần khi hook dài
  const text = words.map((w, i) => (i >= n - 2 ? `<em>${w}</em>` : w)).join(' ');
  const size = n > 12 ? 92 : n > 8 ? 108 : 124;
  const avatar = path.join(BRANDING, 'hom-nay-moi-biet', 'avatar.png');
  return `<html><head><style>
    body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:${FONT};background:#111}
    .bg{position:absolute;inset:0;background:url(${dataUri(path.join(dir, 'images', 's1.png'))}) center/cover}
    .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,.5) 38%,rgba(0,0,0,.5) 62%,rgba(0,0,0,0) 78%,rgba(0,0,0,0) 100%)}
    main{position:absolute;left:70px;right:70px;top:50%;transform:translateY(-50%)}
    h1{text-wrap:balance;margin:0;text-align:center;color:#fff;font-weight:900;
       font-size:${size}px;line-height:1.12;text-shadow:0 6px 28px rgba(0,0,0,.85),0 0 3px #000;-webkit-text-stroke:2px rgba(0,0,0,.4)}
    h1 em{font-style:normal;color:${ACCENT}}
    .brand{margin-top:56px;display:flex;align-items:center;justify-content:center;gap:22px;color:#fff;font-weight:800;font-size:44px;text-shadow:0 2px 6px #000,0 0 18px rgba(0,0,0,.9)}
    .brand img{width:96px;height:96px;border-radius:50%;box-shadow:0 0 24px rgba(0,0,0,.6)}
  </style></head><body><div class="bg"></div><div class="shade"></div><main><h1>${text}</h1>
    <div class="brand"><img src="${dataUri(avatar)}">HÔM NAY MỚI BIẾT</div></main></body></html>`;
}

(async () => {
  const arg = process.argv[2];
  if (!arg) { console.log('Dùng: node content-tools/cover-vi.js <ngày|all>'); process.exit(1); }
  const days = arg === 'all' ? fs.readdirSync(ROOT).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [arg];
  const browser = await launchBrowser();
  try {
    for (const d of days) {
      const dir = path.join(ROOT, d);
      if (!fs.existsSync(path.join(dir, 'images', 's1.png'))) { console.log(`⏳ ${d}: chưa có images/s1.png`); continue; }
      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H });
      await page.setContent(html(dir), { waitUntil: 'load' });
      await page.screenshot({ path: path.join(dir, 'cover.png') });
      await page.close();
      console.log(`✅ ${d}  cover.png`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
