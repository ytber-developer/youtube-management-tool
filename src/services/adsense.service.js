const browserService = require('./browser.service');
const googleAuthService = require('./google.auth.service');

class AdsenseService {
  constructor() {}

  async _checkAccount(account, timeoutMs = 60000) {
    const result = {
      email: account.email,
      password: account.password || null,
      success: false,
      status: 'fail',
      message: '',
      screenshotBase64: null
    };

    let browser;
    let page;
    try {
      // Launch visible browser without using stored profile (fresh)
      const launch = await browserService.launchBrowser(false, null, 1, false);
      browser = launch.browser;
      page = launch.page;

      // Go to Google sign-in via accounts flow
      try {
        await page.goto('https://accounts.google.com/ServiceLogin', { waitUntil: 'networkidle2', timeout: 45000 });
      } catch (e) {
        // ignore navigation errors and continue
      }

      // Attempt to login using google auth service, pass twofa secret if available
      // Provide redirectUrl to continue to AdSense after login
      try {
        await googleAuthService.login(page, account.email, account.password, account.twofa || null, 'https://www.google.com/adsense/');
      } catch (loginErr) {
        result.message = `Login failed: ${loginErr.message}`;
        result.status = 'die';
        // Capture screenshot
        try {
          result.screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
        } catch (sErr) {}
        return result;
      }

      // Navigate to AdSense main page
      try {
        await page.goto('https://www.google.com/adsense/', { waitUntil: 'networkidle2', timeout: 60000 });
        // Wait for body to be available and allow dynamic content to load
        await page.waitForSelector('body', { timeout: 100000 });
        await new Promise(r => setTimeout(r, 4000));
      } catch (e) {
        // ignore
      }

      // Check for common error indicators on the page
      const check = await page.evaluate(() => {
        const text = document.body ? document.body.innerText : '';
        const low = text.toLowerCase();
        const hasMaterialError = Array.from(document.querySelectorAll('.material-icons')).some(el => el.textContent.trim().toLowerCase() === 'error');
        const hasAlert = !!document.querySelector('[role="alert"], .error, .adsense-error, .notice');
        return { text, low, textSnippet: low.slice(0, 2000), hasMaterialError, hasAlert };
      });

      // Debug log snippet to help diagnose cases where login succeeded but content not detected
      try {
        console.log(`🔎 AdSense page text length=${check.low.length}. Snippet:\n${check.textSnippet.slice(0,300)}`);
      } catch (e) { /* ignore logging errors */ }

      // Map known phrases to statuses
      // Priority: login failures handled above -> 'die'
      // Fail: account closed/disabled/suspended/not approved
      if (
        check.low.includes('your account has been closed') ||
        check.low.includes('your account has been closed by google') ||
        check.low.includes("your account wasn't approved") ||
        check.low.includes('not approved') ||
        check.low.includes('suspended') ||
        check.low.includes('disabled')
      ) {
        result.status = 'fail';
        // Vietnamese message
        result.message = 'Tài khoản của bạn đã bị đóng hoặc không được phê duyệt bởi Google.';
        try { result.screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true }); } catch (sErr) {}
        return result;
      }

      // Success: detect YouTube earnings / account approved
      if (check.low.includes('youtube earnings') || check.low.includes('earnings')) {
        result.status = 'ok';
        result.success = true;
        result.message = 'Tài khoản có thu nhập YouTube (OK)';
        return result;
      }

      // Pending / under review indicators (English + Vietnamese variants)
      if (
        check.low.includes('we are reviewing your information') ||
        check.low.includes('we are reviewing your info') ||
        check.low.includes('we are reviewing') ||
        check.low.includes('we are reviewing your') ||
        check.low.includes("we're reviewing your information") ||
        check.low.includes("we're reviewing your info") ||
        check.low.includes("we're reviewing") ||
        check.low.includes('đang chờ') ||
        check.low.includes('chúng tôi đang xem xét thông tin của bạn') ||
        // Non-accented fallback
        check.low.includes('chung toi dang xem xet thong tin cua ban')
      ) {
        result.status = 'pending';
        result.message = 'Chúng tôi đang xem xét thông tin của bạn.';
        try { result.screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true }); } catch (sErr) {}
        return result;
      }

      if (check.hasMaterialError || check.hasAlert || check.textSnippet.includes('access denied') || check.textSnippet.includes('not eligible') || check.textSnippet.includes('you are not eligible')) {
        result.status = 'fail';
        result.message = `AdSense error detected (${check.hasMaterialError ? 'material-icon' : 'alert'})`;
        try { result.screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true }); } catch (sErr) {}
        return result;
      }

      // Default: mark as ok
      result.success = true;
      result.status = 'ok';
      result.message = 'AdSense page loaded with no obvious errors';
      return result;
    } catch (error) {
      result.message = `Unexpected error: ${error.message}`;
      try {
        if (page) result.screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: true });
      } catch (sErr) {}
      return result;
    } finally {
      try {
        if (browser) await browser.close();
      } catch (e) {}
    }
  }

  async checkAccounts(accounts = [], options = {}) {
    const concurrency = options.concurrency || 3;
    const timeoutMs = options.timeoutMs || 60000;

    const results = [];

    // Process in batches of concurrency
    for (let i = 0; i < accounts.length; i += concurrency) {
      const batch = accounts.slice(i, i + concurrency);
      const promises = batch.map(acc => {
        const promise = this._checkAccount(acc, timeoutMs);
        // Wrap with timeout
        const timeout = new Promise(resolve => setTimeout(() => resolve({
          email: acc.email,
          password: acc.password || null,
          success: false,
          status: 'fail',
          message: `Timed out after ${timeoutMs}ms`
        }), timeoutMs));
        return Promise.race([promise, timeout]);
      });

      // Await batch
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }
}

module.exports = new AdsenseService();
