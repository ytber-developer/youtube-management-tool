/**
 * Upload Queue Service
 *
 * Mirrors the WatchCampaign / campaign.service.js pattern for uploads.
 *
 * Campaign statuses:
 *   new     — created, waiting in queue
 *   running — currently being processed (max 1 globally)
 *   pending — manually held, skipped by cron
 *   done    — all videos finished
 *
 * Cron logic each tick (every 5 minutes):
 *   1. If isProcessing flag → skip
 *   2. If any UploadedVideo is downloading/uploading → skip (job still active)
 *   3. Find single 'running' campaign → process next pending video in it
 *   4. If none, promote oldest 'new' campaign with scheduled_start_at <= now → running
 *   5. 'pending' campaigns are never auto-promoted
 *
 * Within a campaign, videos are processed ONE AT A TIME in order_index ASC.
 * When all videos are done/failed/skipped → campaign → 'done'.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const fs = require('fs');
const { UploadedVideo, UploadCampaign, AccountYoutube } = require('../models');
const youtubeUploadService = require('./youtube.upload.service');
const VideoDownloadService = require('./video.download.service');

let cronJob = null;
let isProcessing = false;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
// "YYYY-MM-DDTHH:mm:ss" in VN time — used for DB storage and WHERE comparisons
const vnNow = () => new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 19);
// Convert any parseable datetime string (incl. +07:00 from frontend) → VN naive string
const toVNString = (s) => {
  if (!s) return null;
  return new Date(new Date(s).getTime() + VN_OFFSET_MS).toISOString().slice(0, 19);
};

// ─── Cron tick ────────────────────────────────────────────────────────────────

async function cronTick() {
  if (isProcessing) {
    console.log('⏭️  [UploadQueue] Previous tick still running, skipping');
    return;
  }

  isProcessing = true;

  try {
    console.log(`🕒 [UploadQueue] cron tick - VN now: ${vnNow()}`);

    // If any video is actively downloading/uploading → skip (browser still open)
    const activeCount = await UploadedVideo.count({
      where: { status: { [Op.in]: ['downloading', 'uploading'] } }
    });
    if (activeCount > 0) {
      console.log(`⏳ [UploadQueue] ${activeCount} video(s) still active — skipping tick`);
      return;
    }

    // Find next due video across all campaigns: null scheduled = run immediately, past scheduled = overdue
    const video = await UploadedVideo.findOne({
      where: {
        status: 'pending',
        [Op.or]: [
          { scheduled_start_at: null },
          { scheduled_start_at: { [Op.lte]: vnNow() } }
        ]
      },
      order: [['campaign_id', 'ASC'], ['order_index', 'ASC'], ['id', 'ASC']]
    });

    if (!video) {
      console.log('💤 [UploadQueue] No due videos');
      return;
    }

    const campaign = await UploadCampaign.findByPk(video.campaign_id);
    if (!campaign) {
      await video.update({ status: 'failed', error_message: 'Campaign not found' });
      return;
    }

    if (campaign.status === 'new') {
      await campaign.update({ status: 'running' });
    }

    console.log(`\n📹 [UploadQueue] Video #${video.id} "${video.title || video.source_url}" (campaign #${campaign.id})`);

    const account = await AccountYoutube.findByPk(campaign.account_youtube_id);
    if (!account) {
      await video.update({ status: 'failed', error_message: 'Account not found' });
      return;
    }

    await uploadVideo(video, account, campaign.options || {});

    // Mark campaign done if all videos finished
    const remaining = await UploadedVideo.count({
      where: { campaign_id: campaign.id, status: { [Op.notIn]: ['completed', 'failed', 'skipped'] } }
    });
    if (remaining === 0) {
      await campaign.update({ status: 'done' });
      console.log(`🏁 [UploadQueue] Campaign #${campaign.id} all done`);
    }

  } catch (err) {
    console.error('❌ [UploadQueue] Cron error:', err.message);
  } finally {
    isProcessing = false;
  }
}

// ─── Video uploader ───────────────────────────────────────────────────────────

async function uploadVideo(video, account, options) {
  let filePath = video.local_file_path || null;

  // Phase 1: Download (if URL-based and no local file yet)
  const needsDownload = !filePath && video.source_url && video.source_url !== 'uploaded-file';

  if (needsDownload) {
    await video.update({
      status: 'downloading',
      download_attempts: (video.download_attempts || 0) + 1
    });

    try {
      const downloadService = new VideoDownloadService(account.email);
      const result = await downloadService.downloadVideo(video.source_url);

      if (!result.success) {
        await video.update({ status: 'failed', error_message: result.message || 'Download failed' });
        console.log(`   ❌ Download failed: ${result.message}`);
        return;
      }

      filePath = result.data.filePath;
      const extra = {};
      if (!video.title && result.data.title) extra.title = result.data.title;
      await video.update({ local_file_path: filePath, downloaded_at: new Date(), ...extra });
      console.log(`   ✅ Downloaded: ${filePath}`);

    } catch (err) {
      await video.update({ status: 'failed', error_message: err.message });
      console.error(`   ❌ Download error:`, err.message);
      return;
    }
  }

  if (!filePath) {
    await video.update({ status: 'failed', error_message: 'No video file to upload' });
    return;
  }

  // Phase 2: Upload
  await video.update({
    status: 'uploading',
    upload_attempts: (video.upload_attempts || 0) + 1
  });

  try {
    await video.reload(); // get latest title from download phase

    const uploadResult = await youtubeUploadService.uploadVideo(
      account.email,
      filePath,
      {
        title: video.title,
        description: video.video_description,
        visibility: options.visibility || video.video_visibility || 'public',
        scheduleDate: options.scheduleDate || video.schedule_date
      },
      { closeBrowser: true }
    );

    _deleteFile(filePath);

    if (uploadResult.success) {
      await video.update({
        status: 'completed',
        video_url: uploadResult.data?.videoUrl,
        uploaded_at: new Date(),
        local_file_path: null,
        error_message: null
      });
      console.log(`   ✅ Uploaded: ${uploadResult.data?.videoUrl}`);
    } else {
      const errMsg = uploadResult.error || uploadResult.message;
      await video.update({ status: 'failed', error_message: errMsg });
      console.log(`   ❌ Upload failed: ${errMsg}`);
    }

  } catch (err) {
    _deleteFile(filePath);
    await video.update({ status: 'failed', error_message: err.message });
    console.error(`   ❌ Upload error:`, err.message);
  }
}

function _deleteFile(filePath) {
  if (!filePath) return;
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

// ─── Recovery ─────────────────────────────────────────────────────────────────

async function recoverStuckUploads() {
  // Reset videos stuck mid-process
  const stuck = await UploadedVideo.count({
    where: { status: { [Op.in]: ['downloading', 'uploading'] } }
  });
  if (stuck > 0) {
    await UploadedVideo.update(
      { status: 'pending' },
      { where: { status: { [Op.in]: ['downloading', 'uploading'] } } }
    );
    console.log(`♻️  [UploadQueue] Reset ${stuck} stuck video(s) → pending`);
  }

  // Reset campaigns stuck in running (server crashed mid-campaign)
  const stuckCampaigns = await UploadCampaign.count({ where: { status: 'running' } });
  if (stuckCampaigns > 0) {
    await UploadCampaign.update({ status: 'new' }, { where: { status: 'running' } });
    console.log(`♻️  [UploadQueue] Reset ${stuckCampaigns} stuck campaign(s) → new`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new upload campaign with video tasks.
 */
