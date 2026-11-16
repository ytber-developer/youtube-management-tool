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
