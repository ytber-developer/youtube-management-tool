const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateScript } = require('../lib/check');
const { ACTIONS, validateAnim } = require('../lib/animspec');

const OUTRO = 'Follow Cosmic What If for more mind-bending science.';
const filler = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ') + '.';
const animScript = (over = {}) => ({
  channel: 'cosmic-what-if', number: 15, slug: 'x', style: 'anim', target_minutes: 0, title: 'What If?', thumbnail_text: 'WHAT IF',
  description: 'd', tags: [], sources: [{ title: 'a', url: 'https://a' }, { title: 'b', url: 'https://b' }],
  scenes: [
    { narration: 'What if you fell into a black hole?', anim: { action: 'wave', props: [{ icon: 'black-hole', at: 'right' }] } },
    { narration: filler(30), anim: { action: 'point', text: 'EVENT HORIZON' } },
    { narration: OUTRO, visual: { type: 'outro' }, anim: { action: 'wave', outro: true } },
  ],
  ...over,
});

test('an animated script needs no images or headlines, only a valid anim per scene', () => {
  const r = validateScript(animScript());
  assert.deepStrictEqual(r.errors, []);
});

test('unknown actions, prop positions and backgrounds are reported', () => {
  const s = animScript();
  s.scenes[1].anim = { action: 'moonwalk', props: [{ icon: 'x', at: 'nowhere' }], bg: 'mars-base' };
  const r = validateScript(s);
  assert.ok(r.errors.some(e => /moonwalk/.test(e)));
  assert.ok(r.errors.some(e => /nowhere/.test(e)));
  assert.ok(r.errors.some(e => /mars-base/.test(e)));
});

test('a scene without anim in an animated script is an error', () => {
  const s = animScript(); delete s.scenes[1].anim;
  assert.ok(validateScript(s).errors.some(e => /scene 2: missing anim/.test(e)));
});

test('the action list covers the core gestures used by the skill', () => {
  for (const a of ['talk', 'wave', 'point', 'think', 'shocked', 'walk', 'run', 'float', 'fall-toward', 'stretch', 'swallowed', 'hold-breath', 'sleep', 'yawn', 'eat', 'present']) assert.ok(ACTIONS.includes(a), a);
  assert.deepStrictEqual(validateAnim({ action: 'talk' }), []);
});

test('status of an animated video skips images/slides/preview and waits for voice and final', () => {
  const { videoStatus } = require('../lib/status');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-status-'));
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(animScript()));
  const st = videoStatus(dir);
  assert.strictEqual(st.steps.images, 'done');
  assert.strictEqual(st.steps.slides, 'done');
  assert.strictEqual(st.steps.preview, 'done');
  assert.strictEqual(st.steps.voice, 'todo');
  assert.deepStrictEqual(st.missingScenes, []);
  const { planBuild, stateOf } = require('../lib/build');
  assert.deepStrictEqual(planBuild(stateOf(dir)), ['thumb', 'package', 'voice', 'render']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('metadata of an animated video credits the original animation and Fluent Emoji (MIT)', () => {
  const { metadataMarkdown } = require('../lib/pack');
  const md = metadataMarkdown(animScript(), [], { date: '2026-12-07' });
  assert.match(md, /Fluent Emoji/);
  assert.match(md, /MIT/);
});
