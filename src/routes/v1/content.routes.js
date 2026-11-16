const express = require('express');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const controller = require('../../controllers/content.controller');

// Giọng đọc: chỉ audio mp3/m4a/wav, tối đa 50 MB; file sai loại bị bỏ qua → controller trả 400
const voiceUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /\.(mp3|m4a|wav)$/i.test(file.originalname) && /^audio\//.test(file.mimetype)),
}).single('voice');
const handleVoice = (req, res, next) => voiceUpload(req, res, (err) => {
  if (err) return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File giọng quá lớn (tối đa 50 MB)' : err.message });
  next();
});

/** @route GET  /api/v1/content                       Danh sách video + trạng thái */
router.get('/', controller.list);
/** @route GET  /api/v1/content/jobs                  Tác vụ đang chạy / gần đây */
router.get('/jobs', controller.jobs);
/** @route GET  /api/v1/content/file/:date/:folder/*  File trong thư mục video (ảnh, slide, video, srt…) */
router.get('/file/:date/:folder/*', controller.file);
/** @route GET  /api/v1/content/:date/:folder         Chi tiết video */
router.get('/:date/:folder', controller.detail);
/** @route POST /api/v1/content/:date/:folder/actions/:action   images|slides|thumb|package|preview|render */
router.post('/:date/:folder/actions/:action', controller.action);
/** @route POST /api/v1/content/:date/:folder/voice   Upload giọng đọc → tự render video cuối */
router.post('/:date/:folder/voice', handleVoice, controller.voice);
/** @route PUT  /api/v1/content/:date/:folder/review  { imagesReviewed?, uploadedUrl? } */
router.put('/:date/:folder/review', controller.review);

module.exports = router;
