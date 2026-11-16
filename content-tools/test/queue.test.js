const test = require('node:test');
const assert = require('node:assert');
const { createQueue } = require('../lib/queue');

test('queue runs jobs serially and records progress and results', async () => {
  let running = 0, maxRunning = 0;
  const q = createQueue(async (job, onProgress) => {
    running++; maxRunning = Math.max(maxRunning, running);
    onProgress(0.5, 'half');
    await new Promise(r => setTimeout(r, 50));
    running--;
    if (job.action === 'boom') throw new Error('failed on purpose');
    return 'ok';
  });
  const a = q.enqueue({ videoId: 'v1', action: 'slides' });
  const b = q.enqueue({ videoId: 'v1', action: 'slides' });
  const c = q.enqueue({ videoId: 'v2', action: 'boom' });
  assert.strictEqual(a.state, 'running');
  assert.strictEqual(b.state, 'queued');
  await q.idle();
  assert.strictEqual(maxRunning, 1);
  assert.deepStrictEqual([a.state, b.state, c.state], ['done', 'done', 'error']);
  assert.strictEqual(a.progress, 1);
  assert.match(c.message, /failed on purpose/);
  assert.strictEqual(q.list().length, 3);
});
