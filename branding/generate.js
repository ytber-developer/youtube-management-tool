#!/usr/bin/env node
/**
 * Tạo avatar + ảnh bìa (banner) YouTube cho 2 kênh.
 *   node branding/generate.js
 * Kết quả: branding/<kênh>/avatar.png (800x800), banner.png (2560x1440)
 *
 * Banner: chữ/logo nằm trong vùng an toàn 1546x423 ở giữa (hiện đủ trên mọi thiết bị).
 * Sửa màu / chữ trong CHANNELS bên dưới rồi chạy lại.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FONT = `"Avenir Next", "Helvetica Neue", "Segoe UI", Arial, sans-serif`;

// Sao ngẫu nhiên nhưng cố định (seed) để mỗi lần chạy ra cùng một ảnh
function stars(n, w, h, seed, maxR = 2.2) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = (rnd() ** 3) * maxR + 0.4;
    out += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.35 + rnd() * 0.65).toFixed(2)}"/>`;
  }
  return out;
}

// ─── Kênh 1: Cosmic What If ───────────────────────────────────────────────────
const blackHole = (cx, cy, R, id) => `
  <defs>
    <radialGradient id="${id}glow" cx="50%" cy="50%" r="50%">
      <stop offset="45%" stop-color="#ff9a3c" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="#ff5e3a" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ff5e3a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}disk" x1="0" x2="1">
      <stop offset="0%" stop-color="#ff5e3a"/>
      <stop offset="35%" stop-color="#ffd27a"/>
      <stop offset="50%" stop-color="#fff4d6"/>
      <stop offset="65%" stop-color="#ffd27a"/>
      <stop offset="100%" stop-color="#ff5e3a"/>
    </linearGradient>
    <filter id="${id}blur"><feGaussianBlur stdDeviation="${R * 0.05}"/></filter>
    <!-- vòng elip vẽ liền phía sau, rồi vẽ đè nửa trước lên hố đen → không có đầu nét bị cụt -->
    <clipPath id="${id}front"><rect x="${cx - R * 3}" y="${cy}" width="${R * 6}" height="${R * 3}"/></clipPath>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${R * 2.1}" fill="url(#${id}glow)"/>
  <!-- nửa sau của đĩa bồi tụ (bị bẻ cong phía trên hố đen) -->
  <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.95}" ry="${R * 0.42}" fill="none" stroke="url(#${id}disk)" stroke-width="${R * 0.2}" filter="url(#${id}blur)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.95}" ry="${R * 0.42}" fill="none" stroke="#fff6e0" stroke-width="${R * 0.05}" opacity="0.85"/>
  <path d="M ${cx - R * 1.05} ${cy} A ${R * 1.05} ${R * 1.05} 0 0 1 ${cx + R * 1.05} ${cy}" fill="none" stroke="url(#${id}disk)" stroke-width="${R * 0.13}" stroke-linecap="round" filter="url(#${id}blur)"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="#000"/>
  <circle cx="${cx}" cy="${cy}" r="${R * 1.01}" fill="none" stroke="#ffe3a8" stroke-width="${R * 0.025}" opacity="0.9"/>
  <!-- nửa trước của đĩa che lên hố đen -->
  <g clip-path="url(#${id}front)">
    <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.95}" ry="${R * 0.42}" fill="none" stroke="url(#${id}disk)" stroke-width="${R * 0.2}" filter="url(#${id}blur)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.95}" ry="${R * 0.42}" fill="none" stroke="#fff6e0" stroke-width="${R * 0.05}" opacity="0.85"/>
  </g>`;

const cosmicAvatar = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#2a1458"/><stop offset="60%" stop-color="#0d0b2b"/><stop offset="100%" stop-color="#05040f"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  ${stars(90, 800, 800, 7, 2.6)}
  ${blackHole(400, 400, 150, 'a')}
  <text x="400" y="438" text-anchor="middle" font-family='${FONT}' font-weight="800" font-size="138" fill="#fff">?</text>
</svg>`;

const cosmicBanner = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05040f"/><stop offset="50%" stop-color="#140c3a"/><stop offset="100%" stop-color="#05040f"/>
    </linearGradient>
    <radialGradient id="neb1" cx="25%" cy="40%" r="35%"><stop offset="0%" stop-color="#6b2fd6" stop-opacity="0.55"/><stop offset="100%" stop-color="#6b2fd6" stop-opacity="0"/></radialGradient>
    <radialGradient id="neb2" cx="78%" cy="62%" r="30%"><stop offset="0%" stop-color="#1fb5d6" stop-opacity="0.35"/><stop offset="100%" stop-color="#1fb5d6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="2560" height="1440" fill="url(#bg)"/>
  <rect width="2560" height="1440" fill="url(#neb1)"/>
  <rect width="2560" height="1440" fill="url(#neb2)"/>
  ${stars(700, 2560, 1440, 42, 2.8)}
  ${blackHole(1640, 720, 120, 'b')}
  <!-- vùng an toàn: x 507–2053, y 508–931 -->
  <text x="560" y="705" font-family='${FONT}' font-weight="800" font-size="118" letter-spacing="6" fill="#ffffff">COSMIC</text>
  <text x="560" y="830" font-family='${FONT}' font-weight="800" font-size="118" letter-spacing="6" fill="#ffb347">WHAT IF?</text>
  <text x="564" y="895" font-family='${FONT}' font-weight="500" font-size="40" fill="#c9c3ff">Mind-bending science, one "what if" at a time</text>
</svg>`;

// ─── Kênh 2: Inside Your Body ─────────────────────────────────────────────────
const heartPulse = (x, y, s, stroke) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 -40 C -18 -78 -92 -70 -92 -14 C -92 30 -40 62 0 96 C 40 62 92 30 92 -14 C 92 -70 18 -78 0 -40 Z"
          fill="none" stroke="${stroke}" stroke-width="13" stroke-linejoin="round"/>
    <polyline points="-120,8 -54,8 -36,-26 -16,46 6,-44 26,30 40,8 120,8"
          fill="none" stroke="${stroke}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const dna = (x0, y0, len, amp, turns, color, opacity) => {
  let a = '', b = '', rungs = '';
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = x0 + t * len, ph = t * turns * Math.PI * 2;
    const y1 = y0 + Math.sin(ph) * amp, y2 = y0 - Math.sin(ph) * amp;
    a += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y1.toFixed(1)} `;
    b += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y2.toFixed(1)} `;
    if (i % 6 === 0) rungs += `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return `<g stroke="${color}" opacity="${opacity}" fill="none" stroke-linecap="round">
    <path d="${a}" stroke-width="6"/><path d="${b}" stroke-width="6"/><g stroke-width="3">${rungs}</g></g>`;
};

const cells = (n, w, h, seed) => {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = 18 + rnd() * 70;
    out += `<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h).toFixed(0)}" r="${r.toFixed(0)}" fill="#ffffff" opacity="${(0.03 + rnd() * 0.06).toFixed(2)}"/>`;
  }
  return out;
};

const bodyAvatar = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14c3b8"/><stop offset="100%" stop-color="#0b4f8a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  ${cells(18, 800, 800, 11)}
  <circle cx="400" cy="400" r="235" fill="#ffffff" opacity="0.12"/>
  ${heartPulse(400, 385, 2.05, '#ffffff')}
</svg>`;

const bodyBanner = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b4f8a"/><stop offset="55%" stop-color="#0e8fa6"/><stop offset="100%" stop-color="#14c3b8"/>
    </linearGradient>
  </defs>
  <rect width="2560" height="1440" fill="url(#bg)"/>
  ${cells(70, 2560, 1440, 23)}
  ${dna(0, 300, 2560, 70, 5, '#ffffff', 0.10)}
  ${dna(0, 1150, 2560, 70, 5.5, '#ffffff', 0.10)}
  <!-- vùng an toàn: x 507–2053, y 508–931 -->
  <circle cx="1820" cy="720" r="170" fill="#ffffff" opacity="0.14"/>
  ${heartPulse(1820, 708, 1.45, '#ffffff')}
  <text x="560" y="705" font-family='${FONT}' font-weight="800" font-size="118" letter-spacing="6" fill="#ffffff">INSIDE</text>
  <text x="560" y="830" font-family='${FONT}' font-weight="800" font-size="118" letter-spacing="6" fill="#ffe08a">YOUR BODY</text>
  <text x="564" y="895" font-family='${FONT}' font-weight="500" font-size="40" fill="#e3fbff">The science of you, explained simply</text>
</svg>`;

const CHANNELS = [
  { dir: 'cosmic-what-if', avatar: cosmicAvatar, banner: cosmicBanner },
  { dir: 'inside-your-body', avatar: bodyAvatar, banner: bodyBanner },
];

async function launch() {
  const candidates = [
    process.env.CHROME_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(p => p && fs.existsSync(p));
  try { return await puppeteer.launch({ headless: true }); }
  catch (e) { return puppeteer.launch({ headless: true, executablePath: candidates[0] }); }
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  for (const ch of CHANNELS) {
    const outDir = path.join(__dirname, ch.dir);
    fs.mkdirSync(outDir, { recursive: true });
    for (const [name, fn, w, h] of [['avatar', ch.avatar, 800, 800], ['banner', ch.banner, 2560, 1440]]) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await page.setContent(`<html><body style="margin:0">${fn()}</body></html>`);
      const file = path.join(outDir, `${name}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } });
      console.log(`✅ ${path.relative(process.cwd(), file)} (${w}x${h}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
    }
  }
  await browser.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
