const test = require('node:test');
const assert = require('node:assert');
const { allowedLicense, matchScore } = require('../lib/images');

test('allowedLicense accepts only PD, CC0 and CC BY', () => {
  for (const ok of ['Public domain', 'CC0', 'CC BY 2.0', 'CC BY 4.0', 'Public Domain Mark']) assert.strictEqual(allowedLicense(ok), true, ok);
  for (const bad of ['CC BY-SA 4.0', 'CC BY-NC 2.0', 'CC BY-ND', 'GFDL', 'CC BY-NC-SA 3.0', '']) assert.strictEqual(allowedLicense(bad), false, bad);
});

test('matchScore keeps on-topic photos and rejects off-topic ones', () => {
  assert.ok(matchScore('person yawning', 'Woman yawning while reading a book') >= 0.5);
  assert.strictEqual(matchScore('puffed cheeks', 'Early Medieval Coin: Sceat of Series BII'), 0);
});

test('each visual type tries its free sources in order, NASA falls back to Commons, all end with AI', () => {
  const { SOURCE_ORDER } = require('../lib/images');
  assert.deepStrictEqual(SOURCE_ORDER.nasa, ['clip', 'nasa', 'commons', 'emoji', 'ai']);
  assert.deepStrictEqual(SOURCE_ORDER.science, ['clip', 'commons', 'commons-relaxed', 'openverse', 'emoji', 'ai']);
  assert.deepStrictEqual(SOURCE_ORDER.stock, ['pixabay', 'clip', 'openverse', 'emoji', 'ai']);
});

test('a scene pinned to a Commons file or Openverse id uses that pin before any search', () => {
  const { pinOf } = require('../lib/images');
  assert.deepStrictEqual(pinOf({ type: 'stock', commons: 'File:Goose bumps.jpg' }), { source: 'commons', id: 'File:Goose bumps.jpg' });
  assert.deepStrictEqual(pinOf({ type: 'stock', openverse_id: 'abc-123' }), { source: 'openverse', id: 'abc-123' });
  assert.deepStrictEqual(pinOf({ type: 'nasa', nasa_id: 'PIA1' }), { source: 'nasa', id: 'PIA1' });
  assert.strictEqual(pinOf({ type: 'stock', query: 'x' }), null);
});
