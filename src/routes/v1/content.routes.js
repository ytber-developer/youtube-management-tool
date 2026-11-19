const express = require('express');
const router = express.Router();
const controller = require('../../controllers/content.controller');

// Chỉ đọc. Thao tác (build, giọng, render, đánh dấu đã đăng) chạy qua `npm run content`.
/** @route GET /api/v1/content                            Danh sách video + trạng thái */
router.get('/', controller.list);
/** @route GET /api/v1/content/file/:date/:folder/:name   thumbnail.png | final.mp4 | captions.srt */
router.get('/file/:date/:folder/:name', controller.file);
/** @route GET /api/v1/content/:date/:folder              Nội dung đăng YouTube của một video */
router.get('/:date/:folder', controller.detail);

module.exports = router;
