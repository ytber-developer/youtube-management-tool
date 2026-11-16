const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = path.resolve(__dirname, '../../content/2026-11-23/cosmic-what-if__01-fell-into-a-black-hole');
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
