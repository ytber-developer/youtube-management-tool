const { AccountYoutube } = require('../models');
const { Op } = require('sequelize');
const { successListResponse, errorResponse } = require('../helpers/response.helper');
const csvService = require('../services/csv.service');

/**
 * Get accounts list with pagination and search
 */
exports.getAccounts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      searchBy = 'all', // 'email', 'channelName', 'all'
      status = 'all' // 'all', 'incomplete', 'complete'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where condition
    let whereCondition = {};
    
    // Search filter
    if (search) {
      if (searchBy === 'email') {
        whereCondition.email = { [Op.like]: `%${search}%` };
      } else if (searchBy === 'channelName') {
        whereCondition.channel_name = { [Op.like]: `%${search}%` };
      } else {
        // Search in both email and channel name
        whereCondition[Op.or] = [
          { email: { [Op.like]: `%${search}%` } },
          { channel_name: { [Op.like]: `%${search}%` } }
        ];
      }
    }

    // Status filter
    if (status === 'incomplete') {
      // Accounts that don't have authenticator OR don't have channel
      whereCondition[Op.or] = [
        { is_authenticator: false },
        { is_authenticator: null },
        { is_create_channel: false },
        { is_create_channel: null }
      ];
    } else if (status === 'complete') {
      // Accounts that have both authenticator AND channel
      whereCondition.is_authenticator = true;
      whereCondition.is_create_channel = true;
    }
    // 'all' status: no additional filter

    // Query database with pagination
    const { count, rows } = await AccountYoutube.findAndCountAll({
      where: whereCondition,
      attributes: ['id', 'email', 'channel_name', 'channel_link', 'is_authenticator', 'is_create_channel', 'is_upload_avatar', 'avatar_url', 'image_name'],
      limit: limitNum,
      offset: offset,
      // Order by creation date ascending so older records appear first
      order: [['createdAt', 'ASC']]
    });

    // Format data to match frontend expectations
    const accounts = rows.map(account => ({
      id: account.id,
      email: account.email,
      channelName: account.channel_name || '',
      channelLink: account.channel_link || '',
      isAuthenticator: account.is_authenticator || false,
      isCreateChannel: account.is_create_channel || false,
      isUploadAvatar: account.is_upload_avatar || false,
      avatarUrl: account.avatar_url || '',
      imageName: account.image_name || ''
    }));

    // Use helper function for response
    return res.json(successListResponse({
      items: accounts,
      total: count,
      page: pageNum,
      limit: limitNum
    }));

  } catch (error) {
    console.error('Error getting accounts:', error);
    return res.status(500).json(errorResponse('Failed to get accounts', error));
  }
};

/**
 * Update avatar URLs from CSV file
 */
