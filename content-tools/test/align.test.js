const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const align = require('../lib/align');

const script = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole/script.json'), 'utf8'));
const TEXT = script.scenes.map(s => s.narration).join(' ');
const DURATION = 66.27;
// 16 khoảng lặng đo bằng ffmpeg silencedetect trên bản giọng Adam của video mẫu
const PAUSES = [[1.94, 2.47], [3.20, 3.58], [5.25, 5.87], [11.73, 12.25], [14.39, 14.83], [17.04, 17.68], [24.97, 25.45], [27.06, 27.58],
  [30.21, 30.74], [39.97, 40.43], [43.57, 44.16], [47.69, 48.15], [53.05, 53.53], [59.18, 59.78], [60.61, 61.13], [62.09, 62.61]]
  .map(([start, end]) => ({ start, end }));

test('splitSentences finds the 17 sentences of the sample narration', () => {
  const s = align.splitSentences(TEXT);
  assert.strictEqual(s.length, 17);
  assert.strictEqual(s[0], 'What if you fell into a black hole?');
  assert.strictEqual(s[16], 'Follow Cosmic What If for more mind-bending science.');
});

test('alignSentences puts every boundary on the measured pause', () => {
  const t = align.alignSentences(align.splitSentences(TEXT), PAUSES, DURATION);
  assert.strictEqual(t.length, 17);
  for (let k = 0; k < 16; k++) {
    assert.ok(Math.abs(t[k].end - PAUSES[k].start) < 0.05, `end of sentence ${k + 1}`);
    assert.ok(Math.abs(t[k + 1].start - PAUSES[k].end) < 0.05, `start of sentence ${k + 2}`);
  }
});

test('align tolerates extra and missing pauses', () => {
  const pauses = PAUSES.filter((_, i) => i !== 3 && i !== 9)       // mất 2 chỗ ngắt câu
    .concat([{ start: 8.6, end: 8.92 }, { start: 21.0, end: 21.32 }, { start: 35.1, end: 35.42 }]) // 3 chỗ lấy hơi giữa câu
    .sort((a, b) => a.start - b.start);
  const t = align.alignSentences(align.splitSentences(TEXT), pauses, DURATION);
  assert.strictEqual(t.length, 17);
  assert.strictEqual(t[16].end, DURATION);
  for (let k = 0; k < 17; k++) {
    assert.ok(t[k].end > t[k].start, `sentence ${k + 1} has positive length`);
    if (k) {
      assert.ok(t[k].start >= t[k - 1].end, 'monotonic');
      assert.ok(t[k].start - t[k - 1].end <= 1.5, 'no big gaps');
    }
  }
});

test('estimateTimings spaces sentences by words at 163 wpm', () => {
  const t = align.estimateTimings(['one two three', 'four five'], 163, 0.35);
  assert.strictEqual(t[0].start, 0);
  assert.ok(Math.abs(t[0].end - 3 * 60 / 163) < 1e-6);
  assert.ok(Math.abs(t[1].start - (t[0].end + 0.35)) < 1e-6);
});
