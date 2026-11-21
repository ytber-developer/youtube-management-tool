/**
 * Tự đăng video content (content/<date>/<folder>) lên YouTube qua hàng đợi upload sẵn có (upload.queue.service).
 *
 * Mỗi video content = 1 bản ghi UploadedVideo (content_id = "<date>/<folder>", không thuộc campaign):
 *   - local_file_path = final.mp4 (không bao giờ xoá), thumbnail_path = thumbnail.png, tags từ script.json
 *   - title/description như trang chi tiết /content (pack.youtubeDescription)
 *   - schedule_date = giờ công khai: người dùng chọn (scheduleAt) hoặc mặc định 12:00 PM ET ngày đăng; đã quá giờ → công khai ngay
 *   - scheduled_start_at = null: bấm Đăng là hàng đợi mở trình duyệt upload ngay
 * Upload xong → ghi review.json.uploadedUrl (content-tools/lib/uploaded.js) → trang /content hiện "Đã đăng".
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { UploadedVideo, AccountYoutube } = require('../models');

const LIB = path.resolve(__dirname, '..', '..', 'content-tools', 'lib');
const paths = require(path.join(LIB, 'paths'));
const { videoStatus } = require(path.join(LIB, 'status'));
const pack = require(path.join(LIB, 'pack'));
const { markUploaded, isYoutubeUrl } = require(path.join(LIB, 'uploaded'));

const ACTIVE = ['pending', 'downloading', 'downloaded', 'uploading'];
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

/** Mốc UTC của 12:00 PM America/New_York ngày `date` (tự xử lý EST/EDT) */
function postInstant(date) {
  const guess = new Date(`${date}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(guess).map(x => [x.type, x.value]));
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

/** Bản ghi upload mới nhất của mỗi content_id (null nếu chưa xếp hàng) */
async function statusMap(ids = null) {
  const where = ids ? { content_id: { [Op.in]: ids } } : { content_id: { [Op.ne]: null } };
  const rows = await UploadedVideo.findAll({ where, order: [['id', 'DESC']] });
  const map = {};
  for (const r of rows) if (!map[r.content_id]) map[r.content_id] = toPublic(r);
  return map;
}

function toPublic(r) {
  return {
    id: r.id, status: r.status, email: r.email, error: r.error_message || null, videoUrl: r.video_url || null,
    scheduleDate: r.schedule_date ? new Date(r.schedule_date).toISOString() : null,
    scheduledStartAt: r.scheduled_start_at ? new Date(r.scheduled_start_at).toISOString() : null,
    uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : null,
    attempts: r.upload_attempts || 0,
  };
}

/**
 * Xếp các video vào hàng đợi (upload bắt đầu ngay). Trả về { queued: [...], skipped: [{ id, reason }] }.
 * @param {string[]} ids           "<date>/<folder>"
 * @param {number}   accountId     AccountYoutube.id của kênh
 * @param {object}   opts          { scheduleAt?: ISO string } giờ công khai cho mọi id; bỏ trống = 12:00 PM ET ngày đăng
 */
async function queue(ids, accountId, { scheduleAt = null } = {}) {
  let chosen = null;
  if (scheduleAt) {
    chosen = new Date(scheduleAt);
    if (Number.isNaN(chosen.getTime())) throw new Error('scheduleAt không phải ngày giờ hợp lệ');
  }
  const account = await AccountYoutube.findByPk(accountId);
  if (!account) throw new Error('Không tìm thấy tài khoản');
  const { triggerTick } = require('./upload.queue.service');

  const queued = [], skipped = [];
  const existing = await statusMap(ids);
  for (const id of ids) {
    const dir = paths.resolveVideoDir(id);
    if (!dir) { skipped.push({ id, reason: 'không tồn tại' }); continue; }
    const st = videoStatus(dir);
    if (st.uploadedUrl) { skipped.push({ id, reason: 'đã đăng' }); continue; }
    if (st.stageKey !== 'uploaded') { skipped.push({ id, reason: `chưa sẵn sàng: ${st.stage}` }); continue; }
    const prev = existing[id];
    if (prev && ACTIVE.includes(prev.status)) { skipped.push({ id, reason: 'đang trong hàng đợi' }); continue; }
    if (prev && prev.status === 'completed') { skipped.push({ id, reason: 'đã upload' }); continue; }

    const script = readJson(path.join(dir, 'script.json'), {});
    const credits = readJson(path.join(dir, 'credits.json'), []);
    const { date } = paths.parseId(id);
    const at = chosen || postInstant(date);
    const now = Date.now();
    // Studio chỉ cho hẹn giờ trong tương lai; đã quá giờ (hoặc còn < 15 phút) → công khai ngay
    const scheduleDate = at.getTime() - now > 15 * 60 * 1000 ? at : null;
    const thumb = path.join(dir, 'thumbnail.png');
    const fields = {
      account_youtube_id: account.id,
      email: account.email,
      content_id: id,
      source_url: `content:${id}`,
      local_file_path: path.join(dir, 'final.mp4'),
      thumbnail_path: fs.existsSync(thumb) ? thumb : null,
      title: script.title || id,
      video_description: pack.youtubeDescription(script, Array.isArray(credits) ? credits : []),
      tags: Array.isArray(script.tags) ? script.tags : [],
      video_visibility: 'public',
      schedule_date: scheduleDate,
      scheduled_start_at: null,
      status: 'pending',
      error_message: null,
      video_url: null,
    };
    const row = prev
      ? await (await UploadedVideo.findByPk(prev.id)).update(fields) // failed/skipped → thử lại
      : await UploadedVideo.create({ ...fields, download_attempts: 0, upload_attempts: 0 });
    queued.push(toPublic(row));
    console.log(`📥 [Content] Xếp hàng ${id} → ${account.email}${scheduleDate ? ` (công khai lúc ${at.toISOString()})` : ' (công khai ngay)'}`);
  }
  if (queued.length) triggerTick();
  return { queued, skipped };
}

/** Bỏ khỏi hàng đợi (chỉ khi chưa bắt đầu upload) */
async function cancel(id) {
  const row = await UploadedVideo.findOne({ where: { content_id: id }, order: [['id', 'DESC']] });
  if (!row) throw new Error('Video chưa xếp hàng');
  if (!['pending', 'failed', 'skipped'].includes(row.status)) throw new Error(`Không huỷ được khi đang ${row.status}`);
  await row.destroy();
  return { id: row.id };
}

/** Hàng đợi gọi sau khi upload thành công: ghi link vào review.json để /content hiện "Đã đăng" */
async function onUploaded(video) {
  const dir = paths.resolveVideoDir(video.content_id);
  if (!dir) return;
  if (!isYoutubeUrl(video.video_url)) {
    console.log(`⚠️ [Content] ${video.content_id} đã upload nhưng chưa lấy được link → đánh dấu tay: npm run content -- uploaded ${video.content_id} <link>`);
    return;
  }
  markUploaded(dir, video.video_url);
  console.log(`✅ [Content] ${video.content_id} đã đăng: ${video.video_url}`);
}

module.exports = { queue, cancel, statusMap, onUploaded, postInstant };
