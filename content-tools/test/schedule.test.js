const test = require('node:test');
const assert = require('node:assert');
const schedule = require('../lib/schedule');

test('dateFor maps video number to publish date starting 2026-11-23', () => {
  assert.strictEqual(schedule.dateFor(1), '2026-11-23');
  assert.strictEqual(schedule.dateFor(14), '2026-12-06');
});

test('build groups both channels on the same date, sorted', () => {
  const s = schedule.build([
    { channel: 'inside-your-body', number: 1, slug: 'hold-your-breath', title: 'B1' },
    { channel: 'cosmic-what-if', number: 2, slug: 'moon-disappeared', title: 'C2' },
    { channel: 'cosmic-what-if', number: 1, slug: 'fell-into-a-black-hole', title: 'C1' },
  ]);
  assert.deepStrictEqual(s.map(d => d.date), ['2026-11-23', '2026-11-24']);
  assert.deepStrictEqual(s[0].videos.map(v => v.id), [
    '2026-11-23/cosmic-what-if__01-fell-into-a-black-hole',
    '2026-11-23/inside-your-body__01-hold-your-breath',
  ]);
  assert.strictEqual(s[1].videos[0].title, 'C2');
});
