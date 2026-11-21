/**
 * Fingerprint trình duyệt riêng cho từng profile (giống GPM Login / Multilogin ở mức cơ bản).
 *
 * Nguyên tắc: mỗi tài khoản có một bộ giá trị CỐ ĐỊNH (sinh từ email, lưu browser-profiles/<slug>/fingerprint.json)
 * để lần nào mở cũng giống nhau — fingerprint đổi liên tục còn đáng ngờ hơn trùng nhau. Chỉ đổi những thứ
 * vẫn nhất quán với máy thật: kích thước màn hình/cửa sổ, số nhân CPU, RAM, card đồ hoạ WebGL (chọn trong
 * bộ giá trị có thật của ĐÚNG hệ điều hành đang chạy: macOS → GPU Apple/Intel/AMD kiểu Metal/OpenGL,
 * Windows → GPU NVIDIA/AMD/Intel kiểu Direct3D11), nhiễu canvas/audio rất nhỏ, ngôn ngữ, múi giờ theo proxy.
 * KHÔNG giả User-Agent/platform (Client Hints sẽ lệch → Google bắt CAPTCHA). Profile copy sang máy khác hệ
 * điều hành sẽ được sinh lại cho khớp máy mới.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sessionService = require('./session.service');

const VERSION = 3;
const OS = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux';

// Màn hình phổ biến theo hệ điều hành (CSS px + tỷ lệ pixel) — mọi tổ hợp đều có thật ngoài đời
const SCREENS = {
  mac: [
    { width: 1440, height: 900, pixelRatio: 2 },   // MacBook Air 13 / Pro 13
    { width: 1512, height: 982, pixelRatio: 2 },   // MacBook Pro 14
    { width: 1728, height: 1117, pixelRatio: 2 },  // MacBook Pro 16
    { width: 1680, height: 1050, pixelRatio: 2 },  // MBP 15 scaled
    { width: 1920, height: 1080, pixelRatio: 1 },  // màn ngoài FHD
    { width: 2560, height: 1440, pixelRatio: 1 },  // màn ngoài QHD
    { width: 1920, height: 1080, pixelRatio: 2 },  // màn 4K scaled
  ],
  win: [
    { width: 1920, height: 1080, pixelRatio: 1 },     // FHD 100%
    { width: 1536, height: 864, pixelRatio: 1.25 },   // laptop FHD 125% (rất phổ biến)
    { width: 1366, height: 768, pixelRatio: 1 },      // laptop HD
    { width: 1280, height: 720, pixelRatio: 1.5 },    // laptop FHD 150%
    { width: 2560, height: 1440, pixelRatio: 1 },     // QHD 100%
    { width: 1707, height: 960, pixelRatio: 1.5 },    // 2.5K 150%
    { width: 1600, height: 900, pixelRatio: 1 },
    { width: 1920, height: 1200, pixelRatio: 1 },
  ],
  linux: [
    { width: 1920, height: 1080, pixelRatio: 1 },
    { width: 2560, height: 1440, pixelRatio: 1 },
    { width: 1366, height: 768, pixelRatio: 1 },
    { width: 1920, height: 1200, pixelRatio: 1 },
  ],
};

// GPU theo hệ điều hành: chuỗi UNMASKED_RENDERER_WEBGL đúng định dạng ANGLE của Chrome trên hệ đó
const GPUS = {
  mac: [
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', cores: [8], memory: [8] },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)', cores: [8, 10], memory: [8] },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', cores: [8], memory: [8] },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', cores: [10, 12], memory: [8] },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)', cores: [8], memory: [8] },
    { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)', cores: [11, 12], memory: [8] },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics OpenGL Engine, OpenGL 4.1)', cores: [4, 8], memory: [8] },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon Pro 5500M OpenGL Engine, OpenGL 4.1)', cores: [8, 12], memory: [8] },
  ],
  win: [
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12, 16], memory: [8] },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12, 16], memory: [8] },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12, 16], memory: [8] },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [6, 8, 12], memory: [8] },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [4, 6, 8], memory: [8] },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12], memory: [8] },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [6, 8, 12], memory: [8] },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [4, 6, 8], memory: [8] },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12, 16], memory: [8] },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [4, 6, 8], memory: [8] },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [8, 12], memory: [8] },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: [4, 8, 12], memory: [8] },
  ],
  linux: [
    { vendor: 'Google Inc. (NVIDIA Corporation)', renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3060/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 535.154.05)', cores: [8, 12, 16], memory: [8] },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)', cores: [4, 8], memory: [8] },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 (radeonsi, navi23, LLVM 15.0.7, DRM 3.54, 6.5.0), OpenGL 4.6 (Core Profile) Mesa 23.2.1)', cores: [6, 8, 12], memory: [8] },
  ],
};
// navigator.deviceMemory của Chrome chỉ trả 0.25/0.5/1/2/4/8 (trần 8) nên luôn là 8 với máy đời mới

// Múi giờ theo nước của proxy (ISO-2 hoặc tên); không có proxy → giữ múi giờ thật của máy
const TZ_BY_COUNTRY = {
  US: 'America/New_York', USA: 'America/New_York', 'UNITED STATES': 'America/New_York',
  CA: 'America/Toronto', GB: 'Europe/London', UK: 'Europe/London', DE: 'Europe/Berlin', FR: 'Europe/Paris',
  NL: 'Europe/Amsterdam', AU: 'Australia/Sydney', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', SG: 'Asia/Singapore',
  VN: 'Asia/Ho_Chi_Minh', VIETNAM: 'Asia/Ho_Chi_Minh', TH: 'Asia/Bangkok', ID: 'Asia/Jakarta', PH: 'Asia/Manila',
  IN: 'Asia/Kolkata', BR: 'America/Sao_Paulo', MX: 'America/Mexico_City',
};
const LANGS_BY_COUNTRY = { VN: ['vi-VN', 'vi', 'en-US', 'en'], VIETNAM: ['vi-VN', 'vi', 'en-US', 'en'], DE: ['de-DE', 'de', 'en-US', 'en'], FR: ['fr-FR', 'fr', 'en-US', 'en'], JP: ['ja-JP', 'ja', 'en-US', 'en'], BR: ['pt-BR', 'pt', 'en-US', 'en'] };

/** Bộ sinh số giả ngẫu nhiên có hạt (mulberry32) để email → fingerprint luôn như nhau */
function seeded(seedStr) {
  let a = parseInt(crypto.createHash('sha256').update(seedStr).digest('hex').slice(0, 8), 16) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Sinh fingerprint cho email trên hệ điều hành `os` ('mac' | 'win' | 'linux', mặc định máy đang chạy).
 * Cùng email + cùng os + cùng salt → cùng kết quả.
 */
function generate(email, { salt = '', os = OS } = {}) {
  const rnd = seeded(`${email}|${os}|${salt}`);
  const screen = pick(rnd, SCREENS[os] || SCREENS.linux);
  const gpu = pick(rnd, GPUS[os] || GPUS.linux);
  // Thanh menu macOS ~25 css px; taskbar Windows ~48 px vật lý; Linux (GNOME) ~32
  const chrome = os === 'mac' ? 25 : os === 'win' ? Math.round(48 / screen.pixelRatio) : 32;
  // Cửa sổ Chrome nhỏ hơn màn hình một chút như người dùng thật (không bao giờ đúng bằng màn hình)
  const winW = clamp(screen.width - Math.round(40 + rnd() * 160), Math.min(1000, screen.width - 20), 1600);
  const winH = clamp(screen.height - chrome - Math.round(40 + rnd() * 100), Math.min(700, screen.height - chrome - 20), 1000);
  return {
    version: VERSION,
    platform: os,
    createdAt: new Date().toISOString(),
    screen: { width: screen.width, height: screen.height, availHeight: screen.height - chrome, colorDepth: os === 'mac' ? 30 : 24, pixelRatio: screen.pixelRatio },
    window: { width: winW, height: winH },
    hardwareConcurrency: pick(rnd, gpu.cores),
    deviceMemory: pick(rnd, gpu.memory),
    webgl: { vendor: gpu.vendor, renderer: gpu.renderer },
    // nhiễu canvas: seed chọn pixel nào bị chạm (khác nhau từng profile), amount = +1..3/255 → mắt không thấy
    canvasNoise: { seed: Math.floor(rnd() * 1e6), amount: 1 + Math.floor(rnd() * 3) },
    audioNoise: Number((rnd() * 1e-7).toFixed(10)),
    languages: ['en-US', 'en'],
    timezone: null, // null = múi giờ thật; cập nhật theo proxy lúc mở (xem withProxy)
  };
}

const fileOf = (email) => path.join(sessionService.getProfilePath(email), 'fingerprint.json');

/** Đọc fingerprint đã lưu; chưa có, hỏng, phiên bản cũ hay sinh trên hệ điều hành khác → sinh mới và lưu */
function getOrCreate(email) {
  const file = fileOf(email);
  try {
    const fp = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (fp && fp.version === VERSION && fp.platform === OS && fp.screen && fp.webgl) return fp;
    if (fp && fp.platform && fp.platform !== OS) console.log(`🪪 Fingerprint của [${email}] sinh trên ${fp.platform}, máy này là ${OS} → sinh lại cho khớp`);
  } catch { /* chưa có */ }
  const fp = generate(email);
  save(email, fp);
  console.log(`🪪 Fingerprint mới cho [${email}]: ${describe(fp)}`);
  return fp;
}

function save(email, fp) {
  const file = fileOf(email);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(fp, null, 2) + '\n');
}

