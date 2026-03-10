const express = require('express');
const router = express.Router();

const verifyRoutes = require('./verify.routes');
const youtubeRoutes = require('./youtube.routes');
const watchRoutes = require('./watch.routes');
const loginRoutes = require('./login.routes');
const uploadRoutes = require('./upload.routes');
const accountsRoutes = require('./accounts.routes');
const facebookReelRoutes = require('../facebook.reel.routes');

// Mount routes
router.use('/authenticator', verifyRoutes);
router.use('/youtube', youtubeRoutes);
router.use('/watch', watchRoutes);
router.use('/login', loginRoutes);
router.use('/upload', uploadRoutes);
router.use('/accounts', accountsRoutes);
router.use('/facebook', facebookReelRoutes);

module.exports = router;