async function createUploadCampaign({ name, accountId, email, videos, options = {} }) {
  // Campaign scheduled_start_at = earliest per-video schedule (null = ASAP)
  const videoSchedules = videos.map(v => v.scheduledStartAt).filter(Boolean);
  const campaignScheduledAt = videoSchedules.length > 0
    ? new Date(Math.min(...videoSchedules.map(s => new Date(s).getTime())))
    : null;

  const campaign = await UploadCampaign.create({
    name,
    account_youtube_id: accountId,
    email,
    status: 'new',
    scheduled_start_at: campaignScheduledAt ? toVNString(campaignScheduledAt.toISOString()) : null,
    options,
    total_videos: videos.length
  });

  await UploadedVideo.bulkCreate(
    videos.map((v, i) => ({
      campaign_id: campaign.id,
      order_index: i,
      account_youtube_id: accountId,
      email,
      source_url: v.localFilePath ? 'uploaded-file' : v.sourceUrl,
      local_file_path: v.localFilePath || null,
      title: v.title || null,
      video_description: v.description || null,
      video_visibility: options.visibility || 'public',
      schedule_date: options.scheduleDate || null,
      scheduled_start_at: v.scheduledStartAt ? toVNString(v.scheduledStartAt) : null,
      status: 'pending'
    }))
  );

  console.log(`✅ [UploadQueue] Created campaign #${campaign.id} "${name}" with ${videos.length} video(s)`);
  return campaign;
}

function startUploadCron() {
  if (cronJob) return;
  cronJob = cron.schedule('*/2 * * * *', cronTick);
  console.log('✅ Upload queue cron started (every 2 minutes)');
}

module.exports = { startUploadCron, recoverStuckUploads, createUploadCampaign };
