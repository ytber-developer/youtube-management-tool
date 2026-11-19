// Giao diện từng kênh (màu, chữ thương hiệu, slide kết) — dùng chung cho slide và thumbnail.
const fs = require('fs');
const path = require('path');

const BRANDING = path.resolve(__dirname, '..', '..', 'branding');
const W = 1920, H = 1080;
const FONT = `"Avenir Next", "Helvetica Neue", "Segoe UI", Arial, sans-serif`;

const THEMES = {
  'cosmic-what-if': {
    name: 'COSMIC <b>WHAT IF?</b>', base: '#05040f', shade: '5,4,15', accent: '#ffb347', sub: '#d6d1ff', brand: '#8f86d9',
    diagramBg: 'radial-gradient(ellipse at 75% 45%, #2a1660 0%, #120a33 50%, #05040f 100%)', stars: true,
    avatar: path.join(BRANDING, 'cosmic-what-if', 'avatar.png'),
    outro: { title: 'COSMIC <b>WHAT IF?</b>', line: 'Subscribe for more mind-bending science',
      bg: 'radial-gradient(ellipse at 30% 30%, #3a1d7a 0%, #140c3a 45%, #05040f 100%)' },
  },
  'inside-your-body': {
    name: 'INSIDE <b>YOUR BODY</b>', base: '#06233d', shade: '4,28,48', accent: '#ffe08a', sub: '#e3fbff', brand: '#9fe6ef',
    diagramBg: 'radial-gradient(ellipse at 75% 45%, #0f6f8f 0%, #0a3f66 55%, #06233d 100%)', stars: false,
    avatar: path.join(BRANDING, 'inside-your-body', 'avatar.png'),
    outro: { title: 'INSIDE <b>YOUR BODY</b>', line: 'Subscribe for more of the science of you',
      bg: 'linear-gradient(135deg, #0b4f8a 0%, #0e8fa6 55%, #14c3b8 100%)' },
  },
};

const dataUri = (file) => {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
  return `data:${mime};base64,` + fs.readFileSync(file).toString('base64');
};

// Sao mờ cố định theo seed (nền cảnh sơ đồ kênh vũ trụ)
function starField(seed, w = W, h = H) {
  let s = Number(seed) * 7919 + 13; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let c = '';
  for (let i = 0; i < 160; i++) c += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${((rnd() ** 3) * 2 + 0.4).toFixed(2)}" fill="#fff" opacity="${(0.2 + rnd() * 0.5).toFixed(2)}"/>`;
  return `<svg style="position:absolute;inset:0" width="${w}" height="${h}">${c}</svg>`;
}

async function launchBrowser() {
  const puppeteer = require('puppeteer');
  // Video dài / máy bận: chụp slide có thể lâu hơn mặc định 180 s của Puppeteer
  const opts = { headless: 'shell', protocolTimeout: 600000 }; // chrome-headless-shell: ổn định hơn khi màn hình tắt/khoá
  try { return await puppeteer.launch(opts); }
  catch (e) {
    const chrome = [process.env.CHROME_EXECUTABLE, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && fs.existsSync(p));
    return puppeteer.launch({ ...opts, executablePath: chrome });
  }
}

module.exports = { THEMES, W, H, FONT, BRANDING, dataUri, starField, launchBrowser };
