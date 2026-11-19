#!/usr/bin/env node
/**
 * Cài công cụ AI chạy trên máy cho pipeline nội dung (macOS và Windows):
 *   .venv-tts  → Kokoro (giọng đọc, Apache-2.0)
 *   .venv-img  → Z-Image-Turbo (tranh minh hoạ, Apache-2.0): mflux trên Mac, diffusers + CUDA trên Windows/Linux
 * Dùng: npm run content:setup            (cả hai)
 *       npm run content:setup -- tts     (chỉ giọng đọc)
 *       npm run content:setup -- img     (chỉ sinh ảnh)
 */
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { ROOT, venvPython } = require('./lib/pyenv');

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const what = process.argv[2] || 'all';

const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  if (r.status !== 0) throw new Error(`Lỗi khi chạy: ${cmd} ${args.join(' ')}`);
};
const has = (cmd, args = ['--version']) => { try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; } };

// Python 3.12 (Kokoro và PyTorch chưa hỗ trợ bản mới hơn ổn định)
function python312() {
  const cands = WIN ? [['py', ['-3.12']], ['python3.12', []], ['python', []]]
    : [['/opt/homebrew/bin/python3.12', []], ['python3.12', []], ['python3', []]];
  for (const [cmd, pre] of cands) {
    try {
      const v = execFileSync(cmd, [...pre, '-c', 'import sys;print("%d.%d" % sys.version_info[:2])']).toString().trim();
      if (v === '3.12' || v === '3.11') return [cmd, pre];
    } catch { /* thử bản khác */ }
  }
  throw new Error(WIN ? 'Cần Python 3.12: winget install Python.Python.3.12' : 'Cần Python 3.12: brew install python@3.12');
}

function venv(name, packages, extraIndex) {
  const py = venvPython(name);
  if (!fs.existsSync(py)) { const [cmd, pre] = python312(); run(cmd, [...pre, '-m', 'venv', name]); }
  run(py, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  if (extraIndex) run(py, ['-m', 'pip', 'install', ...extraIndex]);
  run(py, ['-m', 'pip', 'install', ...packages]);
}

function checkFfmpeg() {
  if (has('ffmpeg', ['-version'])) return;
  console.log(WIN ? '⚠️  Chưa có ffmpeg: winget install Gyan.FFmpeg  (rồi mở lại terminal)' : '⚠️  Chưa có ffmpeg: brew install ffmpeg');
}

function setupTts() {
  console.log('\n🎙️  Kokoro (giọng đọc)');
  if (MAC && !has('espeak-ng')) run('brew', ['install', 'espeak-ng']);
  // Windows: gói misaki/espeakng-loader đã kèm espeak-ng; nếu lỗi phát âm thì cài thêm: winget install eSpeak-NG.eSpeak-NG
  venv('.venv-tts', ['kokoro>=0.9.2', 'soundfile']);
}

function setupImg() {
  console.log('\n🎨  Z-Image-Turbo (tranh minh hoạ)');
  if (MAC) return venv('.venv-img', ['mflux']);
  if (!has('nvidia-smi')) {
    console.log('⚠️  Không thấy GPU NVIDIA (nvidia-smi). Sinh ảnh AI cần GPU NVIDIA ≥ 12 GB VRAM — bỏ qua bước này.');
    console.log('    Pipeline vẫn chạy: cảnh không có ảnh miễn phí sẽ hiện thẻ TODO để vẽ/ghim ảnh tay.');
    return;
  }
  venv('.venv-img', ['diffusers>=0.36', 'transformers', 'accelerate', 'safetensors', 'sentencepiece'],
    ['torch', '--index-url', 'https://download.pytorch.org/whl/cu128']);
}

try {
  checkFfmpeg();
  if (what === 'all' || what === 'tts') setupTts();
  if (what === 'all' || what === 'img') setupImg();
  console.log('\n✅ Xong. Thử: npm run content -- build <ngày|all>');
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
}
