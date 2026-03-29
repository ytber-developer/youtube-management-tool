const express = require('express');
const router = express.Router();
const setupController = require('../../controllers/setup.controller');

router.get('/status', setupController.getStatus);
router.post('/migrate', setupController.migrate);

module.exports = router;
