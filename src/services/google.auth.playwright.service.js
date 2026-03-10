const authenticatorService = require('./authenticator.service');

class GoogleAuthPlaywrightService {
  
  async login(page, email, password) {
    try {
      console.log(`🔐 Đang đăng nhập (Playwright): ${email}`);

      await page.goto('https://accounts.google.com/signin', { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });
      
      // Email
      console.log('📧 Nhập email...');
      await page.waitForSelector('input[type="email"]', { timeout: 20000 });
      await page.waitForTimeout(1000);
      
      // Clear and type email
      await page.click('input[type="email"]');
      await page.evaluate(() => {
        const input = document.querySelector('input[type="email"]');
        if (input) input.value = '';
      });
      await page.fill('input[type="email"]', email);
      
      // Click Next button
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const btn = document.querySelector('#identifierNext');
        if (btn) btn.click();
      });
      
      await page.waitForTimeout(4000);

      // Check email error
      const errorEmail = await page.$('.o6cuMc');
      if (errorEmail) {
        const errorText = await page.evaluate(el => el?.textContent, errorEmail);
        throw new Error(`Email error: ${errorText}`);
      }

      // Password
      console.log('🔑 Nhập password...');
      await page.waitForSelector('input[type="password"]', { timeout: 20000, state: 'visible' });
      await page.waitForTimeout(1500);
      
      // Type password
      await page.click('input[type="password"]');
      await page.evaluate(() => {
        const input = document.querySelector('input[type="password"]');
        if (input) input.value = '';
      });
      await page.fill('input[type="password"]', password);
      
      await page.waitForTimeout(2000);
      
      // Click Next button for password
      await page.evaluate(() => {
        const btn = document.querySelector('#passwordNext');
        if (btn) btn.click();
      });

      console.log('⏳ Đợi đăng nhập...');
      await page.waitForTimeout(5000);

      // Check for 2FA
      console.log('🔍 Kiểm tra 2FA...');
      const has2FA = await page.$('input[name="totpPin"]');
      
      if (has2FA) {
        console.log('🔐 Phát hiện 2FA, đang xử lý...');
        
        // Get authenticator code from account
        const account = await this.getAccountByEmail(email);
        
        if (!account || !account.code_authenticators) {
          throw new Error('2FA required but no authenticator code found');
        }

        const code = authenticatorService.generateCode(account.code_authenticators);
        console.log(`🔢 2FA Code: ${code}`);
        
        await page.waitForTimeout(1000);
        await page.fill('input[name="totpPin"]', code);
        await page.waitForTimeout(1500);
        
        // Click Next
        await page.evaluate(() => {
          const btn = document.querySelector('#totpNext');
          if (btn) btn.click();
        });
        
        console.log('⏳ Đợi xác thực 2FA...');
        await page.waitForTimeout(5000);
      }

      console.log('✅ Đăng nhập thành công!');
      return true;

    } catch (error) {
      console.error('❌ Lỗi đăng nhập:', error.message);
      throw error;
    }
  }

  async getAccountByEmail(email) {
    try {
      const { AccountYoutube } = require('../models');
      const account = await AccountYoutube.findOne({
        where: { email }
      });
      return account;
    } catch (error) {
      console.error('Error getting account:', error);
      return null;
    }
  }
}

module.exports = new GoogleAuthPlaywrightService();
