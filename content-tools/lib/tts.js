/**
 * Giọng đọc offline (Kokoro-82M, Apache-2.0) — không tốn credit.
 * Cài: npm run content:setup
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const CHANNELS = require('./channels');
const { splitSentences } = require('./align');

const { ROOT, venvPython } = require('./pyenv');
const PYTHON = venvPython('.venv-tts');
const SCRIPT = path.join(__dirname, '..', 'tts', 'kokoro_tts.py');

function buildJob(script, out, { voice, speed } = {}) {
  const ch = CHANNELS[script.channel] || {};
  return {
    voice: voice || ch.ttsVoice || 'af_heart',
    speed: speed || ch.ttsSpeed || 1.0,
    out,
    sentence_gap: 0.35,
    scene_gap: 0.8,
    scenes: script.scenes.map(s => splitSentences(s.narration)),
  };
}

const available = () => fs.existsSync(PYTHON);

// Tạo voice.mp3 cho thư mục video (ghi file tạm rồi mới thay voice.mp3)
async function synthesize(dir, { onProgress = () => {}, voice, speed } = {}) {
  if (!available()) throw new Error('Chưa cài Kokoro (.venv-tts) — xem content-tools/lib/tts.js');
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const wav = path.join(dir, 'voice.part.wav');
  const part = path.join(dir, 'voice.part.mp3');
  const job = buildJob(script, wav, { voice, speed });
  try {
    await new Promise((resolve, reject) => {
      const p = spawn(PYTHON, [SCRIPT], { cwd: ROOT, env: { ...process.env, PYTHONWARNINGS: 'ignore' } });
      let err = '';
      p.stdout.on('data', d => { const m = String(d).match(/PROGRESS ([\d.]+)/g); if (m) onProgress(0.9 * +m[m.length - 1].split(' ')[1], 'đọc lời'); });
      p.stderr.on('data', d => { err = (err + d).slice(-4000); });
      p.on('error', reject);
      p.on('close', code => (code === 0 ? resolve() : reject(new Error(`Kokoro lỗi (${code}): ${err.trim().split('\n').pop()}`))));
      p.stdin.end(JSON.stringify(job));
    });
    onProgress(0.95, 'chuyển mp3');
    await new Promise((resolve, reject) => execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', part], e => (e ? reject(e) : resolve())));
    fs.renameSync(part, path.join(dir, 'voice.mp3'));
  } finally {
    fs.rmSync(wav, { force: true });
    fs.rmSync(part, { force: true });
  }
  onProgress(1, `voice.mp3 (${job.voice})`);
  return { voice: job.voice };
}

module.exports = { buildJob, synthesize, available };
