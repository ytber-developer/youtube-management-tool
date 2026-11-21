const express = require('express');
const router = express.Router();
const controller = require('../../controllers/content.controller');

// Build/giọng/render chạy qua `npm run content`; trang web chỉ đọc trạng thái + xếp hàng tự đăng YouTube.
/** @route GET /api/v1/content                            Danh sách video + trạng thái (+ upload: hàng đợi tự đăng) */
router.get('/', controller.list);
/** @route POST /api/v1/content/upload                    Xếp video sẵn sàng vào hàng đợi tự đăng { ids, accountId, scheduleAt? } */
router.post('/upload', controller.queueUpload);
/** @route DELETE /api/v1/content/upload/:date/:folder    Bỏ khỏi hàng đợi (chưa upload) */
router.delete('/upload/:date/:folder', controller.cancelUpload);
/** @route GET /api/v1/content/file/:date/:folder/:name   thumbnail.png | final.mp4 | captions.srt */
router.get('/file/:date/:folder/:name', controller.file);
/** @route GET /api/v1/content/:date/:folder              Nội dung đăng YouTube của một video */
router.get('/:date/:folder', controller.detail);

module.exports = router;
