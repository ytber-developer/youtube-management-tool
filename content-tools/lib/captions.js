// Phụ đề: chia câu thành dòng ngắn (≤40 ký tự), chia thời gian theo số ký tự, xuất SRT.
function chunk(sentence, max = 40) {
  const out = []; let cur = '';
  for (const w of sentence.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
    if (cur.endsWith(',') && cur.length > max * 0.55) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}

function buildCues(sentences, timings) {
  const cues = [];
  sentences.forEach((s, i) => {
    const { start, end } = timings[i];
    const parts = chunk(s), total = parts.reduce((a, p) => a + p.length, 0);
    let t = start;
    parts.forEach((p, k) => {
      const e = k === parts.length - 1 ? end : t + (end - start) * p.length / total;
      cues.push({ start: t, end: e, text: p });
      t = e;
    });
  });
  return cues;
}

function srtTime(t) {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');

module.exports = { chunk, buildCues, toSrt };
