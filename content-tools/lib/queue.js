// Hàng đợi tác vụ chạy tuần tự (bấm 2 lần cũng không chạy song song), giữ 50 tác vụ gần nhất.
function createQueue(runner, { keep = 50 } = {}) {
  const jobs = [];
  let seq = 0, running = null, idleWaiters = [];

  function next() {
    if (running) return;
    const job = jobs.find(j => j.state === 'queued');
    if (!job) { idleWaiters.forEach(r => r()); idleWaiters = []; return; }
    running = job;
    job.state = 'running'; job.startedAt = Date.now();
    Promise.resolve()
      .then(() => runner(job, (p, msg) => { job.progress = Math.max(0, Math.min(1, p)); if (msg) job.message = msg; }))
      .then(() => { job.state = 'done'; job.progress = 1; })
      .catch(e => { job.state = 'error'; job.message = e.message; })
      .finally(() => {
        job.finishedAt = Date.now(); running = null;
        while (jobs.length > keep && jobs[0].state !== 'queued' && jobs[0].state !== 'running') jobs.shift();
        next();
      });
  }

  return {
    enqueue({ videoId, action }) {
      const job = { id: ++seq, videoId, action, state: 'queued', progress: 0, message: '', createdAt: Date.now() };
      jobs.push(job);
      next();
      return job;
    },
    list: () => jobs.slice(),
    idle: () => (running || jobs.some(j => j.state === 'queued') ? new Promise(r => idleWaiters.push(r)) : Promise.resolve()),
  };
}

module.exports = { createQueue };
