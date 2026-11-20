/**
 * Mốc thời gian từng câu của giọng đọc:
 *  - sentenceTimings: ưu tiên voice.timings.json (Kokoro ghi lúc tạo giọng — chính xác, xem tts.js);
 *    không có / lời đã khác (giọng cũ, giọng thu tay) → đo khoảng lặng rồi canh:
 *  - detectPauses: ffmpeg silencedetect tìm các khoảng lặng
 *  - alignSentences: quy hoạch động chọn N-1 khoảng lặng (theo thứ tự) làm ranh giới câu,
 *    gần nhất với mốc dự kiến (tỉ lệ theo số ký tự), ưu tiên khoảng lặng dài.
 *    Thiếu khoảng lặng → dùng mốc dự kiến (ranh giới "ảo"). Cách này hay lệch ở video dài
 *    (Kokoro tự thêm im lặng ~1s sau câu, ngắt ở dấu phẩy ≥0.3s) — chỉ là dự phòng.
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const LAMBDA = 2;      // thưởng cho khoảng lặng dài (s² trên mỗi giây lặng)
const VIRTUAL = 1.5;   // phạt khi phải dùng ranh giới ảo (s²)

function splitSentences(text) {
  return (text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*(\s|$)/g) || [text]).map(s => s.trim()).filter(Boolean);
}

function detectPauses(audioFile, { noiseDb = -35, minDur = 0.3 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-hide_banner', '-i', audioFile, '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`, '-f', 'null', '-'],
      { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && !stderr) return reject(err);
        const pauses = [], starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
        const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
        starts.forEach((s, i) => { if (ends[i] !== undefined) pauses.push({ start: s, end: ends[i] }); });
        const dur = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
        resolve({ pauses, duration: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + (+dur[3]) : null });
      });
  });
}

function alignSentences(sentences, pauses, duration) {
  const N = sentences.length;
  if (N === 1) return [{ start: 0, end: duration }];
  // Khoảng lặng ở đầu/cuối file không phải ranh giới câu
  const inner = pauses.filter(p => p.start > 0.05 && p.end < duration - 0.05);
  const lead = pauses.find(p => p.start <= 0.05);
  const speechStart = lead ? lead.end : 0;
  const lens = sentences.map(s => s.length), total = lens.reduce((a, b) => a + b, 0);
  const expected = []; let acc = 0;
  for (let k = 0; k < N - 1; k++) { acc += lens[k]; expected.push(speechStart + (duration - speechStart) * acc / total); }

  const cands = inner.map(p => ({ start: p.start, end: p.end, mid: (p.start + p.end) / 2, len: p.end - p.start, virtual: false }))
    .concat(expected.map(e => ({ start: e, end: e, mid: e, len: 0, virtual: true })))
    .sort((a, b) => a.mid - b.mid);
  const M = cands.length, K = N - 1, INF = 1e18;
  const cost = (k, c) => (c.mid - expected[k]) ** 2 - LAMBDA * c.len + (c.virtual ? VIRTUAL : 0);
  // dp[k][j]: chi phí nhỏ nhất khi ranh giới k dùng ứng viên j
  const dp = Array.from({ length: K }, () => new Float64Array(M).fill(INF));
  const from = Array.from({ length: K }, () => new Int32Array(M).fill(-1));
  for (let j = 0; j < M; j++) dp[0][j] = cost(0, cands[j]);
  // Ranh giới k phải bắt đầu sau khi ranh giới k-1 kết thúc (không chồng câu,
  // kể cả khi ranh giới ảo rơi vào giữa một khoảng lặng dài)
  for (let k = 1; k < K; k++) {
    for (let j = 0; j < M; j++) {
      let best = INF, bestI = -1;
      for (let i = 0; i < j; i++) {
        if (dp[k - 1][i] < best && cands[i].end < cands[j].start + 1e-9 && cands[i].mid < cands[j].mid) { best = dp[k - 1][i]; bestI = i; }
      }
      if (bestI >= 0) { dp[k][j] = best + cost(k, cands[j]); from[k][j] = bestI; }
    }
  }
  let j = -1, best = INF;
  for (let x = 0; x < M; x++) if (dp[K - 1][x] < best) { best = dp[K - 1][x]; j = x; }
  const chosen = new Array(K);
  for (let k = K - 1; k >= 0; k--) { chosen[k] = cands[j]; j = from[k][j]; }

  const timings = [];
  let start = speechStart;
  for (let k = 0; k < N; k++) {
    const end = k < K ? chosen[k].start : duration;
    timings.push({ start, end: Math.max(end, start + 0.05) });
    if (k < K) start = chosen[k].end;
  }
  return timings;
}

function estimateTimings(sentences, wpm = 163, gap = 0.35) {
  let t = 0;
  return sentences.map(s => {
    const d = s.split(/\s+/).filter(Boolean).length * 60 / wpm;
    const r = { start: t, end: t + d };
    t += d + gap;
    return r;
  });
}

/** voice.timings.json của thư mục video, chỉ khi còn khớp đúng từng câu với kịch bản hiện tại; không thì null */
function loadTimings(dir, sentences) {
  const file = path.join(dir, 'voice.timings.json');
  if (!fs.existsSync(file)) return null;
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  if (!Array.isArray(data.timings) || !Array.isArray(data.sentences)) return null;
  if (data.timings.length !== sentences.length || data.sentences.some((s, i) => s !== sentences[i])) return null;
  const timings = data.timings.map(x => ({ start: +x.start, end: +x.end }));
  if (timings.some((x, i) => !(x.end > x.start) || (i > 0 && x.start < timings[i - 1].end))) return null;
  return { timings, duration: +data.duration || timings[timings.length - 1].end };
}

/** Mốc câu để render: { timings, duration, source: 'timings' | 'silence' } */
async function sentenceTimings(dir, sentences, voiceFile = path.join(dir, 'voice.mp3')) {
  const exact = loadTimings(dir, sentences);
  if (exact) return { ...exact, source: 'timings' };
  const { pauses, duration } = await detectPauses(voiceFile);
  return { timings: alignSentences(sentences, pauses, duration), duration, source: 'silence' };
}

module.exports = { splitSentences, detectPauses, alignSentences, estimateTimings, loadTimings, sentenceTimings };
