/**
 * Campaign Service
 * Manages watch campaigns with sequential video processing.
 * Cron runs every 5 minutes — picks 3 pending tasks for current video,
 * runs them concurrently, then advances to next video when all done.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const WatchCampaign = require('../models/WatchCampaign');
const WatchTask = require('../models/WatchTask');
const { AccountYoutube } = require('../models');
const watchController = require('../controllers/watch.controller');

const BATCH_SIZE = 3;
const MAX_DURATION = 120; // 2 minutes max

let cronJob = null;
let isProcessing = false;

/**
 * Generate tasks for a campaign (account × video cross product, sequential by video)
 */
async function generateTasks(campaign) {
  const videoUrls = campaign.video_urls;
  const accountIds = campaign.account_ids;

  const tasks = [];
  for (let vIdx = 0; vIdx < videoUrls.length; vIdx++) {
    for (const accountId of accountIds) {
      tasks.push({
        campaign_id: campaign.id,
        account_id: accountId,
        video_url: videoUrls[vIdx],
        video_index: vIdx,
        status: 'pending'
      });
    }
  }

  await WatchTask.bulkCreate(tasks);
  console.log(`✅ [Campaign ${campaign.id}] Generated ${tasks.length} tasks (${videoUrls.length} videos × ${accountIds.length} accounts)`);
}

/**
 * Process one batch for a running campaign
 */
async function processCampaign(campaign) {
  const videoUrls = campaign.video_urls;
  const currentIdx = campaign.current_video_index;

  // Safety: campaign already finished
  if (currentIdx >= videoUrls.length) {
    await campaign.update({ status: 'done' });
    console.log(`🏁 [Campaign ${campaign.id}] All videos done`);
    return;
  }

  // Check if any tasks for current video are still running
  const runningCount = await WatchTask.count({
    where: { campaign_id: campaign.id, video_index: currentIdx, status: 'running' }
  });
  if (runningCount > 0) {
    console.log(`⏳ [Campaign ${campaign.id}] Video ${currentIdx + 1} — ${runningCount} tasks still running, skipping tick`);
    return;
  }

  // Check if all tasks for current video are done/failed
  const pendingCount = await WatchTask.count({
    where: { campaign_id: campaign.id, video_index: currentIdx, status: 'pending' }
  });

  if (pendingCount === 0) {
    // Advance to next video
    const nextIdx = currentIdx + 1;
    if (nextIdx >= videoUrls.length) {
      await campaign.update({ status: 'done', current_video_index: nextIdx });
      console.log(`🏁 [Campaign ${campaign.id}] Completed all ${videoUrls.length} videos`);
    } else {
      await campaign.update({ current_video_index: nextIdx });
      console.log(`➡️  [Campaign ${campaign.id}] Advancing to video ${nextIdx + 1}/${videoUrls.length}`);
    }
    return;
  }

  // Pick next batch of pending tasks
  const tasks = await WatchTask.findAll({
    where: { campaign_id: campaign.id, video_index: currentIdx, status: 'pending' },
    limit: BATCH_SIZE,
    order: [['id', 'ASC']]
  });

  if (tasks.length === 0) return;

  console.log(`\n🚀 [Campaign ${campaign.id}] Video ${currentIdx + 1}/${videoUrls.length}: running ${tasks.length} tasks...`);

  // Mark as running
  await WatchTask.update(
    { status: 'running', started_at: new Date() },
    { where: { id: tasks.map(t => t.id) } }
  );

  // Fetch accounts for these tasks
  const accountIds = tasks.map(t => t.account_id);
  const accounts = await AccountYoutube.findAll({ where: { id: accountIds } });
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  const options = campaign.options || {};
  const duration = Math.min(campaign.max_duration, MAX_DURATION);

  const watchOptions = {
    humanBehavior: options.humanBehavior !== false,
    randomDuration: false,
    autoLike: !!options.autoLike,
    autoSubscribe: !!options.autoSubscribe,
    autoComment: !!options.autoComment
  };

  // Run batch concurrently
  const promises = tasks.map(task => {
    const account = accountMap[task.account_id] || null;
    return watchController.watchInSingleTab(task.video_url, duration, account, task.id, watchOptions, null)
      .then(async (result) => {
        await task.update({
          status: result.success ? 'done' : 'failed',
          error: result.error || null,
          finished_at: new Date()
        });
        console.log(`${result.success ? '✅' : '❌'} [Campaign ${campaign.id}] Task ${task.id} (account ${task.account_id}) → ${result.success ? 'done' : result.error}`);
      })
      .catch(async (err) => {
        await task.update({ status: 'failed', error: err.message, finished_at: new Date() });
        console.error(`❌ [Campaign ${campaign.id}] Task ${task.id} error: ${err.message}`);
      });
  });

  await Promise.allSettled(promises);
  console.log(`✅ [Campaign ${campaign.id}] Batch done\n`);
}

