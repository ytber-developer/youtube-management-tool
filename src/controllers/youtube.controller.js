const { AccountYoutube } = require('../models');
const browserService = require('../services/browser.service');
const googleAuthService = require('../services/google.auth.service');
const youtubeService = require('../services/youtube.service');
const facebDownloader = require('../services/faceb.downloader.service');
const { fileHelper } = require('../helpers');
const { ensureLoggedIn } = require('../helpers/session.helper');
const path = require('path');

class YoutubeController {
  
  async createChannels(req, res) {
    try {
      // Get accounts from database that don't have channels yet
      const accounts = await AccountYoutube.findAll({
        where: {
          is_create_channel: false
        }
      });

      if (accounts.length === 0) {
        return res.json({
          success: true,
          message: 'No accounts need channel creation',
          data: []
        });
      }

      console.log(`📺 Tìm thấy ${accounts.length} accounts cần tạo channel\n`);

      const results = [];

      // Process accounts one by one for debugging
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        console.log(`\n📦 Processing ${i + 1}/${accounts.length}: ${account.email}...`);
        
        const result = await createChannelForAccount(account);
        results.push(result);
        
        console.log(`✅ Completed: ${result.success ? 'Success' : 'Failed'}\n`);
        
        // Delay between accounts
        if (i < accounts.length - 1) {
          console.log('⏳ Waiting 3s before next account...\n');
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        success: true,
        message: `Completed: ${successCount} success, ${failCount} failed`,
        data: results,
        summary: {
          total: accounts.length,
          success: successCount,
          failed: failCount
        }
      });

    } catch (error) {
      console.error('❌ Controller Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async uploadAvatars(req, res) {
    try {
      // Get accounts that have channels, avatar_url, and haven't uploaded avatar yet
      const { Op } = require('sequelize');
      const accounts = await AccountYoutube.findAll({
        where: {
          is_create_channel: true,
          channel_link: { [Op.ne]: null },
          is_upload_avatar: false,
          avatar_url: { [Op.ne]: null } // Must have avatar_url
        }
      });

      if (accounts.length === 0) {
        return res.json({
          success: true,
          message: 'No accounts need avatar upload',
          data: []
        });
      }

      console.log(`🖼️  Tìm thấy ${accounts.length} accounts cần upload avatar\n`);

      // STEP 1: Download all avatars in parallel (10 tabs at once)
      console.log('\n📥 STEP 1: Downloading avatars from Facebook...\n');
      
      const avatarsDir = path.join(__dirname, '../../avatars');
      const fs = require('fs');
      
      // Filter accounts that need download
      const accountsNeedDownload = accounts.filter(acc => {
        if (acc.image_name && fs.existsSync(path.join(avatarsDir, acc.image_name))) {
          console.log(`✓ ${acc.email}: Avatar already exists (${acc.image_name})`);
          return false;
        }
        return true;
      });

      if (accountsNeedDownload.length > 0) {
        console.log(`\n🔽 Need to download ${accountsNeedDownload.length} avatars...\n`);
        
        const downloadResults = await facebDownloader.downloadMultipleAvatars(
          accountsNeedDownload,
          avatarsDir
        );

        // Update image_name in database for successfully downloaded avatars
        for (const result of downloadResults) {
          if (result.success && result.imageName) {
            await AccountYoutube.update(
              { image_name: result.imageName },
              { where: { id: result.id } }
            );
            console.log(`💾 Updated image_name for ${result.email}: ${result.imageName}`);
          }
        }

        console.log(`\n✅ Download completed: ${downloadResults.filter(r => r.success).length}/${downloadResults.length} success\n`);
      } else {
        console.log('\n✓ All avatars already downloaded, skipping download step\n');
      }

      // Reload accounts to get updated image_name
      const accountsWithAvatars = await AccountYoutube.findAll({
        where: {
          is_create_channel: true,
          channel_link: { [Op.ne]: null },
          is_upload_avatar: false,
          avatar_url: { [Op.ne]: null },
          image_name: { [Op.ne]: null } // Only accounts with downloaded avatar
        }
      });

      if (accountsWithAvatars.length === 0) {
        return res.json({
          success: false,
          message: 'No accounts have downloaded avatars to upload',
          data: []
        });
      }

      // STEP 2: Upload avatars to YouTube one by one
      console.log(`\n📤 STEP 2: Uploading ${accountsWithAvatars.length} avatars to YouTube...\n`);

      const results = [];

      // Process accounts one by one
      for (let i = 0; i < accountsWithAvatars.length; i++) {
        const account = accountsWithAvatars[i];
        console.log(`\n📦 Processing ${i + 1}/${accountsWithAvatars.length}: ${account.email}...`);
        
        const result = await uploadAvatarForAccount(account);
        results.push(result);
        
        console.log(`✅ Completed: ${result.success ? 'Success' : 'Failed'}\n`);
        
        if (i < accountsWithAvatars.length - 1) {
          console.log('⏳ Waiting 3s before next account...\n');
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        success: true,
        message: `Completed: ${successCount} success, ${failCount} failed`,
        data: results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      });

    } catch (error) {
      console.error('❌ Controller Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async uploadAvatarSingle(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Account ID is required'
        });
      }

      // Get account by ID
      const account = await AccountYoutube.findByPk(id);

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }

