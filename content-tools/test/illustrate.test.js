const test = require('node:test');
const assert = require('node:assert');
const { pickIcons, keywords, creditFor } = require('../lib/illustrate');

// Tìm kiếm giả: chỉ những từ này có icon
const fake = { runner: ['person-running'], marathon: ['person-running'], water: ['droplet'], race: ['chequered-flag'], heart: ['anatomical-heart', 'red-heart'], doctor: ['health-worker'] };
const search = async (w) => fake[w] || [];

test('keywords drop stop words and keep scene nouns in order', () => {
  assert.deepStrictEqual(keywords('tired marathon runner late in the race'), ['tired', 'marathon', 'runner', 'late', 'race']);
});

test('icons pinned in the script win over search', async () => {
  const r = await pickIcons({ query: 'anything', icons: ['brain', 'zzz'] }, search, async () => true);
  assert.deepStrictEqual(r, { main: 'brain', side: ['zzz'] });
});

test('search picks one distinct icon per keyword, first hit is the main one', async () => {
  const r = await pickIcons({ query: 'marathon runner drinking water bottle race' }, search);
  assert.deepStrictEqual(r, { main: 'person-running', side: ['droplet', 'chequered-flag'] });
});

test('no icon found for any keyword returns null so the scene stays missing', async () => {
  assert.strictEqual(await pickIcons({ query: 'qwerty zzyzx' }, search), null);
});

test('illustrations are credited to Fluent Emoji under MIT', () => {
  const c = creditFor({ main: 'brain', side: ['zzz'] });
  assert.strictEqual(c.license, 'MIT');
  assert.match(c.credit, /Fluent Emoji/);
  assert.strictEqual(c.illustration, true);
});

test('pinned icon names that do not exist are dropped; if none are left, search takes over', async () => {
  const exists = async (n) => ['brain', 'zzz', 'person-running'].includes(n);
  assert.deepStrictEqual(await pickIcons({ icons: ['brain', 'not-an-icon', 'zzz'] }, search, exists), { main: 'brain', side: ['zzz'] });
  assert.deepStrictEqual(await pickIcons({ query: 'runner', icons: ['nope'] }, search, exists), { main: 'person-running', side: [] });
});