/** Sinh lại (salt = thời điểm) — chỉ nên làm khi tài khoản bị đánh dấu */
function regenerate(email) {
  const fp = generate(email, { salt: String(Date.now()) });
  save(email, fp);
  return fp;
}

/** Múi giờ + ngôn ngữ theo nước của proxy (nếu có); giữ nguyên giá trị đã lưu nếu không biết nước */
function withProxy(fp, proxy) {
  if (!proxy || !proxy.country) return { ...fp, timezone: fp.timezone || null };
  const key = String(proxy.country).trim().toUpperCase();
  return { ...fp, timezone: TZ_BY_COUNTRY[key] || fp.timezone || null, languages: LANGS_BY_COUNTRY[key] || fp.languages };
}

/** Tên GPU ngắn gọn từ chuỗi ANGLE: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 3060" */
function gpuName(renderer) {
  const inner = renderer.replace(/^ANGLE \(/, '').replace(/\)$/, '');
  const parts = inner.split(', ');
  const name = (parts[1] || parts[0] || renderer).replace(/^ANGLE Metal Renderer: /, '');
  return name.replace(/ Direct3D11.*$/, '').replace(/ OpenGL Engine$/, '').replace(/\/PCIe\/SSE2$/, '').replace(/ \(.*$/, '').trim();
}

const describe = (fp) => `${fp.platform || OS} · ${fp.screen.width}x${fp.screen.height}@${fp.screen.pixelRatio}x, ${fp.hardwareConcurrency} nhân, ${fp.deviceMemory} GB, ${gpuName(fp.webgl.renderer)}${fp.timezone ? `, ${fp.timezone}` : ''}`;

/** Tham số khởi động Chrome lấy từ fingerprint */
const launchArgs = (fp) => [`--window-size=${fp.window.width},${fp.window.height}`, `--lang=${fp.languages.join(',')}`];

/**
 * Áp fingerprint lên một tab: múi giờ qua CDP, còn lại chèn script chạy trước mọi trang.
 * Gọi cho từng page (tab mới không kế thừa evaluateOnNewDocument). Chỉ có hiệu lực sau một lần điều hướng
 * thật (goto); page.setContent không tạo document mới nên không kích hoạt.
 */
async function apply(page, fp) {
  if (fp.timezone) {
    try { await page.emulateTimezone(fp.timezone); } catch (e) { console.warn('⚠️ Không đặt được múi giờ:', e.message); }
  }
  await page.evaluateOnNewDocument(injected, fp);
}

/* Chạy trong trang. Mọi override đều giữ kiểu dữ liệu/hành vi gốc để không lộ qua toString hay lỗi ném ra. */
function injected(fp) {
  const define = (obj, key, value) => { try { Object.defineProperty(obj, key, { get: () => value, configurable: true }); } catch (e) { /* bỏ qua */ } };

  // Màn hình / cửa sổ
  define(screen, 'width', fp.screen.width);
  define(screen, 'height', fp.screen.height);
  define(screen, 'availWidth', fp.screen.width);
  define(screen, 'availHeight', fp.screen.availHeight);
  define(screen, 'colorDepth', fp.screen.colorDepth);
  define(screen, 'pixelDepth', fp.screen.colorDepth);
  define(window, 'devicePixelRatio', fp.screen.pixelRatio);
  define(window, 'outerWidth', fp.window.width);
  define(window, 'outerHeight', fp.window.height);

  // Phần cứng / ngôn ngữ
  define(navigator, 'hardwareConcurrency', fp.hardwareConcurrency);
  define(navigator, 'deviceMemory', fp.deviceMemory);
  define(navigator, 'languages', Object.freeze(fp.languages.slice()));
  define(navigator, 'language', fp.languages[0]);

  // WebGL: UNMASKED_VENDOR_WEBGL (37445) / UNMASKED_RENDERER_WEBGL (37446)
  const patchGL = (proto) => {
    if (!proto || !proto.getParameter) return;
    const orig = proto.getParameter;
    const patched = function (p) {
      if (p === 37445) return fp.webgl.vendor;
      if (p === 37446) return fp.webgl.renderer;
      return orig.call(this, p);
    };
    Object.defineProperty(patched, 'name', { value: 'getParameter' });
    patched.toString = () => orig.toString();
    proto.getParameter = patched;
  };
  patchGL(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  patchGL(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);

  // Canvas: nhiễu rất nhỏ, cố định theo profile, chỉ chạm vài pixel → hash khác giữa các profile
  const { seed, amount } = fp.canvasNoise;
  const salt = (x, y) => (((x * 31 + y * 17 + seed) * 2654435761) >>> 0) % 97 < 3 ? amount : 0;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, ...rest) {
    const img = origGetImageData.call(this, x, y, w, h, ...rest);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % w, py = Math.floor(i / 4 / w);
      const s = salt(px, py);
      if (s) d[i] = Math.min(255, d[i] + s);
    }
    return img;
  };
  CanvasRenderingContext2D.prototype.getImageData.toString = () => origGetImageData.toString();
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    try {
      const ctx = this.getContext('2d');
      if (ctx && this.width && this.height) {
        const img = origGetImageData.call(ctx, 0, 0, this.width, this.height);
        const d = img.data;
        let changed = false;
        for (let i = 0; i < d.length; i += 4) {
          const s = salt((i / 4) % this.width, Math.floor(i / 4 / this.width));
          if (s && d[i + 3] > 0) { d[i] = Math.min(255, d[i] + s); changed = true; }
        }
        if (changed) ctx.putImageData(img, 0, 0);
      }
    } catch (e) { /* canvas WebGL hoặc bị taint → bỏ qua */ }
    return origToDataURL.apply(this, args);
  };
  HTMLCanvasElement.prototype.toDataURL.toString = () => origToDataURL.toString();

  // Audio: lệch cực nhỏ trong getChannelData → hash AudioContext khác nhau, tai không nghe thấy
  if (window.AudioBuffer && fp.audioNoise) {
    const origChannel = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (...args) {
      const data = origChannel.apply(this, args);
      if (!data.__fp) {
        for (let i = 0; i < data.length; i += 100) data[i] += fp.audioNoise;
        try { Object.defineProperty(data, '__fp', { value: true }); } catch (e) { /* bỏ qua */ }
      }
      return data;
    };
    AudioBuffer.prototype.getChannelData.toString = () => origChannel.toString();
  }
}

module.exports = { getOrCreate, regenerate, withProxy, apply, launchArgs, describe, generate, gpuName, OS, TZ_BY_COUNTRY };
