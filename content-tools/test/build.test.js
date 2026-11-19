const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { planBuild } = require('../lib/build');
const { venvPython } = require('../lib/pyenv');

const steps = (o) => ({ script: 'done', images: 'done', review: 'todo', slides: 'done', preview: 'done', voice: 'done', final: 'done', uploaded: 'todo', ...o });

test('a fresh video runs every production step in order', () => {
  const s = steps({ images: 'todo', slides: 'todo', preview: 'todo', voice: 'todo', final: 'todo' });
  assert.deepStrictEqual(planBuild({ steps: s, hasThumbnail: false, hasPackage: false }), ['images', 'slides', 'thumb', 'package', 'preview', 'voice', 'render']);
});

test('finished steps are skipped and stale ones are redone', () => {
  assert.deepStrictEqual(planBuild({ steps: steps({ slides: 'stale', preview: 'stale', final: 'stale' }), hasThumbnail: true, hasPackage: true }), ['slides', 'preview', 'render']);
  assert.deepStrictEqual(planBuild({ steps: steps(), hasThumbnail: true, hasPackage: true }), []);
});

test('a script with errors builds nothing', () => {
  assert.deepStrictEqual(planBuild({ steps: steps({ script: 'error', images: 'todo' }), hasThumbnail: false, hasPackage: false }), []);
});

test('an existing voice is kept, only the final video is rendered', () => {
  assert.deepStrictEqual(planBuild({ steps: steps({ final: 'todo' }), hasThumbnail: true, hasPackage: true }), ['render']);
});

test('venv python path follows the platform', () => {
  assert.strictEqual(venvPython('.venv-tts', 'darwin'), path.resolve(__dirname, '../../.venv-tts/bin/python'));
  assert.strictEqual(venvPython('.venv-tts', 'win32'), path.resolve(__dirname, '../../.venv-tts/Scripts/python.exe'));
});

test('when free sources fail, every photo type ends with an AI illustration', () => {
  const { SOURCE_ORDER } = require('../lib/images');
  for (const t of ['nasa', 'science', 'stock']) assert.strictEqual(SOURCE_ORDER[t].at(-1), 'ai');
});
