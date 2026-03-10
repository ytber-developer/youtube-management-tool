const { chromium } = require('playwright');

class BrowserPlaywrightService {
  
  async launchBrowser(headless = null) {
    const isHeadless = headless !== null 
      ? headless 
      : process.env.HEADLESS === 'true';
    
    console.log(`🌐 Launching Chrome (Playwright) ${isHeadless ? '(headless)' : '(visible)'}...`);

    try {
      const browser = await chromium.launch({
        headless: isHeadless,
        channel: 'chrome', // Use real Chrome instead of Chromium
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      console.log('✅ Chrome (Playwright) launched successfully');
      return browser;
    } catch (error) {
      console.error('❌ Chrome launch failed:', error.message);
      throw error;
    }
  }

  async createPage(browser) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });
    
    // Hide automation indicators
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });
    
    const page = await context.newPage();
    
    console.log(`🔧 Playwright page created with Chrome`);
    
    return page;
  }

  async clearSession(page) {
    try {
      // Clear cookies via context
      const context = page.context();
      await context.clearCookies();
      
      // Clear storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      console.log('🧹 Playwright session cleared');
    } catch (error) {
      console.warn('⚠️  Could not clear session:', error.message);
    }
  }
}

module.exports = new BrowserPlaywrightService();
