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
        autoComment = false,
        autoLike = false,
        autoSubscribe = false,
        batchSize = 5,
        proxyFile = null,
        proxyList = null
      } = req.body;

      const selectedChannels = req.body.selectedChannels || req.body.emails || [];

      // Normalize selectedChannels into ids and emails
      const channelIds = [];
      const channelEmails = [];
      if (Array.isArray(selectedChannels)) {
        for (const v of selectedChannels) {
          if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
            channelIds.push(Number(v));
          } else if (typeof v === 'string' && v.trim() !== '') {
            channelEmails.push(v);
          }
        }
      }

      if (!videoUrl) {
        return res.status(400).json({ success: false, message: 'videoUrl is required' });
      }

      const isValidYouTubeUrl =
        videoUrl.includes('youtube.com/watch') ||
        videoUrl.includes('youtube.com/shorts/') ||
        videoUrl.includes('youtu.be/');

      if (!isValidYouTubeUrl) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL. Supported: youtube.com/watch, youtube.com/shorts, youtu.be'
        });
      }

      if (autoComment && !useAccounts) {
        return res.status(400).json({
          success: false,
          message: 'autoComment requires useAccounts=true (must be logged in)'
        });
      }

      // Load proxies if provided
      let proxies = [];
      if (proxyFile || proxyList) {
        proxies = antiDetectionHelper.loadProxies(proxyFile || proxyList);
        console.log(`🌐 Loaded ${proxies.length} proxies`);
      }

      console.log(`\n🎬 Starting video watch task...`);
      console.log(`📹 Video URL: ${videoUrl}`);
      console.log(`⏱️  Duration: ${duration}s | Batch: ${batchSize} | Accounts: ${useAccounts}`);
      console.log(`💬 Comment: ${autoComment} | 👍 Like: ${autoLike} | 📺 Subscribe: ${autoSubscribe}`);
      console.log(`📨 Selected: ${selectedChannels.length ? selectedChannels.join(', ') : 'None'}\n`);

      // Fetch accounts
      let accounts = [];
      if (useAccounts && (channelIds.length > 0 || channelEmails.length > 0)) {
        const where = {};
        if (channelIds.length > 0) where.id = channelIds;
        if (channelEmails.length > 0) where.email = channelEmails;
        accounts = await AccountYoutube.findAll({ where });
        console.log(`👥 Found ${accounts.length} matching accounts`);
      } else if (useAccounts) {
        accounts = await AccountYoutube.findAll({
          where: { is_create_channel: true },
          limit: parseInt(tabs, 10) || 10
        });
        console.log(`👥 Found ${accounts.length} accounts with channels`);
      }

      // Determine targets
      let targets = [];
      let tabsToOpen = 0;

      if (useAccounts && accounts.length > 0) {
        targets = accounts;
        tabsToOpen = targets.length;
      } else {
        tabsToOpen = parseInt(tabs, 10) || 1;
      }

      const processedBatchSize = parseInt(batchSize, 10) || 4;
      const totalBatches = Math.ceil(tabsToOpen / processedBatchSize);

      console.log(`🚀 Opening ${tabsToOpen} tabs in batches of ${processedBatchSize}...\n`);

      const results = [];
      const watchOptions = { humanBehavior, randomDuration, autoComment, autoLike, autoSubscribe };

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * processedBatchSize;
        const batchEnd = Math.min(batchStart + processedBatchSize, tabsToOpen);
        const currentBatchSize = batchEnd - batchStart;

        console.log(`\n📦 Batch ${batchIndex + 1}/${totalBatches}: tabs ${batchStart + 1}-${batchEnd}...`);

        const watchPromises = [];

        for (let i = batchStart; i < batchEnd; i++) {
          const account = targets[i] || null;
          const proxy = proxies.length > 0 ? antiDetectionHelper.getRandomProxy(proxies) : null;
          watchPromises.push(this.watchInSingleTab(videoUrl, duration, account, i + 1, watchOptions, proxy));
        }

        const batchResults = await Promise.allSettled(watchPromises);

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

        const batchSuccess = batchResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        console.log(`✅ Batch ${batchIndex + 1} done: ${batchSuccess}/${currentBatchSize} OK\n`);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      console.log(`\n✅ Done: ${successCount}/${tabsToOpen} tabs watched\n`);

      return res.json({
        success: true,
        message: `Watched video in ${successCount}/${tabsToOpen} tabs`,
        data: results,
        summary: { total: tabsToOpen, success: successCount, failed: failCount, videoUrl, duration }
      });

    } catch (error) {
      console.error('❌ Controller Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Watch video in a single tab
   */
  async watchInSingleTab(videoUrl, duration, account = null, tabIndex = 1, options = {}, proxy = null) {
    let browser = null;

    try {
      const label = account ? account.email : `Anonymous-${tabIndex}`;
      console.log(`\n🌐 [Tab ${tabIndex}] [${label}] ${proxy ? `Proxy: ${proxy.server}` : 'No proxy'}`);

      const headless = process.env.HEADLESS === 'true';
      const profileEmail = account ? account.email : null;

      const launchResult = await browserService.launchBrowser(headless, profileEmail, 3, true);
      browser = launchResult.browser;
      const page = launchResult.page;

      // Apply proxy auth if needed
      if (proxy?.username && proxy?.password) {
        try {
          await page.authenticate({ username: proxy.username, password: proxy.password });
        } catch (e) {
          console.warn(`⚠️ [Tab ${tabIndex}] Proxy auth failed: ${e.message}`);
        }
      }

      // Check login state and login if needed
      if (account) {
        let skipLogin = false;
        try {
          await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 800));

          skipLogin = await page.evaluate(() => {
            const avatar = document.querySelector('#avatar-btn, tp-yt-paper-icon-button#avatar-btn');
            if (avatar) return true;
            const bodyText = document.body?.innerText?.toLowerCase() || '';
            return !bodyText.includes('sign in') && !bodyText.includes('đăng nhập');
          });

          console.log(`🔐 [Tab ${tabIndex}] ${skipLogin ? 'Already signed in' : 'Need to login'} [${account.email}]`);
        } catch (e) {
          console.warn(`⚠️ [Tab ${tabIndex}] Cannot detect sign-in state: ${e.message}`);
        }

        if (!skipLogin) {
          console.log(`🔐 [Tab ${tabIndex}] Logging in as ${account.email}...`);
          await googleAuthService.login(page, account.email, account.password);
        }
      }

      // Delegate to watch service (handles navigation + watching)
      await watchService.watchVideo(page, videoUrl, duration, options);

      await browser.close();
      console.log(`✅ [Tab ${tabIndex}] [${label}] Done`);

      return { tabIndex, account: label, proxy: proxy?.server || 'none', success: true, duration };

    } catch (error) {
      console.error(`❌ [Tab ${tabIndex}] Error:`, error.message);
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
      return { tabIndex, account: account?.email || 'anonymous', proxy: proxy?.server || 'none', success: false, error: error.message };
    }
  }
}

module.exports = new WatchController();
