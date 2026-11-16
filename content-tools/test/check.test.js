const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { validateScript } = require('../lib/check');

const FIXTURE = path.resolve(__dirname, '../../content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole/script.json');
const base = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const errs = (s) => validateScript(s).errors;

test('the approved black-hole script is valid', () => {
  const r = validateScript(base());
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.target, 179); // target_minutes 1.1 × 163 wpm
});

test('word count outside ±7% is an error', () => {
  const s = base();
  s.scenes[1].narration += ' ' + 'extra '.repeat(40);
  assert.ok(errs(s).some(e => /words/.test(e)));
});

test('a middle scene over 60 words is an error', () => {
  const s = base(); s.target_minutes = 1.3;
  s.scenes[2].narration = 'word '.repeat(61).trim();
  assert.ok(errs(s).some(e => /scene 3/.test(e) && /60/.test(e)));
});

test('a hook over 25 words is an error', () => {
  const s = base();
  s.scenes[0].narration = 'word '.repeat(26).trim();
  assert.ok(errs(s).some(e => /scene 1/.test(e) && /25/.test(e)));
});

test('last scene must be the exact channel outro', () => {
  const s = base();
  s.scenes[s.scenes.length - 1].narration = 'Thanks for watching.';
  assert.ok(errs(s).some(e => /outro/.test(e)));
});

test('headline over 6 words or without exactly one <em> is an error', () => {
  const s = base();
  s.scenes[1].headline = 'ONE TWO THREE FOUR FIVE SIX <em>SEVEN</em>';
  s.scenes[2].headline = 'NO HIGHLIGHT HERE';
  const e = errs(s);
  assert.ok(e.some(x => /scene 2/.test(x) && /headline/.test(x)));
  assert.ok(e.some(x => /scene 3/.test(x) && /<em>/.test(x)));
});

test('digits in narration are a warning (4-digit years allowed)', () => {
  const s = base();
  s.scenes[1].narration = s.scenes[1].narration.replace('even light', 'even light in 2019 and 5 cases');
  const r = validateScript(s);
  assert.ok(r.warnings.some(w => /digit/.test(w) && /5/.test(w)));
  assert.ok(!r.warnings.some(w => /2019/.test(w)));
});

test('missing visual is an error', () => {
  const s = base(); delete s.scenes[2].visual;
  assert.ok(errs(s).some(e => /scene 3/.test(e) && /visual/.test(e)));
});

test('body channel needs the medical disclaimer at the end of the description', () => {
  const s = base();
  s.channel = 'inside-your-body';
  s.scenes[s.scenes.length - 1].narration = 'Follow Inside Your Body for more of the science of you.';
  assert.ok(errs(s).some(e => /disclaimer/.test(e)));
  s.description += '\n\nThis video is for educational purposes only and is not medical advice.';
  assert.ok(!errs(s).some(e => /disclaimer/.test(e)));
});

test('fewer than 2 sources is an error', () => {
  const s = base(); s.sources = s.sources.slice(0, 1);
  assert.ok(errs(s).some(e => /sources/.test(e)));
});
