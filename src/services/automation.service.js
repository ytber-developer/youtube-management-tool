const puppeteer = require('puppeteer');

class AutomationService {
  
  async initBrowser() {
    return await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async performClickAction(url, selector, action = 'click') {
    const browser = await this.initBrowser();
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 1200 });
      
      console.log(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      await page.waitForSelector(selector, { timeout: 10000 });
      
      if (action === 'click') {
        await page.click(selector);
        console.log(`Clicked on: ${selector}`);
      } else if (action === 'hover') {
        await page.hover(selector);
        console.log(`Hovered on: ${selector}`);
      }
      
      await page.waitForTimeout(2000);
      
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      return {
        success: true,
        screenshot: screenshot
      };
      
    } finally {
      await browser.close();
    }
  }

  async fillForm(url, formData) {
    const browser = await this.initBrowser();
    
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      for (const [selector, value] of Object.entries(formData)) {
        await page.waitForSelector(selector);
        await page.type(selector, value);
        console.log(`Filled ${selector} with: ${value}`);
      }
      
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      return {
        success: true,
        message: 'Form filled successfully',
        screenshot: screenshot
      };
      
    } finally {
      await browser.close();
    }
  }

  async scrapeData(url, selectors) {
    const browser = await this.initBrowser();
    
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const data = {};
      
      for (const [key, selector] of Object.entries(selectors)) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const text = await page.$eval(selector, el => el.textContent.trim());
          data[key] = text;
        } catch (error) {
          data[key] = null;
          console.log(`Could not find: ${selector}`);
        }
      }
      
      return data;
      
    } finally {
      await browser.close();
    }
  }
}

module.exports = new AutomationService();