exports.updateAvatarUrls = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const csvPath = req.files.file[0].path;
    console.log('📁 CSV Path:', csvPath);
    
    // Load accounts from CSV
    const accounts = csvService.loadAccountsFromCSV(csvPath);
    
    if (accounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No accounts found in CSV'
      });
    }

    console.log(`📊 Processing ${accounts.length} accounts...\n`);
    
    const results = {
      updated: 0,
      notFound: 0,
      skipped: 0,
      details: []
    };
    
    for (const account of accounts) {
      try {
        // Find account by email
        const existingAccount = await AccountYoutube.findOne({
          where: { email: account.email }
        });
        
        if (!existingAccount) {
          console.log(`⚠️  ${account.email} - NOT FOUND`);
          results.notFound++;
          results.details.push({
            email: account.email,
            status: 'not_found'
          });
          continue;
        }
        
        // Skip if no avatar_url in CSV
        if (!account.avatar_url) {
          console.log(`⏭️  ${account.email} - NO AVATAR URL`);
          results.skipped++;
          results.details.push({
            email: account.email,
            status: 'no_avatar_url'
          });
          continue;
        }
        
        // Update avatar_url
        await AccountYoutube.update(
          { avatar_url: account.avatar_url },
          { where: { email: account.email } }
        );
        
        console.log(`✅ ${account.email} - UPDATED`);
        console.log(`   avatar_url: ${account.avatar_url.substring(0, 50)}...`);
        results.updated++;
        results.details.push({
          email: account.email,
          status: 'updated',
          avatar_url: account.avatar_url
        });
        
      } catch (error) {
        console.error(`❌ ${account.email} - ERROR:`, error.message);
        results.details.push({
          email: account.email,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${results.updated}`);
    console.log(`   ⚠️  Not Found: ${results.notFound}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    
    // Clean up CSV file
    const fs = require('fs');
    if (fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
    
    res.json({
      success: true,
      message: `Updated ${results.updated} accounts`,
      data: results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Export all accounts as CSV (Excel-compatible)
 */
exports.exportAccounts = async (req, res) => {
  try {
    const accounts = await AccountYoutube.findAll({
      attributes: [
        'id', 'email', 'password', 'channel_name', 'channel_link',
        'avatar_url', 'image_name', 'code_authenticators', 'is_authenticator', 'is_create_channel', 'is_upload_avatar',
        'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'ASC']]
    });

    const headers = [
      'id','email','password','channel_name','channel_link',
      'avatar_url','image_name','code_authenticators','is_authenticator','is_create_channel','is_upload_avatar',
      'createdAt','updatedAt'
    ];

    const escape = (value) => {
      if (value === null || value === undefined) return '';
      let s = String(value);
      // Convert boolean to 1/0 for Excel friendliness
      if (s === 'true' || s === 'false') return s;
      // Escape double quotes
      s = s.replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = accounts.map(a => {
      const values = [
        a.id,
        a.email,
        a.password || '',
        a.channel_name || '',
        a.channel_link || '',
        a.avatar_url || '',
        a.image_name || '',
        a.code_authenticators || '',
        a.is_authenticator ? 'true' : 'false',
        a.is_create_channel ? 'true' : 'false',
        a.is_upload_avatar ? 'true' : 'false',
        a.createdAt ? a.createdAt.toISOString() : '',
        a.updatedAt ? a.updatedAt.toISOString() : ''
      ];
      return values.map(v => escape(v)).join(',');
    });

    const csvContent = `${headers.join(',')}
${rows.join('\n')}`;

    const fileName = `accounts_export_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(csvContent);

  } catch (error) {
    console.error('❌ Error exporting accounts:', error);
    return res.status(500).json({ success: false, message: 'Failed to export accounts', error: error.message });
  }
};

/**
 * Track open browsers by email to prevent duplicate opens
 */
const openBrowsers = new Map();

/**
 * Open browser fresh for account (no profile, login from scratch)
 * Always opens a fresh browser without any saved session/profile
 */
exports.openBrowserWithProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { reuseIfOpen = 'true' } = req.query; // Allow override via query param
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    // Find account
    const account = await AccountYoutube.findByPk(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: `Account with ID ${id} not found`
      });
    }

    const email = account.email;
    const shouldReuse = reuseIfOpen === 'true';

    console.log(`\n🌐 Opening browser for account: ${email} (with profile, reuse: ${shouldReuse})`);

    const browserService = require('../services/browser.service');
    const googleAuthService = require('../services/google.auth.service');
    
    // Launch browser WITH profile OR reuse existing browser with new tab
    const { browser, page, isNewBrowser } = await browserService.launchBrowser(
      false,      // Not headless
      email,      // Email for profile
      3,          // Retries
      shouldReuse // Reuse if already open
    );

    if (isNewBrowser) {
      console.log(`🆕 Launched new browser for [${email}]`);
    } else {
      console.log(`🔄 Reused existing browser, opened new tab for [${email}]`);
    }

    // Navigate to YouTube Studio to check session
    console.log('🎬 Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 3000));

    // Check if needs login
    const currentUrl = page.url();
    const needsLogin = currentUrl.includes('accounts.google.com') || 
                      currentUrl.includes('signin') ||
                      currentUrl.includes('ServiceLogin');

    if (needsLogin) {
      console.log('🔐 Session expired, logging in...');
      
      if (!account.password) {
        return res.status(400).json({
          success: false,
          message: 'Account password not found, cannot auto-login',
          data: {
            email: email,
            isNewBrowser: isNewBrowser,
            note: 'Please login manually in the browser window'
          }
        });
      }

      await googleAuthService.login(page, email, account.password);
      
      // Navigate back to YouTube Studio
      console.log('🎬 Returning to YouTube Studio...');
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      await new Promise(r => setTimeout(r, 3000));
      
      console.log(`✅ Login successful for ${email}`);
    } else {
      console.log('✅ Already logged in (session valid), skipping login');
    }

    // Return success response
    return res.json({
      success: true,
      message: isNewBrowser 
        ? `Browser opened for ${email}` 
        : `New tab opened in existing browser for ${email}`,
      data: {
        email: email,
        isNewBrowser: isNewBrowser,
        sessionValid: !needsLogin,
        note: 'Browser will stay open - close it manually when done'
      }
    });

  } catch (error) {
    console.error('❌ Error opening browser:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to open browser',
      error: error.message
    });
  }
};

/**
 * Get list of open browsers
 */
exports.getOpenBrowsers = async (req, res) => {
  try {
    const browserService = require('../services/browser.service');
    const browsers = browserService.getActiveBrowsers();

    return res.json({
      success: true,
      count: browsers.length,
      data: browsers
    });
  } catch (error) {
    console.error('❌ Error getting open browsers:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Close browser for account
 */
exports.closeBrowser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    // Find account
    const account = await AccountYoutube.findByPk(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: `Account with ID ${id} not found`
      });
    }

    const browserService = require('../services/browser.service');
    const closed = await browserService.closeBrowser(account.email);

    if (closed) {
      return res.json({
        success: true,
        message: `Browser closed for ${account.email}`
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `No active browser found for ${account.email}`
      });
    }

  } catch (error) {
    console.error('❌ Error closing browser:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get openBrowsers map for other controllers to check/reuse
 * @returns {Map} openBrowsers map
 */
exports.getOpenBrowsersMap = () => {
  return openBrowsers;
};

/**
 * Update avatar URL for a specific account
 * PUT /api/v1/accounts/:id/avatar-url
 */
exports.updateAvatarUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { avatarUrl } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Account ID is required'
      });
    }

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: 'Avatar URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(avatarUrl);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid avatar URL format'
      });
    }

    // Find account
    const account = await AccountYoutube.findByPk(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Update avatar_url and reset upload status
    await account.update({
      avatar_url: avatarUrl,
      is_upload_avatar: false,
      image_name: null // Reset image name khi update URL mới
    });

    console.log(`✅ Updated avatar URL for ${account.email}: ${avatarUrl}`);

    return res.json({
      success: true,
      message: 'Avatar URL updated successfully',
      data: {
        id: account.id,
        email: account.email,
        avatarUrl: account.avatar_url,
        isUploadAvatar: account.is_upload_avatar
      }
    });

  } catch (error) {
    console.error('Error updating avatar URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update avatar URL',
      error: error.message
    });
  }
};

/**
 * Delete account by id
 */
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Account ID is required' });
    }

    const account = await AccountYoutube.findByPk(id);
    if (!account) {
      return res.status(404).json({ success: false, message: `Account with ID ${id} not found` });
    }

    // Close browser if open for this account
    try {
      const browserService = require('../services/browser.service');
      await browserService.closeBrowser(account.email);
    } catch (e) {
      console.warn('Warning: failed to close browser for account during delete', e.message);
    }

    // Delete account record
    await account.destroy();

    return res.json({ success: true, message: `Account ${account.email} deleted` });
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete account', error: error.message });
  }
};