/**
 * Main cron tick — runs every 5 minutes
 */
async function cronTick() {
  if (isProcessing) {
    console.log('⏭️  [Cron] Previous tick still running, skipping');
    return;
  }

  isProcessing = true;

  try {
    const runningCampaigns = await WatchCampaign.findAll({
      where: { status: 'running' }
    });

    if (runningCampaigns.length === 0) return;

    console.log(`\n⏰ [Cron] Tick — ${runningCampaigns.length} active campaign(s)`);

    for (const campaign of runningCampaigns) {
      await processCampaign(campaign);
    }
  } catch (err) {
    console.error('❌ [Cron] Error:', err.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the cron job (called once on server startup)
 */
function startCron() {
  if (cronJob) return;
  cronJob = cron.schedule('*/5 * * * *', cronTick);
  console.log('✅ Campaign cron started (every 5 minutes)');
}

/**
 * Create a new campaign and generate tasks
 */
async function createCampaign({ name, videoUrls, accountIds, options = {} }) {
  const campaign = await WatchCampaign.create({
    name,
    video_urls: videoUrls,
    account_ids: accountIds,
    batch_size: BATCH_SIZE,
    max_duration: MAX_DURATION,
    options,
    status: 'running',
    current_video_index: 0
  });

  await generateTasks(campaign);
  return campaign;
}

/**
 * Get campaign with progress summary
 */
async function getCampaignProgress(id) {
  const campaign = await WatchCampaign.findByPk(id);
  if (!campaign) return null;

  const videoUrls = campaign.video_urls;
  const totalTasks = await WatchTask.count({ where: { campaign_id: id } });
  const doneTasks = await WatchTask.count({ where: { campaign_id: id, status: 'done' } });
  const failedTasks = await WatchTask.count({ where: { campaign_id: id, status: 'failed' } });
  const runningTasks = await WatchTask.count({ where: { campaign_id: id, status: 'running' } });

  // Per-video progress
  const videoProgress = await Promise.all(videoUrls.map(async (url, idx) => {
    const total = await WatchTask.count({ where: { campaign_id: id, video_index: idx } });
    const done = await WatchTask.count({ where: { campaign_id: id, video_index: idx, status: 'done' } });
    const failed = await WatchTask.count({ where: { campaign_id: id, video_index: idx, status: 'failed' } });
    return { url, index: idx, total, done, failed, pending: total - done - failed };
  }));

  return {
    ...campaign.toJSON(),
    totalTasks,
    doneTasks,
    failedTasks,
    runningTasks,
    pendingTasks: totalTasks - doneTasks - failedTasks - runningTasks,
    videoProgress
  };
}

/**
 * Pause / resume / stop campaign
 */
async function updateCampaignStatus(id, status) {
  const campaign = await WatchCampaign.findByPk(id);
  if (!campaign) throw new Error('Campaign not found');
  await campaign.update({ status });
  return campaign;
}

module.exports = { startCron, createCampaign, getCampaignProgress, updateCampaignStatus };
