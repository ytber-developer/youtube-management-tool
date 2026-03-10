const express = require('express');
const router = express.Router();
const facebookReelController = require('../controllers/facebook.reel.controller');

router.post('/reels', facebookReelController.getReels);

module.exports = router;
