const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = '2026-11-23/cosmic-what-if__01-fell-into-a-black-hole';
const SRC = path.resolve(__dirname, '../../content', ID);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-api-'));
process.env.CONTENT_ROOT = root;
fs.mkdirSync(path.join(root, ID), { recursive: true });
fs.copyFileSync(path.join(SRC, 'script.json'), path.join(root, ID, 'script.json'));
fs.writeFileSync(path.join(root, ID, 'narration.txt'), 'hello');

const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/v1/content', require('../../src/routes/v1/content.routes'));
let server, base;

test.before(() => new Promise(r => { server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}/api/v1/content`; r(); }); }));
test.after(() => new Promise(r => server.close(r)));

test('lists videos with status', async () => {
  const r = await fetch(base);
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  assert.strictEqual(body.data.length, 1);
  assert.strictEqual(body.data[0].id, ID);
  assert.ok(body.data[0].status.steps);
  assert.strictEqual(body.data[0].title, 'What If You Fell Into a Black Hole?');
});

test('serves files inside the video folder only', async () => {
  const ok = await fetch(`${base}/file/${ID}/narration.txt`);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(await ok.text(), 'hello');
});

test('rejects traversal ids', async () => {
  for (const url of [`${base}/file/2026-11-23/..%2F..%2Fpackage.json`, `${base}/file/${ID}/..%2F..%2F..%2Fpackage.json`, `${base}/2026-11-23/..%2Fsrc`]) {
    const r = await fetch(url);
    assert.strictEqual(r.status, 404, url);
  }
});

test('voice upload rejects non-mp3', async () => {
  const fd = new FormData();
  fd.append('voice', new Blob(['not audio'], { type: 'text/plain' }), 'notes.txt');
  const r = await fetch(`${base}/${ID}/voice`, { method: 'POST', body: fd });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(fs.existsSync(path.join(root, ID, 'voice.mp3')), false);
});

test('review endpoint stores imagesReviewed and uploadedUrl', async () => {
  const r = await fetch(`${base}/${ID}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagesReviewed: true, uploadedUrl: 'https://youtu.be/x' }) });
  assert.strictEqual(r.status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(root, ID, 'review.json'), 'utf8'));
  assert.deepStrictEqual(saved, { imagesReviewed: true, uploadedUrl: 'https://youtu.be/x' });
});

test('unknown action is rejected', async () => {
  const r = await fetch(`${base}/${ID}/actions/rm-rf`, { method: 'POST' });
  assert.strictEqual(r.status, 400);
});

test('a malformed script.json does not break the list or its detail page', async () => {
  const BAD = '2026-11-24/inside-your-body__02-why-do-we-yawn';
  fs.mkdirSync(path.join(root, BAD), { recursive: true });
  fs.writeFileSync(path.join(root, BAD, 'script.json'), JSON.stringify({ title: 'half written' }));
  const r = await fetch(base);
  assert.strictEqual(r.status, 200);
  const bad = (await r.json()).data.find(v => v.id === BAD);
  assert.strictEqual(bad.status.stageKey, 'script');
  const d = await fetch(`${base}/${BAD}`);
  assert.strictEqual(d.status, 200);
  const body = (await d.json()).data;
  assert.deepStrictEqual([body.script.scenes, body.script.tags, body.script.sources], [[], [], []]);
});

test('a non-audio file renamed to .mp3 is rejected and the existing voice is kept', async () => {
  const voice = path.join(root, ID, 'voice.mp3');
  fs.writeFileSync(voice, 'GOOD-VOICE');
  const fd = new FormData();
  fd.append('voice', new Blob(['this is a text file, not audio'], { type: 'audio/mpeg' }), 'fake.mp3');
  const r = await fetch(`${base}/${ID}/voice`, { method: 'POST', body: fd });
  assert.strictEqual(r.status, 400);
  assert.match((await r.json()).message, /âm thanh/);
  assert.strictEqual(fs.readFileSync(voice, 'utf8'), 'GOOD-VOICE');
  assert.deepStrictEqual(fs.readdirSync(path.join(root, ID)).filter(f => f.includes('.part')), []);
  fs.rmSync(voice);
});

test('a real wav recording is converted to voice.mp3', async () => {
  const wav = path.join(root, 'tone.wav');
  require('child_process').execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', wav]);
  const fd = new FormData();
  fd.append('voice', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), 'take1.wav');
  const r = await fetch(`${base}/${ID}/voice`, { method: 'POST', body: fd });
  assert.strictEqual(r.status, 200);
  assert.ok(fs.statSync(path.join(root, ID, 'voice.mp3')).size > 1000);
  assert.strictEqual(fs.existsSync(path.join(root, ID, 'voice.part.mp3')), false);
});
