const test = require('node:test');
const assert = require('node:assert');
const { chooseBest, MIN_SCORE, clipText } = require('../lib/clip');

const c = (id, score, w = 1600, h = 900) => ({ id, score, w, h });

test('the best-scoring landscape candidate above the threshold wins', () => {
  assert.strictEqual(chooseBest([c('a', 0.27), c('b', 0.31), c('c', 0.29)]).id, 'b');
});

test('nothing above the threshold means no pick (the scene falls back to an illustration)', () => {
  assert.strictEqual(chooseBest([c('a', MIN_SCORE - 0.01), c('b', 0.1)]), null);
});

test('portrait or small images are penalised against a similar landscape one', () => {
  assert.strictEqual(chooseBest([c('tall', 0.30, 800, 1200), c('wide', 0.295, 1600, 900)]).id, 'wide');
  assert.strictEqual(chooseBest([c('tiny', 0.30, 500, 300), c('big', 0.295, 1920, 1080)]).id, 'big');
});

test('the CLIP text combines query and note and stays short', () => {
  const t = clipText({ query: 'tired marathon runner late in race', note: 'runner on a city street' });
  assert.match(t, /tired marathon runner/);
  assert.match(t, /city street/);
  assert.ok(t.split(' ').length <= 40);
});

test('search queries start with the full query then add short keyword variants, without duplicates', () => {
  const { queryVariants } = require('../lib/clip');
  assert.deepStrictEqual(queryVariants('goosebumps on arm close up'), ['goosebumps on arm close up', 'goosebumps arm', 'goosebumps']);
  assert.deepStrictEqual(queryVariants('rhinovirus'), ['rhinovirus']);
});

test('a candidate that looks more like something to avoid (text poster, smoking...) than the scene is rejected', () => {
  const pick = chooseBest([{ id: 'boardgame', score: 0.31, neg: 0.33, w: 1600, h: 900 }, { id: 'arm', score: 0.29, neg: 0.20, w: 1600, h: 900 }]);
  assert.strictEqual(pick.id, 'arm');
  assert.strictEqual(chooseBest([{ id: 'smoke', score: 0.28, neg: 0.30, w: 1600, h: 900 }]), null);
});

test('science scenes may keep labelled diagrams, other scenes avoid charts', () => {
  const { negativesFor } = require('../lib/clip');
  assert.ok(negativesFor('stock').some(t => /chart/.test(t)));
  assert.ok(!negativesFor('science').some(t => /chart/.test(t)));
  for (const t of ['stock', 'science', 'nasa']) assert.ok(negativesFor(t).some(x => /smoking/.test(x)));
});

test('each scene also avoids images that merely show its keywords written as text', () => {
  const { negativesFor } = require('../lib/clip');
  assert.ok(negativesFor('stock', 'goosebumps on arm close up').some(t => /"goosebumps arm"/.test(t) && /letters/.test(t)));
});
