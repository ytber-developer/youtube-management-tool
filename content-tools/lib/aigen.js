/**
 * Tranh minh hoạ AI sinh ngay trên máy (Z-Image-Turbo 4-bit qua mflux, Apache-2.0) — không tốn credit.
 * Nguồn cuối cùng khi không có ảnh miễn phí hợp lệ. Cảnh khoa học/không gian vẽ kiểu tượng trưng, không nhãn,
 * để không giả làm hình giải phẫu/ảnh thiên văn thật. macOS: mflux (MLX). Windows/Linux + NVIDIA: diffusers.
 * Cài: npm run content:setup
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { ROOT, venvPython } = require('./pyenv');
const PYTHON = venvPython('.venv-img');
const SCRIPT = path.join(__dirname, '..', 'tts', 'gen_images.py');

// Phong cách minh hoạ phẳng, đồng bộ màu kênh; nhìn là biết tranh vẽ (không giả ảnh thật)
const STYLE = {
  'inside-your-body': 'calm teal, deep navy and soft aqua palette with warm yellow accents',
  'cosmic-what-if': 'deep purple, indigo and midnight blue palette with warm orange accents',
};

function buildPrompt(scene, channel) {
  const v = scene.visual || {};
  const subject = [v.query, v.note].filter(Boolean).join(', ');
  const symbolic = v.type === 'science' || v.type === 'nasa'
    ? 'Symbolic, simplified artistic interpretation rather than an accurate scientific diagram: no labels, no anatomical or astronomical fine detail, no arrows. '
    : '';
  return 'Flat editorial vector illustration, clean simple shapes, soft gradients, gentle grain, '
    + `${STYLE[channel] || STYLE['inside-your-body']}, wide 16:9 composition with the subject centered-right. `
    + `Scene: ${subject}. ` + symbolic
    + 'Friendly, educational, not photorealistic, no gore, no logos, no text, no letters, no numbers, no watermark.';
}

function creditFor(job) {
  return {
    source: 'AI illustration (Z-Image-Turbo, generated locally)',
    id: `ai:${job.scene}:${job.seed}`,
    title: job.prompt,
    credit: 'AI-generated illustration',
    license: 'Generated with Z-Image-Turbo (Apache-2.0)',
    url: 'https://huggingface.co/Tongyi-MAI/Z-Image-Turbo',
    ai: true,
  };
}

const available = () => fs.existsSync(PYTHON);

/** Sinh ảnh cho cả lô (nạp mô hình một lần). Trả về danh sách số cảnh đã sinh xong. */
function generate(jobs, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, [SCRIPT], { cwd: ROOT, env: { ...process.env, PYTHONWARNINGS: 'ignore' } });
    const made = [];
    let err = '', buf = '';
    p.stdout.on('data', d => {
      buf += d;
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/^DONE (\d+) (.+)$/);
        if (!m) continue;
        const job = jobs.find(j => j.scene === +m[1]);
        require('./images').ensureJpeg(job.out);
        made.push(job.scene);
        onProgress(made.length / jobs.length, `tranh AI ${made.length}/${jobs.length}`);
      }
    });
    p.stderr.on('data', d => { err = (err + d).slice(-4000); });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(made) : made.length ? resolve(made) : reject(new Error(`Sinh ảnh AI lỗi (${code}): ${err.trim().split('\n').pop()}`))));
    p.stdin.end(JSON.stringify({ width: 1344, height: 768, steps: 9, jobs }));
  });
}

module.exports = { buildPrompt, creditFor, generate, available };
