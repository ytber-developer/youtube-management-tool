const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = '2026-11-23/cosmic-what-if__01-fell-into-a-black-hole';
const SRC = path.resolve(__dirname, 'fixtures', ID);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-api-'));
process.env.CONTENT_ROOT = root;
fs.mkdirSync(path.join(root, ID), { recursive: true });
fs.copyFileSync(path.join(SRC, 'script.json'), path.join(root, ID, 'script.json'));

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

test('detail has everything needed to post on YouTube', async () => {
  const r = await fetch(`${base}/${ID}`);
  assert.strictEqual(r.status, 200);
  const d = (await r.json()).data;
  assert.strictEqual(d.title, 'What If You Fell Into a Black Hole?');
  assert.ok(d.description.startsWith('What would actually happen'));
  assert.ok(d.tags.includes('black hole'));
  assert.strictEqual(d.postTime.et, '2026-11-23 12:00 PM ET');
  assert.deepStrictEqual(Object.keys(d.files), ['thumbnail.png', 'final.mp4', 'captions.srt']);
});

test('serves only the upload files, never other files or traversal paths', async () => {
  fs.writeFileSync(path.join(root, ID, 'captions.srt'), '1\n00:00:00,000 --> 00:00:01,000\nhi\n');
  assert.strictEqual((await fetch(`${base}/file/${ID}/captions.srt`)).status, 200);
  for (const url of [`${base}/file/${ID}/script.json`, `${base}/file/${ID}/final.mp4`, `${base}/file/${ID}/..%2F..%2F..%2Fpackage.json`,
    `${base}/file/2026-11-23/..%2F..%2Fpackage.json/thumbnail.png`, `${base}/2026-11-23/..%2Fsrc`]) {
    assert.strictEqual((await fetch(url)).status, 404, url);
  }
});

test('the API is read-only: write routes are gone', async () => {
  for (const [method, url] of [['POST', `${base}/${ID}/actions/build`], ['PUT', `${base}/${ID}/review`], ['POST', `${base}/${ID}/voice`], ['GET', `${base}/jobs`]]) {
    assert.strictEqual((await fetch(url, { method })).status, 404, `${method} ${url}`);
  }
});

test('a malformed script.json does not break the list', async () => {
  const BAD = '2026-11-24/inside-your-body__02-why-do-we-yawn';
  fs.mkdirSync(path.join(root, BAD), { recursive: true });
  fs.writeFileSync(path.join(root, BAD, 'script.json'), JSON.stringify({ title: 'half written' }));
  const r = await fetch(base);
  assert.strictEqual(r.status, 200);
  const bad = (await r.json()).data.find(v => v.id === BAD);
  assert.strictEqual(bad.status.stageKey, 'script');
  assert.strictEqual((await fetch(`${base}/${BAD}`)).status, 200);
});
