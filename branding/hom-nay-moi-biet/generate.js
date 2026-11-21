// Tạo avatar + cover cho page "Hôm Nay Mới Biết". Chạy: node branding/hom-nay-moi-biet/generate.js
const path = require('path');
const puppeteer = require('puppeteer-core');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const NAVY = '#081630', INDIGO = '#1b2f6b', AMBER = '#ffc83d', ORANGE = '#ff9d1c', CREAM = '#fff4d6';
const FONT = `"Avenir Next","Helvetica Neue",Arial,sans-serif`;
const EMOJI = `"Apple Color Emoji","Segoe UI Emoji",sans-serif`;

const defs = (uid) => `
<radialGradient id="bg${uid}" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${INDIGO}"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
<radialGradient id="glow${uid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${AMBER}" stop-opacity=".55"/><stop offset=".55" stop-color="${ORANGE}" stop-opacity=".14"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
<linearGradient id="bulb${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset=".55" stop-color="${AMBER}"/><stop offset="1" stop-color="${ORANGE}"/></linearGradient>
<linearGradient id="base${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dde8"/><stop offset="1" stop-color="#8e98ad"/></linearGradient>`;

// Tia sáng tỏa ra từ tâm (cx,cy), n tia
const burst = (cx, cy, r, n, op) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
  const p = (ang) => `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
  return `<polygon points="${cx},${cy} ${p(a - w)} ${p(a + w)}" fill="${AMBER}" opacity="${op}"/>`;
}).join('');

const spark = (x, y, s, op = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-30 C3-8 8-3 30 0 C8 3 3 8 0 30 C-3 8 -8 3 -30 0 C-8-3 -3-8 0-30Z" fill="${CREAM}" opacity="${op}"/>`;

// Bóng đèn, gốc toạ độ 1000x1000, tâm ~ (500,430)
const bulb = (uid) => `
<circle cx="500" cy="420" r="330" fill="url(#glow${uid})"/>
<path d="M500 170 C 360 170 280 270 280 385 C 280 475 335 520 370 580 C 387 610 392 632 392 660 L 608 660 C 608 632 613 610 630 580 C 665 520 720 475 720 385 C 720 270 640 170 500 170 Z" fill="url(#bulb${uid})"/>
<path d="M335 330 C 355 255 415 212 480 208" stroke="#fff" stroke-width="20" stroke-linecap="round" fill="none" opacity=".6"/>
<path d="M650 470 C 668 440 676 410 676 385" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none" opacity=".25"/>
<rect x="388" y="668" width="224" height="42" rx="21" fill="url(#base${uid})"/>
<rect x="404" y="716" width="192" height="40" rx="20" fill="url(#base${uid})"/>
<rect x="446" y="762" width="108" height="34" rx="17" fill="#6f7a92"/>
<text x="500" y="535" text-anchor="middle" font-family='${FONT}' font-weight="900" font-size="340" fill="${NAVY}">?</text>`;

const avatar = `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1000 1000">
<defs>${defs('a')}</defs>
<rect width="1000" height="1000" fill="url(#bga)"/>
${burst(500, 440, 760, 24, 0.07)}
<circle cx="500" cy="500" r="455" fill="none" stroke="${AMBER}" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" opacity=".55"/>
${bulb('a')}
${spark(190, 250, 1.3)}${spark(830, 200, 0.9)}${spark(860, 640, 1.1, .8)}${spark(150, 690, .8, .7)}
</svg></body></html>`;

// Chip chủ đề: vòng tròn kính mờ + emoji
const chip = (x, y, r, e, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">
<circle r="${r}" fill="#ffffff" fill-opacity=".09" stroke="${AMBER}" stroke-opacity=".7" stroke-width="3"/>
<text y="${r * 0.33}" text-anchor="middle" font-family='${EMOJI}' font-size="${r * 1.0}">${e}</text></g>`;

const chips = [
  chip(110, 150, 52, '🔬', -8), chip(265, 300, 64, '🧬', 6), chip(120, 460, 56, '🦁', -5), chip(300, 520, 40, '⭐'),
  chip(1530, 150, 52, '🪐', 8), chip(1375, 300, 64, '🏛️', -6), chip(1520, 460, 56, '🫀', 5), chip(1340, 525, 40, '⭐'),
  chip(440, 70, 34, '🌋'), chip(1200, 70, 34, '🧠'),
].join('');

const cover = `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624" viewBox="0 0 1640 624">
<defs>${defs('c')}</defs>
<rect width="1640" height="624" fill="url(#bgc)"/>
${burst(820, 312, 1100, 36, 0.045)}
<g transform="translate(540 -4) scale(.78)">
  <circle cx="500" cy="420" r="420" fill="url(#glowc)"/>
</g>
${chips}
${spark(470, 560, .6, .8)}${spark(1180, 560, .5, .7)}${spark(640, 60, .4, .8)}${spark(1020, 40, .5, .7)}
<g transform="translate(339 130) scale(.45)">${bulb('c')}</g>
<text x="746" y="270" font-family='${FONT}' font-weight="900" font-size="92" fill="${CREAM}" letter-spacing="2">HÔM NAY</text>
<text x="746" y="370" font-family='${FONT}' font-weight="900" font-size="92" fill="${AMBER}" letter-spacing="2">MỚI BIẾT</text>
<rect x="749" y="392" width="140" height="6" rx="3" fill="${ORANGE}"/>
<text x="749" y="440" font-family='${FONT}' font-weight="500" font-size="32" fill="${CREAM}" opacity=".92">Mỗi ngày biết thêm một điều mới</text>
</svg></body></html>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: 'new' });
  const shot = async (html, w, h, file) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setContent(html);
    await page.screenshot({ path: path.join(__dirname, file) });
    console.log('✅', file);
  };
  await shot(avatar, 1080, 1080, 'avatar.png');
  await shot(cover, 1640, 624, 'cover.png');
  await browser.close();
})();
