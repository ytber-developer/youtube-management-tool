const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = path.resolve(__dirname, 'fixtures/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-status-'));
process.env.CONTENT_ROOT = root;
const { videoStatus } = require('../lib/status');

function fixture() {
  const dir = fs.mkdtempSync(path.join(root, 'v-'));
  fs.copyFileSync(path.join(SRC, 'script.json'), path.join(dir, 'script.json'));
  fs.mkdirSync(path.join(dir, 'images')); fs.mkdirSync(path.join(dir, 'slides'));
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  script.scenes.forEach((s, i) => {
    const n = String(i + 1).padStart(2, '0');
    if (s.visual.type !== 'outro') fs.writeFileSync(path.join(dir, 'images', `scene${n}.jpg`), 'x');
    fs.writeFileSync(path.join(dir, 'slides', `scene${n}.png`), 'x');
  });
  return { dir, script };
}
const age = (file, secondsAgo) => { const t = Date.now() / 1000 - secondsAgo; fs.utimesSync(file, t, t); };

test('complete images and fresh slides are done; next stage is preview', () => {
  const { dir } = fixture();
  age(path.join(dir, 'script.json'), 100);
  for (const f of fs.readdirSync(path.join(dir, 'images'))) age(path.join(dir, 'images', f), 100); // ảnh có trước slide
  const s = videoStatus(dir);
  assert.strictEqual(s.steps.script, 'done');
  assert.strictEqual(s.steps.images, 'done');
  assert.strictEqual(s.steps.slides, 'done');
  assert.strictEqual(s.steps.preview, 'todo');
  assert.strictEqual(s.imagesHave, s.imagesNeed);
});

test('a missing slide makes slides todo and a missing image is reported by scene', () => {
  const { dir } = fixture();
  fs.rmSync(path.join(dir, 'slides', 'scene03.png'));
  fs.rmSync(path.join(dir, 'images', 'scene02.jpg'));
  const s = videoStatus(dir);
  assert.strictEqual(s.steps.slides, 'todo');
  assert.strictEqual(s.steps.images, 'todo');
  assert.deepStrictEqual(s.missingScenes, [2]);
});

test('slides stale when script newer', () => {
  const { dir } = fixture();
  for (const f of fs.readdirSync(path.join(dir, 'slides'))) age(path.join(dir, 'slides', f), 100);
  fs.utimesSync(path.join(dir, 'script.json'), new Date(), new Date());
  assert.strictEqual(videoStatus(dir).steps.slides, 'stale');
});

test('review.json drives imagesReviewed and uploaded', () => {
  const { dir } = fixture();
  fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify({ imagesReviewed: true, uploadedUrl: 'https://youtu.be/abc' }));
  const s = videoStatus(dir);
  assert.strictEqual(s.steps.review, 'done');
  assert.strictEqual(s.steps.uploaded, 'done');
  assert.strictEqual(s.uploadedUrl, 'https://youtu.be/abc');
});

test('a script.json without scenes reports a script error instead of throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-bad-'));
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify({ title: 'x' }));
  const s = videoStatus(dir);
  assert.equal(s.steps.script, 'error');
  assert.equal(s.stageKey, 'script');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('animated videos need no image review: script + voice + final → waiting to upload', () => {
  const { dir } = fixture();
  const p = path.join(dir, 'script.json');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  s.style = 'anim';
  fs.writeFileSync(p, JSON.stringify(s));
  const st = videoStatus(dir);
  assert.strictEqual(st.steps.review, 'done');
  assert.ok(['script', 'voice', 'final'].includes(st.stageKey), st.stageKey);
});

test('the voice goes stale only when the narration changes, not on other script edits', () => {
  const { dir, script } = fixture();
  fs.writeFileSync(path.join(dir, 'voice.mp3'), 'x');
  assert.strictEqual(videoStatus(dir).steps.voice, 'done', 'hand-made voice without voice.txt counts as current');
  fs.writeFileSync(path.join(dir, 'voice.txt'), require('../lib/pack').narrationText(script) + '\n');
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify({ ...script, title: 'New title', tags: ['x'] }));
  assert.strictEqual(videoStatus(dir).steps.voice, 'done');
  script.scenes[1].narration += ' One more sentence.';
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify(script));
  assert.strictEqual(videoStatus(dir).steps.voice, 'stale');
});
