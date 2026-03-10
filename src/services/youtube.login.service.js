const browserService = require('./browser.service');
const googleAuthService = require('./google.auth.service');
const sessionService = require('./session.service');
const { AccountYoutube } = require('../models');

class YoutubeLoginService {

  /**
   * Đăng nhập YouTube với một account
   * @param {string} email - Email của account
   * @param {string} password - Password (optional, sẽ lấy từ DB nếu không truyền)
   * @param {object} options - Các tùy chọn
   * @param {boolean} options.headless - Chạy headless mode (default: từ env)
   * @param {boolean} options.keepBrowserOpen - Giữ browser mở sau khi login (default: false)
   * @param {string} options.navigateTo - URL để navigate sau khi login (default: youtube.com)
   * @param {boolean} options.useProfile - Use browser profile to save session (default: true)
   * @returns {Promise<object>} - Kết quả đăng nhập
   */
  async login(email, password = null, options = {}) {
    const {
      headless = null,
      keepBrowserOpen = false,
      navigateTo = 'https://www.youtube.com',
      useProfile = true
    } = options;

    let browser = null;
    let page = null;

    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🎬 BẮT ĐẦU ĐĂNG NHẬP YOUTUBE`);
      console.log(`📧 Email: ${email}`);
      if (useProfile && sessionService.hasProfile(email)) {
        console.log(`📂 Profile found - will reuse session`);
      }
      console.log(`${'='.repeat(50)}\n`);

      // Lấy thông tin account từ DB nếu không truyền password
      let account = null;
      if (!password) {
        account = await AccountYoutube.findOne({ where: { email } });
        if (!account) {
          throw new Error(`Không tìm thấy account với email: ${email}`);
        }
        password = account.password;
      }

      // Khởi tạo browser with profile if enabled
      const browserResult = await browserService.launchBrowser(headless, useProfile ? email : null, 3, true);
      browser = browserResult.browser;
      page = browserResult.page;
      
      if (browserResult.isNewBrowser) {
        console.log('🆕 Launched new browser');
      } else {
        console.log('🔄 Reused existing browser, opened new tab');
      }

      // Đăng nhập Google
      await googleAuthService.login(page, email, password);

      // Navigate đến YouTube
      console.log(`\n🌐 Đang chuyển đến ${navigateTo}...`);
      await page.goto(navigateTo, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(r => setTimeout(r, 3000));

      // Kiểm tra đã đăng nhập thành công chưa
      const isLoggedIn = await this.checkYoutubeLoginStatus(page);

      if (!isLoggedIn) {
        throw new Error('Không thể xác nhận trạng thái đăng nhập YouTube');
      }

      // Cập nhật last_login_at trong DB
      if (account) {
        await account.update({ last_login_at: new Date() });
      } else {
        await AccountYoutube.update(
          { last_login_at: new Date() },
          { where: { email } }
        );
      }

      console.log(`\n${'='.repeat(50)}`);
      console.log(`✅ ĐĂNG NHẬP YOUTUBE THÀNH CÔNG!`);
      if (useProfile) {
        console.log(`💾 Session đã được lưu vào profile - lần sau không cần login`);
      }
      console.log(`${'='.repeat(50)}\n`);

      const result = {
        success: true,
        email,
        message: 'Đăng nhập YouTube thành công',
        loginAt: new Date().toISOString()
      };

      // Đóng browser nếu không giữ lại
      if (!keepBrowserOpen) {
        await this.closeBrowser(browser);
        return result;
      }

      // Trả về cả browser và page nếu keepBrowserOpen = true
      return {
        ...result,
        browser,
        page
      };

    } catch (error) {
      console.error(`\n❌ LỖI ĐĂNG NHẬP: ${error.message}`);

      // Đóng browser khi gặp lỗi
      if (browser && !keepBrowserOpen) {
        await this.closeBrowser(browser);
      }

      return {
        success: false,
        email,
        message: error.message,
        error: error.message
      };
    }
  }

  /**
   * Đăng nhập nhiều account cùng lúc
   * @param {Array<{email: string, password?: string}>} accounts - Danh sách accounts
   * @param {object} options - Các tùy chọn
   * @param {number} options.concurrentLimit - Số lượng browser chạy song song (default: 3)
   * @param {number} options.delayBetween - Delay giữa các lần login (ms) (default: 2000)
   * @returns {Promise<object>} - Kết quả đăng nhập
   */
  async loginMultiple(accounts, options = {}) {
    const {
      concurrentLimit = parseInt(process.env.CONCURRENT_TABS) || 3,
      delayBetween = 2000
    } = options;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 BẮT ĐẦU ĐĂNG NHẬP ${accounts.length} ACCOUNTS`);
    console.log(`📊 Concurrent limit: ${concurrentLimit}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Xử lý theo batch
    for (let i = 0; i < accounts.length; i += concurrentLimit) {
      const batch = accounts.slice(i, i + concurrentLimit);
      console.log(`\n📦 Batch ${Math.floor(i / concurrentLimit) + 1}: ${batch.length} accounts`);

      const batchPromises = batch.map(async (acc, index) => {
        // Delay để tránh rate limit
        await new Promise(r => setTimeout(r, index * delayBetween));
        return this.login(acc.email, acc.password);
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Delay giữa các batch
      if (i + concurrentLimit < accounts.length) {
        console.log(`\n⏳ Đợi ${delayBetween}ms trước batch tiếp theo...`);
        await new Promise(r => setTimeout(r, delayBetween));
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 KẾT QUẢ: ${successCount} thành công, ${failCount} thất bại`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: failCount === 0,
      message: `Completed: ${successCount} success, ${failCount} failed`,
      summary: {
        total: accounts.length,
        success: successCount,
        failed: failCount
      },
      data: results
    };
  }

  /**
   * Đăng nhập tất cả accounts từ database
   * @param {object} filter - Điều kiện lọc (Sequelize where clause)
   * @param {object} options - Các tùy chọn cho loginMultiple
   * @returns {Promise<object>} - Kết quả đăng nhập
   */
  async loginFromDatabase(filter = {}, options = {}) {
    console.log('📂 Đang lấy danh sách accounts từ database...');

    const accounts = await AccountYoutube.findAll({
      where: filter,
      attributes: ['email', 'password']
    });

    if (accounts.length === 0) {
      return {
        success: true,
        message: 'Không có account nào cần đăng nhập',
        summary: { total: 0, success: 0, failed: 0 },
        data: []
      };
    }

    console.log(`📋 Tìm thấy ${accounts.length} accounts`);

    const accountList = accounts.map(acc => ({
      email: acc.email,
      password: acc.password
    }));

    return this.loginMultiple(accountList, options);
  }

  /**
   * Kiểm tra trạng thái đăng nhập YouTube
   * @param {object} page - Puppeteer page
   * @returns {Promise<boolean>}
   */
  async checkYoutubeLoginStatus(page) {
    try {
      console.log('🔍 Kiểm tra trạng thái đăng nhập YouTube...');

      // Kiểm tra avatar/button đăng nhập
      const isLoggedIn = await page.evaluate(() => {
        // Tìm avatar của user (đã đăng nhập)
        const avatarButton = document.querySelector('button#avatar-btn');
        const avatarImg = document.querySelector('img#img[alt*="Avatar"]');
        const accountMenu = document.querySelector('ytd-topbar-menu-button-renderer');

        // Tìm nút Sign in (chưa đăng nhập)
        const signInButton = document.querySelector('a[href*="accounts.google.com/ServiceLogin"]');
        const signInText = document.querySelector('yt-button-shape a[aria-label="Sign in"]');

        // Đã đăng nhập nếu có avatar và không có nút sign in
        if ((avatarButton || avatarImg || accountMenu) && !signInButton && !signInText) {
          return true;
        }

        return false;
      });

      if (isLoggedIn) {
        console.log('✅ Đã xác nhận đăng nhập YouTube thành công');
      } else {
        console.log('⚠️ Chưa phát hiện trạng thái đăng nhập');
      }

      return isLoggedIn;
    } catch (error) {
      console.error('❌ Lỗi kiểm tra trạng thái:', error.message);
      return false;
    }
  }

  /**
   * Đóng browser an toàn
   * @param {object} browser - Puppeteer browser
   */
  async closeBrowser(browser) {
    try {
      if (browser) {
        await browser.close();
        console.log('🔒 Đã đóng browser');
      }
    } catch (error) {
      console.error('⚠️ Lỗi đóng browser:', error.message);
    }
  }
}

module.exports = new YoutubeLoginService();
