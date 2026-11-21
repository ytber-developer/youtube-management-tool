// Đánh dấu video đã đăng YouTube: ghi review.json.uploadedUrl (status.js đọc trường này → bước "uploaded" = done).
// Dùng chung cho CLI (`npm run content -- uploaded`) và hàng đợi tự đăng (src/services/content.upload.service.js).
const fs = require('fs');
const path = require('path');

const YT_URL = /^https:\/\/(youtu\.be|(www\.)?youtube\.com)\//;
const isYoutubeUrl = (url) => YT_URL.test(String(url || ''));

/** url = "-" → bỏ đánh dấu. Trả về review.json mới. */
function markUploaded(dir, url) {
  if (url !== '-' && !isYoutubeUrl(url)) throw new Error(`Không phải link YouTube: ${url}`);
  const file = path.join(dir, 'review.json');
  let review = {};
  try { review = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* chưa có review.json */ }
  if (!review || typeof review !== 'object' || Array.isArray(review)) review = {};
  if (url === '-') delete review.uploadedUrl; else review.uploadedUrl = url;
  fs.writeFileSync(file, JSON.stringify(review, null, 2) + '\n');
  return review;
}

module.exports = { markUploaded, isYoutubeUrl };
