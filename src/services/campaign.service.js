/**
 * Campaign Service
 *
 * Task model: cross-product — every account watches every video.
 *   N accounts × M videos = N×M batch
 *   For each video: process batch_size accounts at a time, sequentially.
 *   After all accounts finish video[i] → advance to video[i+1].
 *
 * Campaign statuses:
 *   new     — just created, waiting in queue
 *   running — currently being processed (max 1 at a time)
 *   pending — manually held by user, skipped by cron
 *   done    — completed
 *
 * Cron logic each tick:
 *   1. If any WatchTask is status=running globally → skip (tabs still open)
 *   2. Find the single 'running' campaign → process it
 *   3. If none, promote oldest 'new' campaign → running
 *   4. 'pending' campaigns are never auto-promoted
 */

const cron = require('node-cron');
const WatchCampaign = require('../models/WatchCampaign');
const WatchTask = require('../models/WatchTask');
const { AccountYoutube } = require('../models');
const watchController = require('../controllers/watch.controller');
const { sleep, randomDelay } = require('../helpers/timing.helper');

let cronJob = null;
let isProcessing = false;

// ─── Task generation ──────────────────────────────────────────────────────────

/**
 * 1-to-1: account[i] → video[i % numVideos]
 * 10 accounts, 3 videos → 10 tasks, each account watches exactly 1 video.
 * Consecutive tasks naturally cover all URLs: acc1→v1, acc2→v2, acc3→v3, acc4→v1...
 * No duplicate accounts in a batch → no Chrome profile lock conflicts.
 */
async function generateTasks(campaign) {
  const videoUrls = campaign.video_urls;
  const accountIds = campaign.account_ids;
  const numVideos = videoUrls.length;

  const tasks = accountIds.map((accountId, i) => ({
    campaign_id: campaign.id,
    account_id: accountId,
    video_url: videoUrls[i % numVideos],
    video_index: i % numVideos,
    status: 'pending'
  }));

  await WatchTask.bulkCreate(tasks);
  console.log(`✅ [Campaign ${campaign.id}] Generated ${tasks.length} tasks (${accountIds.length} accounts → ${numVideos} videos, 1-to-1 round-robin)`);
}

// ─── Campaign processor ───────────────────────────────────────────────────────

/**
 * Process next batch for a campaign.
 * Tasks are 1-to-1 (account[i] → video[i % N]), so picking batchSize consecutive
 * pending tasks in id order naturally covers all video URLs without duplicate accounts.
 *
 * Example: 3 videos, 10 accounts, batch_size=3
 *   Batch 1: acc1→v1, acc2→v2, acc3→v3
 *   Batch 2: acc4→v1, acc5→v2, acc6→v3
 *   Batch 3: acc7→v1, acc8→v2, acc9→v3
 *   Batch 4: acc10→v1
 */
async function processCampaign(campaign) {
  const numVideos = campaign.video_urls.length;
  const batchSize = campaign.batch_size || 5;

  const totalPending = await WatchTask.count({
    where: { campaign_id: campaign.id, status: 'pending' }
  });
  if (totalPending === 0) {
    await campaign.update({ status: 'done' });
    console.log(`🏁 [Campaign ${campaign.id}] All tasks done`);
    return;
  }

  // Pick next batchSize pending tasks in creation order — no interleaving needed
  const batch = await WatchTask.findAll({
    where: { campaign_id: campaign.id, status: 'pending' },
    limit: batchSize,
    order: [['id', 'ASC']]
  });

  if (batch.length === 0) return;

  const videoIndicesInBatch = [...new Set(batch.map(t => t.video_index + 1))];
  const doneCount = await WatchTask.count({ where: { campaign_id: campaign.id, status: 'done' } });
  const total = await WatchTask.count({ where: { campaign_id: campaign.id } });
  console.log(`\n🚀 [Campaign ${campaign.id}] Batch: ${batch.length} tabs — videos [${videoIndicesInBatch.join(', ')}/${numVideos}] — progress ${doneCount}/${total}`);

  await WatchTask.update(
    { status: 'running', started_at: new Date() },
    { where: { id: batch.map(t => t.id) } }
  );

  const accountIds = batch.map(t => t.account_id);
  const accounts = await AccountYoutube.findAll({ where: { id: accountIds } });
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  const options = campaign.options || {};
  const durationSeconds = (campaign.watch_duration_minutes || 5) * 60;

  const watchOptions = {
    humanBehavior: options.humanBehavior !== false,
    randomDuration: false,
    autoLike: !!options.autoLike,
    autoSubscribe: !!options.autoSubscribe,
    autoComment: !!options.autoComment
  };

  // Stagger task starts: each account waits a random offset before launching.
  // Prevents N views hitting the same video at the exact same second,
  // which YouTube flags as an unnatural spike.
  const STAGGER_MIN_MS = 15_000; // 15s
  const STAGGER_MAX_MS = 60_000; // 60s

  const promises = batch.map((task, index) => {
    const account = accountMap[task.account_id] || null;
    const startDelay = index === 0 ? 0 : randomDelay(STAGGER_MIN_MS, STAGGER_MAX_MS) * index;
    return sleep(startDelay)
      .then(() => watchController.watchInSingleTab(task.video_url, durationSeconds, account, task.id, watchOptions, null))
      .then(async (result) => {
        await task.update({
          status: 'done',
          finished_at: new Date(),
          actual_duration_seconds: result.actualDuration || 0
        });
        const label = account ? account.email : `acc#${task.account_id}`;
        console.log(`✅ [Campaign ${campaign.id}] ${label} video[${task.video_index}] → ${result.actualDuration || 0}s`);
      })
      .catch(async (err) => {
        await task.update({ status: 'done', finished_at: new Date(), actual_duration_seconds: 0 });
        console.warn(`⚠️  [Campaign ${campaign.id}] Task ${task.id} interrupted (${err.message}) — marked done`);
      });
  });

  await Promise.allSettled(promises);
  console.log(`✅ [Campaign ${campaign.id}] Batch done\n`);
}

