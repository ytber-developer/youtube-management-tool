const express = require('express');
const router = express.Router();
const youtubeController = require('../../controllers/youtube.controller');

// Create YouTube channels for accounts
router.post('/create-channel', youtubeController.createChannels);

// Upload avatars for channels (batch)
router.post('/upload-avatar', youtubeController.uploadAvatars);

// Upload avatar for single account
router.post('/upload-avatar/:id', youtubeController.uploadAvatarSingle);

module.exports = router;
