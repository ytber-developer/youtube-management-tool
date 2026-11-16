const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const pack = require('../lib/pack');

const DIR = path.resolve(__dirname, '../../content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole');
const script = JSON.parse(fs.readFileSync(path.join(DIR, 'script.json'), 'utf8'));
const credits = [
  { scene: 1, credit: 'NASA/JPL-Caltech', url: 'https://images.nasa.gov/details/PIA16695', source: 'NASA Image and Video Library' },
  { scene: 3, credit: 'NASA/JPL-Caltech', url: 'https://images.nasa.gov/details/PIA25440', source: 'NASA Image and Video Library' },
  { scene: 2, missing: true },
  { scene: 7, type: 'outro' },
];

test('narrationText has one paragraph per scene', () => {
  const txt = pack.narrationText(script);
  assert.strictEqual(txt.split('\n\n').length, script.scenes.length);
  assert.ok(txt.startsWith('What if you fell into a black hole?'));
});

test('metadataMarkdown has title, description, deduplicated credits, tags, post time and voice hint', () => {
  const md = pack.metadataMarkdown(script, credits, { date: '2026-11-23' });
  assert.ok(md.includes(script.title));
  assert.ok(md.includes(script.description.split('\n')[0]));
  assert.ok(md.includes('## Image credits'));
  const section = md.split('## Image credits')[1].split('\n## ')[0];
  assert.strictEqual((section.match(/NASA\/JPL-Caltech/g) || []).length, 1, 'same credit listed once in the credits section');
  assert.ok(md.includes(script.tags.join(', ')));
  assert.ok(md.includes('12:00 PM ET (00:00 giờ VN ngày 2026-11-24)'));
  assert.ok(md.includes('Adam'));
});
