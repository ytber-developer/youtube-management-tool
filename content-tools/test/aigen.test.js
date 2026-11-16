const test = require('node:test');
const assert = require('node:assert');
const { buildPrompt, creditFor } = require('../lib/aigen');

const scene = { narration: 'Most runners slow down near mile twenty.', visual: { type: 'stock', query: 'tired marathon runner late in race', note: 'runner on a city street' } };

test('prompt asks for a text-free flat illustration of the scene in the channel palette', () => {
  const p = buildPrompt(scene, 'inside-your-body');
  assert.match(p, /illustration/i);
  assert.match(p, /tired marathon runner late in race/);
  assert.match(p, /runner on a city street/);
  assert.match(p, /no text/i);
  assert.match(p, /teal/i);
  assert.match(buildPrompt(scene, 'cosmic-what-if'), /purple/i);
});

test('AI images are credited as AI-generated illustrations', () => {
  const c = creditFor({ scene: 3, prompt: 'x', seed: 1003 });
  assert.strictEqual(c.source, 'AI illustration (Z-Image-Turbo, generated locally)');
  assert.match(c.credit, /AI-generated illustration/);
  assert.strictEqual(c.ai, true);
});

test('science and space scenes are drawn as symbolic illustrations without anatomical labels', () => {
  const p = buildPrompt({ visual: { type: 'science', query: 'human heart anatomical illustration' } }, 'inside-your-body');
  assert.match(p, /symbolic/i);
  assert.match(p, /no labels/i);
  assert.doesNotMatch(buildPrompt(scene, 'inside-your-body'), /symbolic/i);
});
