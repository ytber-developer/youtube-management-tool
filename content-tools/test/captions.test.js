const test = require('node:test');
const assert = require('node:assert');
const captions = require('../lib/captions');

test('chunk keeps lines within 40 characters', () => {
  const s = 'But pick a giant, like Sagittarius A* at the center of our galaxy, four million times the mass of the Sun, and the pull is gentle at the edge.';
  const parts = captions.chunk(s);
  assert.ok(parts.length >= 4);
  for (const p of parts) assert.ok(p.length <= 40, p);
  assert.strictEqual(parts.join(' '), s);
});

test('buildCues splits a sentence over its time window in order', () => {
  const cues = captions.buildCues(['Short one.', 'A much longer sentence that will need to be split into more than one caption line.'],
    [{ start: 0, end: 1 }, { start: 1.5, end: 6 }]);
  assert.strictEqual(cues[0].text, 'Short one.');
  assert.ok(cues.length >= 3);
  assert.strictEqual(cues[cues.length - 1].end, 6);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i].start >= cues[i - 1].end - 1e-9);
});

test('toSrt formats timestamps', () => {
  const srt = captions.toSrt([{ start: 2.47, end: 3.2, text: "Let's find out." }]);
  assert.strictEqual(srt, "1\n00:00:02,470 --> 00:00:03,200\nLet's find out.\n");
});