      if (!account.is_create_channel || !account.channel_link) {
        return res.status(400).json({
          success: false,
          message: 'Account does not have a YouTube channel yet'
        });
      }

      if (!account.avatar_url) {
        return res.status(400).json({
          success: false,
          message: 'Account does not have avatar URL'
        });
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🖼️  UPLOAD AVATAR FOR SINGLE ACCOUNT`);
      console.log(`📧 Email: ${account.email}`);
      console.log(`🔗 Avatar URL: ${account.avatar_url}`);
      console.log(`${'='.repeat(60)}\n`);

      // STEP 1: Download avatar if not exists
      const avatarsDir = path.join(__dirname, '../../avatars');
      const fs = require('fs');
      let imageName = account.image_name;

      if (!imageName || !fs.existsSync(path.join(avatarsDir, imageName))) {
        console.log('📥 Downloading avatar from Facebook...');
        
        const downloadResult = await facebDownloader.downloadAvatar(
          account.avatar_url,
          account.email,
          avatarsDir
        );

        if (!downloadResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to download avatar',
            error: downloadResult.error
          });
        }

        imageName = downloadResult.imageName;
        
        // Update image_name in database
        await AccountYoutube.update(
          { image_name: imageName },
          { where: { id: account.id } }
        );

        console.log(`✅ Avatar downloaded: ${imageName}`);
      } else {
        console.log(`✓ Avatar already exists: ${imageName}`);
      }

      // STEP 2: Upload avatar to YouTube
      console.log('\n📤 Uploading avatar to YouTube...\n');

      const result = await uploadAvatarForAccount({
        ...account.toJSON(),
        image_name: imageName
      });

      if (result.success) {
        return res.json({
          success: true,
          message: 'Avatar uploaded successfully',
          data: result
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to upload avatar',
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Upload Avatar Single Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

async function createChannelForAccount(account) {
  let browser = null;
  let page = null;
  
  try {
    console.log(`\n🌐 [${account.email}] Launching browser...`);
    
    // Use HEADLESS for YouTube operations
    const headless = process.env.HEADLESS === 'true';
    // Launch browser with profile (if exists) and reuse session when possible
    const launchResult = await browserService.launchBrowser(headless, account.email);
    browser = launchResult.browser;
    page = launchResult.page;

    // Check session and auto re-login if expired
    await ensureLoggedIn(page, account.email, account.password);

    // Create channel
    const channelName = account.channel_name || `Channel ${account.email.split('@')[0]}`;
    const createResult = await youtubeService.createChannel(page, channelName);

    // Check if phone verification is required
    if (createResult.requiresPhoneVerification) {
      console.log(`⚠️  [${account.email}] Phone verification required`);
      
      // Keep browser open for manual phone verification
      console.log('📱 Please verify phone manually in the browser. Browser will stay open.');
      console.log('⏳ Waiting for manual verification (60 seconds)...');
      
      // Wait for user to complete phone verification
      await new Promise(r => setTimeout(r, 60000));
      
      // Check again if we can proceed
      console.log('🔄 Checking if phone verification was completed...');
      const channelInfo = await youtubeService.getChannelInfo(page);
      
      if (!channelInfo.link) {
        throw new Error('Phone verification not completed. Please verify manually and try again.');
      }
      
      // If channel link exists, verification was successful
      console.log('✅ Phone verification appears successful, continuing...');
      
      // Update database
      const actualChannelName = createResult.channelName || channelInfo.name || channelName;
      const updateData = {
        channel_name: actualChannelName,
        is_create_channel: true,
        channel_link: channelInfo.link
      };
      
      await AccountYoutube.update(updateData, { where: { id: account.id } });
      
      console.log(`💾 [${account.email}] Đã lưu thông tin channel vào database`);
      console.log(`📝 Tên channel thực tế: "${actualChannelName}"`);
      
      await browser.close();
      console.log(`✅ [${account.email}] Browser closed (session saved)`);
      
      return {
        email: account.email,
        success: true,
        channelName: actualChannelName,
        channelLink: channelInfo.link,
        phoneVerificationRequired: true
      };
    }

    if (!createResult.created) {
      throw new Error(createResult.message || 'Failed to create channel');
    }

    // Get channel info
    const channelInfo = await youtubeService.getChannelInfo(page);

    // Update database with actual channel name
    const actualChannelName = createResult.channelName || channelInfo.name || channelName;
    const updateData = {
      channel_name: actualChannelName,
      is_create_channel: true
    };
    
    // Only add channel_link if it's a valid URL
    if (channelInfo.link && channelInfo.link.startsWith('http')) {
      updateData.channel_link = channelInfo.link;
    }

    await AccountYoutube.update(updateData, { where: { id: account.id } });

    console.log(`💾 [${account.email}] Đã lưu thông tin channel vào database`);
    console.log(`📝 Tên channel thực tế: "${actualChannelName}"`);

    // Avatar upload is now a separate step - use POST /api/v1/youtube/upload-avatar
    console.log('ℹ️  Avatar upload is a separate step. Download avatars first, then upload.');

    // Close browser WITHOUT logout to keep cookies/session
    await browser.close();
    console.log(`✅ [${account.email}] Browser closed (session saved)`);

    return {
      email: account.email,
      success: true,
      channelName: actualChannelName,
      channelLink: channelInfo.link
    };

  } catch (error) {
    console.error(`❌ [${account.email}] Error:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }

