const express = require('express');
const router = express.Router();
const setupController = require('../../controllers/setup.controller');
const { requireLoopback } = require('../../middlewares/security');

router.get('/status', setupController.getStatus);
router.post('/migrate', requireLoopback, setupController.migrate);
// Chạy `git pull` trên máy → chỉ cho phép từ chính máy này, kể cả khi HOST=0.0.0.0
router.post('/pull', requireLoopback, setupController.pull);

module.exports = router;