// ─── Cron tick ────────────────────────────────────────────────────────────────

async function cronTick() {
  if (isProcessing) {
    console.log('⏭️  [Cron] Previous tick still running, skipping');
    return;
  }

  isProcessing = true;

  try {
    // If any task is still running globally (e.g. Chrome tabs still open), skip
    const globalRunning = await WatchTask.count({ where: { status: 'running' } });
    if (globalRunning > 0) {
      console.log(`⏳ [Cron] ${globalRunning} task(s) still running globally — skipping tick`);
      return;
    }

    // Find the single active running campaign
    let campaign = await WatchCampaign.findOne({ where: { status: 'running' } });

    // No running campaign — promote oldest 'new' to running
    if (!campaign) {
      const next = await WatchCampaign.findOne({
        where: { status: 'new' },
        order: [['createdAt', 'ASC']]
      });
      if (!next) return; // nothing queued

      await next.update({ status: 'running' });
      campaign = await WatchCampaign.findByPk(next.id);
      console.log(`\n▶️  [Cron] Starting campaign ${campaign.id} "${campaign.name}"`);
    }

    console.log(`\n⏰ [Cron] Processing campaign ${campaign.id} "${campaign.name}"`);
    await processCampaign(campaign);

  } catch (err) {
    console.error('❌ [Cron] Error:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Called once on server startup.
 * If the server crashed mid-run, tasks stuck in 'running' will block the cron forever.
 * Reset them back to 'pending' so they get retried in the next tick.
 */
async function recoverStuckTasks() {
  const stuckTasks = await WatchTask.count({ where: { status: 'running' } });
  if (stuckTasks === 0) return;

  await WatchTask.update(
    { status: 'pending', started_at: null },
    { where: { status: 'running' } }
  );
  console.log(`♻️  [Recovery] Reset ${stuckTasks} stuck task(s) → pending`);
}

function startCron() {
  if (cronJob) return;
  cronJob = cron.schedule('*/5 * * * *', cronTick);
  console.log('✅ Campaign cron started (every 5 minutes)');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create campaign with status 'new' (queued, not auto-started).
 */
async function createCampaign({ name, videoUrls, accountIds, options = {}, watchDurationMinutes = 5 }) {
  const batchSize = Math.min(videoUrls.length, 5);
  const campaign = await WatchCampaign.create({
    name,
    video_urls: videoUrls,
    account_ids: accountIds,
    batch_size: batchSize,
    watch_duration_minutes: watchDurationMinutes,
    options,
    status: 'new',
    current_video_index: 0
  });

  await generateTasks(campaign);
  return campaign;
}

/**
 * Get campaign with full progress: per-video + per-account task details.
 */
async function getCampaignProgress(id) {
  const campaign = await WatchCampaign.findByPk(id);
  if (!campaign) return null;

  const videoUrls = campaign.video_urls;

  const allTasks = await WatchTask.findAll({
    where: { campaign_id: id },
    order: [['video_index', 'ASC'], ['id', 'ASC']]
  });

  const accountIds = [...new Set(allTasks.map(t => t.account_id))];
  const accounts = await AccountYoutube.findAll({
    where: { id: accountIds },
    attributes: ['id', 'email', 'channel_name']
  });
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  const batchByVideo = {};
  for (const task of allTasks) {
    if (!batchByVideo[task.video_index]) batchByVideo[task.video_index] = [];
    batchByVideo[task.video_index].push(task);
  }

  const videoProgress = videoUrls.map((url, idx) => {
    const batch = batchByVideo[idx] || [];
    const done = batch.filter(t => t.status === 'done').length;
    const failed = batch.filter(t => t.status === 'failed').length;
    const running = batch.filter(t => t.status === 'running').length;
    const total = batch.length;
    const totalWatchSeconds = batch.reduce((sum, t) => sum + (t.actual_duration_seconds || 0), 0);

    const taskDetails = batch.map(t => {
      const acc = accountMap[t.account_id];
      return {
        taskId: t.id,
        accountId: t.account_id,
        email: acc ? acc.email : `acc#${t.account_id}`,
        channelName: acc ? acc.channel_name : null,
        status: t.status,
        actualDurationSeconds: t.actual_duration_seconds || 0,
        error: t.error || null,
        startedAt: t.started_at,
        finishedAt: t.finished_at
      };
    });

    return {
      url,
      index: idx,
      total,
      done,
      failed,
      running,
      pending: total - done - failed - running,
      totalWatchSeconds,
      tasks: taskDetails
    };
  });

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'done').length;
  const failedTasks = allTasks.filter(t => t.status === 'failed').length;
  const runningTasks = allTasks.filter(t => t.status === 'running').length;
  const totalWatchSeconds = allTasks.reduce((sum, t) => sum + (t.actual_duration_seconds || 0), 0);

  return {
    ...campaign.toJSON(),
    totalTasks,
    doneTasks,
    failedTasks,
    runningTasks,
    pendingTasks: totalTasks - doneTasks - failedTasks - runningTasks,
    totalWatchSeconds,
    videoProgress
  };
}

async function updateCampaignStatus(id, status) {
  const campaign = await WatchCampaign.findByPk(id);
  if (!campaign) throw new Error('Campaign not found');
  await campaign.update({ status });
  return campaign;
}

module.exports = { startCron, recoverStuckTasks, createCampaign, getCampaignProgress, updateCampaignStatus };