    return {
      email: account.email,
      success: false,
      error: error.message
    };
  }
}

async function uploadAvatarForAccount(account) {
  let browser = null;
  let shouldCloseBrowser = true; // Flag to track if we should close browser
  
  try {
    // Extract channel ID using helper
    const channelId = fileHelper.extractChannelId(account.channel_link);
    if (!channelId) {
      throw new Error('Invalid channel link');
    }

    console.log(`\n🌐 [${account.email}] Launching browser...`);
    
    // Check if browser is already open (from accounts.controller openBrowsers)
    // Import the openBrowsers map from accounts.controller
    const accountsController = require('./accounts.controller');
    const openBrowsers = accountsController.getOpenBrowsersMap?.() || new Map();
    
    let page;
    
    if (openBrowsers.has(account.email)) {
      console.log(`♻️  [${account.email}] Reusing already open browser...`);
      const browserInfo = openBrowsers.get(account.email);
      browser = browserInfo.browser;
      shouldCloseBrowser = false; // Don't close - user opened it manually
      
      // Create new page in existing browser
      page = await browserService.createPage(browser);
    } else {
      console.log(`🆕 [${account.email}] Launching new browser...`);
      // Use HEADLESS for YouTube operations
      const headless = process.env.HEADLESS === 'true';
      // Launch browser with profile to reuse session when available
      const launchResult = await browserService.launchBrowser(headless, account.email);
      browser = launchResult.browser;
      page = launchResult.page;
    }

    // Check session and auto re-login if expired
    await ensureLoggedIn(page, account.email, account.password);

    const avatarsDir = path.join(__dirname, '../../avatars');
    const fs = require('fs');
    
    // Check if avatar file exists
    if (!account.image_name || !fs.existsSync(path.join(avatarsDir, account.image_name))) {
      throw new Error('Avatar file not found. Please download avatars first.');
    }

    const avatarPath = path.join(avatarsDir, account.image_name);
    console.log(`📸 Using avatar file: ${account.image_name}`);

    // Upload avatar to YouTube Studio
    await youtubeService.uploadAvatar(page, channelId, avatarPath);

    // Mark avatar as uploaded
    await AccountYoutube.update(
      { is_upload_avatar: true },
      { where: { id: account.id } }
    );

    console.log(`💾 [${account.email}] Đã upload avatar`);

    // Close browser only if we launched it (not if reusing user's open browser)
    if (shouldCloseBrowser) {
      await browser.close();
      console.log(`✅ [${account.email}] Browser closed (session saved)`);
    } else {
      // Close only the page we created
      await page.close();
      console.log(`✅ [${account.email}] Page closed (browser kept open for user)`);
    }

    return {
      email: account.email,
      success: true,
      channelId,
      avatar: account.image_name
    };

  } catch (error) {
    console.error(`❌ [${account.email}] Error:`, error.message);
    
    // Only close browser if we launched it
    if (browser && shouldCloseBrowser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }

    return {
      email: account.email,
      success: false,
      error: error.message
    };
  }
}

module.exports = new YoutubeController();
