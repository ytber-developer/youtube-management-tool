/**
 * Canh thời gian từng câu theo giọng đọc thật, không cần API:
 *  - detectPauses: ffmpeg silencedetect tìm các khoảng lặng
 *  - alignSentences: quy hoạch động chọn N-1 khoảng lặng (theo thứ tự) làm ranh giới câu,
 *    gần nhất với mốc dự kiến (tỉ lệ theo số ký tự), ưu tiên khoảng lặng dài.
 *    Thiếu khoảng lặng → dùng mốc dự kiến (ranh giới "ảo").
 */
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
  for (let k = 1; k < K; k++) {
    let best = INF, bestJ = -1;
    for (let j = 0; j < M; j++) {
      if (j > 0 && dp[k - 1][j - 1] < best) { best = dp[k - 1][j - 1]; bestJ = j - 1; }
      if (bestJ >= 0 && cands[j].mid > cands[bestJ].mid) { dp[k][j] = best + cost(k, cands[j]); from[k][j] = bestJ; }
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

module.exports = { splitSentences, detectPauses, alignSentences, estimateTimings };
