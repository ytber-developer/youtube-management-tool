const express = require('express');
const router = express.Router();
const controller = require('../../controllers/fbpage.controller');

// Bài đăng page Facebook "Hôm Nay Mới Biết": đọc từ content-vi/ (xem fbpage.service.js). Không tự đăng lên Facebook.
/** @route GET   /api/v1/fbpage/posts                 Lịch + bài đã viết, kèm trạng thái */
router.get('/posts', controller.list);
/** @route GET   /api/v1/fbpage/posts/:date/:slug/video   reel.mp4 của bài */
router.get('/posts/:date/:slug/video', controller.video);
/** @route GET   /api/v1/fbpage/posts/:date/:slug     Kịch bản, caption, hashtag, nguồn */
router.get('/posts/:date/:slug', controller.detail);
/** @route PATCH /api/v1/fbpage/posts/:date/:slug     { factChecked?, postedUrl?, postedAt?, note? } */
router.patch('/posts/:date/:slug', controller.update);

module.exports = router;
