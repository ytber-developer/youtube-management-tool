const express = require('express');
const router = express.Router();
const verifyAuthenticatorController = require('../../controllers/verify.authenticator.controller');
const upload = require('../../middlewares/upload');

// Single route - Auto setup 2FA from CSV (upload file) + optional avatars ZIP
router.post('/', upload.fields([
  { name: 'file', maxCount: 1 },      // CSV file (required)
  { name: 'avatars', maxCount: 1 }    // ZIP file (optional)
]), verifyAuthenticatorController.autoSetup2FA);

// Retry verify authenticator and create channel for specific account by ID
router.post('/retry/:id', verifyAuthenticatorController.retryVerifyById);

module.exports = router;
