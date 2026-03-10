const { AccountYoutube } = require('../models');
const browserService = require('../services/browser.service');
const googleAuthService = require('../services/google.auth.service');
const watchService = require('../services/watch.service');
const antiDetectionHelper = require('../helpers/anti-detection.helper');

class WatchController {
  
  /**
   * Watch a video with multiple tabs (anonymous or with accounts)
   */
  async watchVideo(req, res) {
    try {
      const { 
        videoUrl, 
        tabs = 1, 
        duration = 30, 
        useAccounts = false,
        humanBehavior = true,
        randomDuration = false,
        autoComment = false,        // ⚡ NEW: Auto comment on video
        batchSize = 4,
        proxyFile = null,           // ⚡ NEW: Path to proxy file
        proxyList = null            // ⚡ NEW: Array of proxies
      } = req.body;

      // New: accept explicit list of emails or ids (selectedChannels) to use for viewing
      const selectedChannels = req.body.selectedChannels || req.body.emails || [];
      const PROCESS_BATCH_SIZE = 3; // Always process in batches of 3

      // Normalize selectedChannels: separate numeric ids and string emails
      const channelIds = [];
      const channelEmails = [];
      if (Array.isArray(selectedChannels)) {
        for (const v of selectedChannels) {
          if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
            channelIds.push(Number(v));
          } else if (typeof v === 'string' && v.includes('@')) {
            channelEmails.push(v);
          } else if (typeof v === 'string' && v.trim() !== '') {
            // treat non-numeric strings as emails if they contain alpha characters
            channelEmails.push(v);
          }
        }
      }

      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          message: 'videoUrl is required'
        });
      }

      // Validate YouTube URL (support regular videos, shorts, and short links)
      const isValidYouTubeUrl = 
        videoUrl.includes('youtube.com/watch') || 
        videoUrl.includes('youtube.com/shorts/') || 
        videoUrl.includes('youtu.be/');
        
      if (!isValidYouTubeUrl) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL. Supported formats: youtube.com/watch, youtube.com/shorts, youtu.be'
        });
      }

      // ⚡ Validate: Auto comment requires logged-in accounts
      if (autoComment && !useAccounts) {
        return res.status(400).json({
          success: false,
          message: 'autoComment requires useAccounts=true (must be logged in)'
        });
      }

      // ⚡ Load proxies if provided
      let proxies = [];
      if (proxyFile || proxyList) {
        proxies = antiDetectionHelper.loadProxies(proxyFile || proxyList);
        console.log(`🌐 Loaded ${proxies.length} proxies for rotation`);
      }

      console.log(`\n🎬 Starting video watch task...`);
      console.log(`📹 Video URL: ${videoUrl}`);
      console.log(`📊 Requested tabs (ignored, fixed to): ${PROCESS_BATCH_SIZE}`);
      console.log(`🔢 Batch Size: ${batchSize} tabs at a time`);
      console.log(`⏱️  Duration: ${duration}s per tab`);
      console.log(`👤 Use Accounts: ${useAccounts}`);
      console.log(`🎭 Human Behavior: ${humanBehavior}`);
      console.log(`🎲 Random Duration: ${randomDuration}`);
      console.log(`💬 Auto Comment: ${autoComment}`);
      console.log(`📨 Emails provided: ${selectedChannels && selectedChannels.length ? selectedChannels.join(', ') : 'None'}`);
      console.log(`🌐 Proxies: ${proxies.length > 0 ? `${proxies.length} available` : 'None'}\n`);

      let accounts = [];
      // If useAccounts and selectedChannels provided, fetch matching accounts (limit to selected list)
      if (useAccounts && (channelIds.length > 0 || channelEmails.length > 0)) {
        const where = {};
        if (channelIds.length > 0) where.id = channelIds;
        if (channelEmails.length > 0) where.email = channelEmails;

        accounts = await AccountYoutube.findAll({
          where,
          // limit to how many were requested
          limit: Math.max(channelIds.length + channelEmails.length, PROCESS_BATCH_SIZE)
        });

        if (!accounts || accounts.length === 0) {
          console.log('⚠️ No matching accounts found for provided selectedChannels — will use anonymous tabs for missing slots');
        } else {
          console.log(`👥 Found ${accounts.length} matching accounts`);
        }
      } else if (useAccounts) {
        // If useAccounts requested but no selectedChannels supplied, try to fetch any accounts with channels up to TARGET_TABS
        accounts = await AccountYoutube.findAll({
          where: { is_create_channel: true },
          limit: TARGET_TABS
        });

        if (!accounts || accounts.length === 0) {
          console.log('⚠️ No accounts with channels found in database — will fall back to anonymous tabs');
        } else {
          console.log(`👥 Found ${accounts.length} accounts with channels`);
        }
      }

      const results = [];
      
      // Decide targets and total tabs to open:
      // - If user provided selectedChannels and useAccounts=true -> open for each matching account (one tab per profile)
      // - Otherwise fallback to opening anonymous tabs using the provided `tabs` param
      let tabsToOpen = 0;
      let targets = []; // array of account objects or null

      if (useAccounts && (channelIds.length > 0 || channelEmails.length > 0)) {
        // Use the fetched accounts as targets
        targets = accounts || [];
        tabsToOpen = targets.length;
      } else if (useAccounts && accounts && accounts.length > 0) {
        targets = accounts;
        tabsToOpen = targets.length;
      } else {
        // No profiles supplied/available -> open anonymous tabs based on tabs param
        tabsToOpen = parseInt(tabs, 10) || 1;
      }

      console.log(`🚀 Opening ${tabsToOpen} tabs (profiles: ${targets.length}) in batches of ${PROCESS_BATCH_SIZE}...\n`);

      const watchOptions = {
        humanBehavior,
        randomDuration,
        autoComment        // ⚡ Pass to watch service
      };
      
      // Process in fixed batches of PROCESS_BATCH_SIZE
      const totalBatches = Math.ceil(tabsToOpen / PROCESS_BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, tabsToOpen);
        const currentBatchSize = batchEnd - batchStart;
        
        console.log(`\n📦 Batch ${batchIndex + 1}/${totalBatches}: Opening ${currentBatchSize} tabs (${batchStart + 1}-${batchEnd})...`);
        
        const watchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          // Use account from targets if available at this index, otherwise anonymous
          const account = (targets && targets[i]) ? targets[i] : null;
           
           // ⚡ Get random proxy for this tab (if proxies available)
           const proxy = proxies.length > 0 
             ? antiDetectionHelper.getRandomProxy(proxies) 
             : null;
          
          watchPromises.push(
            this.watchInSingleTab(videoUrl, duration, account, i + 1, watchOptions, proxy)
          );
        }

        const batchResults = await Promise.allSettled(watchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              tabIndex: batchStart + index + 1,
              success: false,
              error: result.reason?.message || 'Unknown error'
            });
          }
        });
        
        const batchSuccess = batchResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ Batch ${batchIndex + 1} completed: ${batchSuccess}/${currentBatchSize} successful\n`);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      console.log(`\n✅ Completed: ${successCount}/${tabsToOpen} tabs watched successfully\n`);

      res.json({
        success: true,
        message: `Watched video in ${successCount}/${tabsToOpen} tabs`,
        data: results,
        summary: {
          total: tabsToOpen,
          success: successCount,
          failed: failCount,
          videoUrl,
          duration
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

  /**
   * Watch video in a single tab
   */
  async watchInSingleTab(videoUrl, duration, account = null, tabIndex = 1, options = {}, proxy = null) {
    let browser = null;
    
    try {
      const label = account ? account.email : `Anonymous-${tabIndex}`;
      const proxyLabel = proxy ? `🌐 Proxy: ${proxy.server}` : '🌐 No proxy';
      console.log(`\n🌐 [Tab ${tabIndex}] [${label}] ${proxyLabel}`);
      console.log(`🚀 [Tab ${tabIndex}] Launching browser...`);
      
      const headless = process.env.HEADLESS === 'true';
      const profileEmail = account ? account.email : null;

      // Use Puppeteer Chrome with stealth plugin (better for YouTube)
      const launchResult = await browserService.launchBrowser(headless, profileEmail, 3, true);
      browser = launchResult.browser;
      
      // Create page with anti-detection
      const page = launchResult.page;

      // If account/profile provided, check whether the profile is already signed in to YouTube
      let skipLogin = false;
      if (account) {
        try {
          // Quick probe to YouTube homepage to detect signed-in state
          await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          // Some page objects (when reusing tabs/profiles) may not implement waitForTimeout
          await new Promise(r => setTimeout(r, 800));

          const signedIn = await page.evaluate(() => {
            try {
              // If avatar button exists in masthead, likely signed in
              const avatar = document.querySelector('#avatar-btn, ytd-masthead #avatar-btn, tp-yt-paper-icon-button#avatar-btn');
              if (avatar) return true;

              // Fallback: search for 'sign in' button text; if not found, assume signed in
              const bodyText = (document.body && document.body.innerText) ? document.body.innerText.toLowerCase() : '';
              const hasSignIn = bodyText.includes('sign in') || bodyText.includes('đăng nhập') || bodyText.includes('đăng nhập vào');
              return !hasSignIn;
            } catch (e) {
              return false;
            }
          });

          if (signedIn) {
            skipLogin = true;
            console.log(`🔐 Profile [${account.email}] appears already signed in — skipping login step`);
          } else {
            console.log(`🔐 Profile [${account.email}] not signed in — will perform login`);
          }
        } catch (e) {
          console.warn(`⚠️ Could not determine signed-in state for profile [${account.email}]: ${e.message}`);
        }
      }

      // If proxy provided and page supports setting proxy via CDP, attempt to set proxy auth
      if (proxy && proxy.username && proxy.password) {
        try {
          await page.authenticate({ username: proxy.username, password: proxy.password });
          console.log(`🔐 [Tab ${tabIndex}] Proxy authentication applied`);
        } catch (e) {
          console.warn(`⚠️ [Tab ${tabIndex}] Failed to apply proxy auth: ${e.message}`);
        }
      }

      // Login if account is provided and not already signed-in
      if (account && !skipLogin) {
        console.log(`🔐 [Tab ${tabIndex}] Logging in as ${account.email}...`);
        await googleAuthService.login(page, account.email, account.password);
      } else if (account && skipLogin) {
        console.log(`🔐 [Tab ${tabIndex}] Using existing signed-in profile for ${account.email}`);
      }

      // Ensure we are on the target video URL before watching
      try {
        await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e) {
        console.warn(`⚠️ [Tab ${tabIndex}] Failed to navigate directly to video URL: ${e.message}`);
      }

      // Watch video with options (human behavior, random duration, etc.)
      await watchService.watchVideo(page, videoUrl, duration, options);

      await browser.close();
      console.log(`✅ [Tab ${tabIndex}] [${label}] Browser closed`);

      return {
        tabIndex,
        account: account ? account.email : 'anonymous',
        proxy: proxy ? proxy.server : 'none',
        success: true,
        duration
      };

    } catch (error) {
      console.error(`❌ [Tab ${tabIndex}] Error:`, error.message);
      
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // Ignore
        }
      }

      return {
        tabIndex,
        account: account ? account.email : 'anonymous',
        proxy: proxy ? proxy.server : 'none',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Watch video with simple email/password login
   */
  async watchWithLogin(req, res) {
    let browser = null;
    
    try {
      const { 
        videoUrl, 
        email, 
        password, 
        duration = 30,
        humanBehavior = true,
        randomDuration = false
      } = req.body;

      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          message: 'videoUrl is required'
        });
      }

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'email and password are required'
        });
      }

      console.log(`\n🎬 Starting video watch with login...`);
      console.log(`📹 Video: ${videoUrl}`);
      console.log(`👤 Email: ${email}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`🎭 Human Behavior: ${humanBehavior}\n`);

      const headless = process.env.HEADLESS === 'true';
      const launchResult = await browserService.launchBrowser(headless);
      browser = launchResult.browser;
      const page = launchResult.page;

      // Login
      console.log(`🔐 Logging in...`);
      await googleAuthService.login(page, email, password);

      // Watch video
      const watchOptions = {
        humanBehavior,
        randomDuration
      };
      
      await watchService.watchVideo(page, videoUrl, duration, watchOptions);

      await browser.close();
      console.log(`✅ Browser closed\n`);

      res.json({
        success: true,
        message: 'Video watched successfully',
        data: {
          videoUrl,
          email,
          duration,
          humanBehavior
        }
      });

    } catch (error) {
      console.error('❌ Error:', error.message);
      
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // Ignore
        }
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new WatchController();
