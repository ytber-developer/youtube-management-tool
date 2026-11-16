const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { buildJob } = require('../lib/tts');
const { sceneSentences } = require('../lib/video');

const script = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole/script.json'), 'utf8'));

test('buildJob reads every scene as the same sentences the caption aligner expects', () => {
  const job = buildJob(script, '/tmp/v.wav');
  assert.strictEqual(job.scenes.length, script.scenes.length);
  assert.deepStrictEqual(job.scenes.flat(), sceneSentences(script).map(s => s.text));
});

test('buildJob uses the channel voice unless one is given', () => {
  assert.strictEqual(buildJob(script, '/tmp/v.wav').voice, 'am_michael');
  assert.strictEqual(buildJob({ ...script, channel: 'inside-your-body' }, '/tmp/v.wav').voice, 'af_heart');
  assert.strictEqual(buildJob(script, '/tmp/v.wav', { voice: 'am_fenrir', speed: 0.95 }).voice, 'am_fenrir');
});
