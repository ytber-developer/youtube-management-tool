const express = require('express');
const router = express.Router();
const accountsController = require('../../controllers/accounts.controller');
const upload = require('../../middlewares/upload');
const adsenseController = require('../../controllers/adsense.controller');

/**
 * @route   GET /api/v1/accounts
 * @desc    Get accounts list with pagination and search
 * @query   page, limit, search, searchBy
 * @access  Public
 */
router.get('/', accountsController.getAccounts);

/**
 * @route   POST /api/v1/accounts/update-avatar-urls
 * @desc    Update avatar URLs from CSV file
 * @access  Public
 */
router.post('/update-avatar-urls', upload.fields([{ name: 'file', maxCount: 1 }]), accountsController.updateAvatarUrls);

/**
 * @route   GET /api/v1/accounts/export
 * @desc    Export all accounts as CSV
 * @access  Public
 */
router.get('/export', accountsController.exportAccounts);

/**
 * @route   GET /api/v1/accounts/open-browsers
 * @desc    Get list of open browsers
 * @access  Public
 */
router.get('/open-browsers', accountsController.getOpenBrowsers);

/**
 * @route   POST /api/v1/accounts/:id/open-browser
 * @desc    Open fresh browser for account (no profile, login from scratch)
 * @access  Public
 */
router.post('/:id/open-browser', accountsController.openBrowserWithProfile);

/**
 * @route   POST /api/v1/accounts/:id/close-browser
 * @desc    Close browser for account
 * @access  Public
 */
router.post('/:id/close-browser', accountsController.closeBrowser);

/**
 * @route   PUT /api/v1/accounts/:id/avatar-url
 * @desc    Update avatar URL for account
 * @body    { avatarUrl: string }
 * @access  Public
 */
router.put('/:id/avatar-url', accountsController.updateAvatarUrl);

/**
 * @route   DELETE /api/v1/accounts
 * @desc    Delete all accounts
 * @access  Public
 */
router.delete('/', accountsController.deleteAllAccounts);

/**
 * @route   DELETE /api/v1/accounts/bulk
 * @desc    Delete multiple accounts by ids
 * @body    { ids: number[] }
 * @access  Public
 */
router.delete('/bulk', accountsController.deleteAccountsBulk);

/**
 * @route   DELETE /api/v1/accounts/:id
 * @desc    Delete account by id
 * @access  Public
 */
router.delete('/:id', accountsController.deleteAccount);

/**
 * @route   POST /api/v1/accounts/adsense/check
 * @desc    Upload CSV and run AdSense account checks (email,password,2fa optional)
 * @access  Public
 */
router.post('/adsense/check', upload.fields([{ name: 'file', maxCount: 1 }]), adsenseController.checkAdsense);

module.exports = router;
