const express = require('express');
const router = express.Router();
const setupController = require('../../controllers/setup.controller');

router.get('/status', setupController.getStatus);
router.post('/migrate', setupController.migrate);
router.post('/pull', setupController.pull);

module.exports = router;
