const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-root-'));
process.env.CONTENT_ROOT = root;
const paths = require('../lib/paths');

const ID = '2026-11-23/cosmic-what-if__01-fell-into-a-black-hole';

test('isValidId accepts real ids and rejects traversal or unknown channels', () => {
  assert.strictEqual(paths.isValidId(ID), true);
  assert.strictEqual(paths.isValidId('../etc'), false);
  assert.strictEqual(paths.isValidId('2026-11-23/other__01-x'), false);
  assert.strictEqual(paths.isValidId('2026-11-23/cosmic-what-if__01-x/../..'), false);
});

test('resolveVideoDir returns null for invalid or missing ids and the dir when it exists', () => {
  assert.strictEqual(paths.resolveVideoDir('2026-11-23/../../src'), null);
  assert.strictEqual(paths.resolveVideoDir(ID), null);
  fs.mkdirSync(path.join(root, ID), { recursive: true });
  assert.strictEqual(paths.resolveVideoDir(ID), path.join(root, ID));
});

test('listVideoIds lists existing video folders sorted by date then channel', () => {
  fs.mkdirSync(path.join(root, '2026-11-24/cosmic-what-if__02-moon-disappeared'), { recursive: true });
  fs.mkdirSync(path.join(root, '2026-11-23/inside-your-body__01-hold-your-breath'), { recursive: true });
  fs.mkdirSync(path.join(root, '2026-11-23/not-a-video'), { recursive: true });
  assert.deepStrictEqual(paths.listVideoIds(), [
    ID,
    '2026-11-23/inside-your-body__01-hold-your-breath',
    '2026-11-24/cosmic-what-if__02-moon-disappeared',
  ]);
});
