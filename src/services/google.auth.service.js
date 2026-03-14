const authenticatorService = require('./authenticator.service');
const { AccountYoutube } = require('../models');

class GoogleAuthService {
  
  // Accept optional twofaSecret (TOTP secret) and redirectUrl to use when OTP is requested
  // redirectUrl: if provided, the sign-in flow will continue to this URL after login (e.g. AdSense)
  async login(page, email, password, twofaSecret = null, redirectUrl = null) {
     try {
       console.log(`🔐 Đang đăng nhập: ${email}`);

      // Build target sign-in URL. By default continue to YouTube sign-in flow (existing behavior).
      const defaultContinue = 'https://www.youtube.com/signin?action_handle_signin=true&app=desktop&hl=en&next=https%3A%2F%2Fstudio.youtube.com%2F&feature=redirect_login';
      const continueUrl = redirectUrl ? redirectUrl : defaultContinue;
      const targetUrl = `https://accounts.google.com/v3/signin/identifier?continue=${encodeURIComponent(continueUrl)}&dsh=S788935973%3A1772281503951407&hl=en&ifkv=ASfE1-p0y7tRHUQJOQeCAAHJ5IUJ6UaHDkZ1YOtfn3h9eNtdiw_MAKJABUlSLn5Uo94pI7l9TEdL&passive=true&service=youtube&uilel=3&flowName=GlifWebSignIn&flowEntry=ServiceLogin`;
      await page.evaluate((url) => { window.location.href = url; }, targetUrl);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
      
      await new Promise(r => setTimeout(r, 2000));
      
      // Check if on AccountChooser page first
      const currentUrl = page.url();
      if (currentUrl.includes('accountchooser') || currentUrl.includes('AccountChooser')) {
        console.log('📋 Detected AccountChooser page, checking for account...');
        
        // Check if account is signed out first
        const accountStatus = await page.evaluate((targetEmail) => {
          const accountItems = document.querySelectorAll('[data-identifier]');
          
          for (const item of accountItems) {
            const emailAttr = item.getAttribute('data-identifier');
            const emailText = item.querySelector('[data-email]');
            
            if (emailAttr === targetEmail || (emailText && emailText.textContent === targetEmail)) {
              // Check if this account is signed out
              const signedOutText = item.querySelector('.lrLKwc');
              if (signedOutText && signedOutText.textContent.toLowerCase().includes('signed out')) {
                return 'signed_out';
              }
              return 'active';
            }
          }
          return 'not_found';
        }, email);
        
        console.log(`📊 Account status: ${accountStatus}`);
        
        if (accountStatus === 'signed_out') {
          console.log('⚠️  Account is signed out, clicking "Use another account"...');
          
          // Click "Use another account" to go to fresh login page
          const useAnotherClicked = await page.evaluate(() => {
            const useAnotherBtn = document.querySelector('[jsname="rwl3qc"]');
            if (useAnotherBtn) {
              useAnotherBtn.click();
              return true;
            }
            return false;
          });
          
          if (useAnotherClicked) {
            console.log('✅ Clicked "Use another account", waiting for login page...');
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.log('⚠️  Could not click "Use another account", continuing with email input...');
          }
        } else if (accountStatus === 'active') {
          // Try to click on the account if it exists and is active
          const accountClicked = await this.clickAccountInChooser(page, email);
          
          if (accountClicked) {
            console.log('✅ Account clicked, continuing to password...');
            await new Promise(r => setTimeout(r, 2000));
            
            // Now should be on password page, continue with password entry
            const hasPasswordInput = await page.$('input[type="password"]');
            if (!hasPasswordInput) {
              console.log('⚠️  No password input found, assuming already logged in');
              return true;
            }
            // Continue to password entry below
          } else {
            console.log('⚠️  Could not click account, continuing with full login...');
          }
        } else {
          console.log('ℹ️  Account not found in chooser, continuing with email input...');
        }
      }
      
      // Check if email input is present (not already on password page)
      const hasEmailInput = await page.$('input[type="email"]');
      
      if (hasEmailInput) {
        // Email
        console.log('📧 Nhập email...');
        await page.waitForSelector('input[type="email"]', { timeout: 20000 });
        await new Promise(r => setTimeout(r, 1000));
        
        // Clear and type email
        await page.click('input[type="email"]');
        await page.evaluate(() => {
          const input = document.querySelector('input[type="email"]');
          if (input) input.value = '';
        });
        await page.type('input[type="email"]', email, { delay: 100 });
        
        // Click Next button
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => {
          const btn = document.querySelector('#identifierNext');
          if (btn) btn.click();
        });
        
        await new Promise(r => setTimeout(r, 4000));

        // Check email error
        const errorEmail = await page.$('.o6cuMc');
        if (errorEmail) {
          const errorText = await page.evaluate(el => el?.textContent, errorEmail);
          throw new Error(`Email error: ${errorText}`);
        }
      } else {
        console.log('ℹ️  Email input not found, assuming already past email step');
      }

      // Password
      console.log('🔑 Nhập password...');
      await page.waitForSelector('input[type="password"]', { timeout: 20000, visible: true });
      await new Promise(r => setTimeout(r, 1500));
      
      // Clear and type password with multiple attempts
      let passwordEntered = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/3 to enter password...`);
          
          // Method 1: Click and type
          await page.click('input[type="password"]');
          await new Promise(r => setTimeout(r, 500));
          
          // Clear existing value
          await page.evaluate(() => {
            const input = document.querySelector('input[type="password"]');
            if (input) {
              input.value = '';
              input.focus();
            }
          });
          
          // Type password slowly
          await page.type('input[type="password"]', password, { delay: 120 });
          await new Promise(r => setTimeout(r, 500));
          
          // Verify password was entered
          const enteredValue = await page.evaluate(() => {
            const input = document.querySelector('input[type="password"]');
            return input ? input.value : '';
          });
          
          if (enteredValue === password) {
            console.log('   ✅ Password entered successfully');
            passwordEntered = true;
            break;
          } else {
            console.log(`   ⚠️  Password mismatch. Expected length: ${password.length}, Got: ${enteredValue.length}`);
          }
        } catch (e) {
          console.log(`   ❌ Attempt ${attempt} failed:`, e.message);
        }
      }
      
      if (!passwordEntered) {
        throw new Error('Failed to enter password after 3 attempts');
      }
      
      // Click Next button and wait for navigation
      await new Promise(r => setTimeout(r, 1500));
      
      console.log('   Clicking passwordNext button...');
      
      let navigationSuccess = false;
      for (let navAttempt = 1; navAttempt <= 2; navAttempt++) {
        try {
          console.log(`   Navigation attempt ${navAttempt}/2...`);
          
          // Click and wait for navigation/response
          await Promise.all([
            // Wait for either navigation or network idle
            Promise.race([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
              page.waitForResponse(response => 
                response.url().includes('google.com') && response.status() === 200,
                { timeout: 10000 }
              ).catch(() => null)
            ]).catch((e) => {
              console.log(`   No navigation/response: ${e.message}`);
            }),
            
            // Click the button
            page.evaluate(() => {
              const btn = document.querySelector('#passwordNext');
              if (btn) btn.click();
            })
          ]);
          
          console.log('   After passwordNext click, waiting...');
          await new Promise(r => setTimeout(r, 3000));
          
          // Check if page is still valid
          try {
            await page.evaluate(() => document.readyState);
            navigationSuccess = true;
            console.log('   ✅ Navigation successful');
            break;
          } catch (e) {
            console.log(`   ⚠️  Page context lost: ${e.message}`);
            if (navAttempt < 2) {
              console.log('   Retrying...');
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        } catch (e) {
          console.log(`   ❌ Navigation attempt ${navAttempt} error:`, e.message);
          if (navAttempt < 2) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      
      if (!navigationSuccess) {
        throw new Error('Failed to navigate after clicking passwordNext (context destroyed)');
      }

      // Check password error
      const errorPassword = await page.$('.o6cuMc');
      if (errorPassword) {
        const errorText = await page.evaluate(el => el?.textContent, errorPassword);
        throw new Error(`Password error: ${errorText}`);
      }

      // Check for OTP input (2FA already enabled)
      console.log('🔍 Kiểm tra yêu cầu OTP...');
      const otpInput = await page.$('#totpPin');
      
      if (otpInput) {
        console.log('🔐 Phát hiện yêu cầu nhập OTP, đang generate mã...');

        // Determine secret key: prefer provided twofaSecret, fallback to DB
        let secretKey = null;
        if (twofaSecret) {
          secretKey = String(twofaSecret);
        } else {
          const account = await AccountYoutube.findOne({ where: { email: email } });
          if (account && account.code_authenticators) {
            secretKey = account.code_authenticators;
          }
        }

        if (!secretKey) {
          throw new Error('Account không có secret key (2FA)');
        }

        secretKey = secretKey.replace(/\s+/g, '').toUpperCase();
        console.log('Secret key (used):', secretKey ? '[REDACTED]' : null);

        // Generate OTP
        const otp = authenticatorService.generateOTP(secretKey);
        console.log(`🔐 OTP Code generated`);

        // Enter OTP
        await new Promise(r => setTimeout(r, 1000));
        await page.click('#totpPin');
        await new Promise(r => setTimeout(r, 500));
        
        // Clear existing value
        await page.evaluate(() => {
          const input = document.querySelector('#totpPin');
          if (input) {
            input.value = '';
            input.focus();
          }
        });
        
        // Type OTP
        await page.type('#totpPin', otp, { delay: 100 });
        await new Promise(r => setTimeout(r, 1000));
        
        // Click Next/Verify button
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const nextBtn = buttons.find(btn => 
            btn.textContent.includes('Next') || 
            btn.textContent.includes('Tiếp theo') ||
            btn.textContent.includes('Verify') ||
            btn.textContent.includes('Xác minh')
          );
          if (nextBtn) nextBtn.click();
        });

        console.log('✅ Đã nhập OTP');
        await new Promise(r => setTimeout(r, 3000));
      }

      // Check for "Tôi hiểu" or "I understand" button
      console.log('🔍 Kiểm tra popup xác nhận...');
      await new Promise(r => setTimeout(r, 2000));
      
      const confirmSelectors = [
        'input[name="confirm"]',
        'input[value="Tôi hiểu"]',
        'input[value="I understand"]',
        'input.MK9CEd.MVpUfe',
        'button[jsname="M2UYVd"]',
        '#confirm',
        'button[jsname="LgbsSe"]'
      ];

      let confirmClicked = false;
      for (const selector of confirmSelectors) {
        try {
          const confirmButton = await page.$(selector);
          if (confirmButton) {
            console.log('✅ Tìm thấy nút xác nhận, đang click...');
            await confirmButton.click();

            // After clicking try to detect successful dismissal: wait for navigation or for the welcome heading to disappear
            try {
              await Promise.race([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null),
                page.waitForFunction(() => {
                  const heading = document.querySelector('#headingText') || document.querySelector('h2.x9zgF');
                  return !heading || (heading && (heading.offsetParent === null));
                }, { timeout: 8000 }).catch(() => null)
              ]);
            } catch (e) {
              // ignore
            }

            // Always wait a short buffer to avoid immediate redirect which sometimes causes errors
            await new Promise(r => setTimeout(r, 5000));

            console.log('✅ Đã click nút xác nhận');
            confirmClicked = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!confirmClicked) {
        // Try to find the button by its visible text (covers the provided HTML with span text)
        const clickedByText = await page.evaluate(() => {
          const rawTargets = ['i understand', 'tôi hiểu', 'i get it', 'got it', 'toi hieu'];
          const targets = rawTargets.map(t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
          const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

          const selectors = ['button', 'div[role="button"]', '#gaplustosNext', 'div[jsname="Njthtb"]', 'div.TNTaPb', 'div.VfPpkd-dgl2Hf-ppHlrf-sM5MNb'];

          for (const sel of selectors) {
            const elems = Array.from(document.querySelectorAll(sel));
            for (const el of elems) {
              const span = el.querySelector('span');
              const text = span ? span.textContent : el.textContent || '';
              const ntext = norm(text);
              if (!ntext) continue;
              for (const t of targets) {
                if (ntext.includes(t)) {
                  try { el.click(); } catch (e) {}
                  return true;
                }
              }
            }
          }

          return false;
        });

        if (clickedByText) {
          // After clicking via page.evaluate, we still need to wait in Node context for the UI to dismiss
          try {
            await Promise.race([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => null),
              page.waitForFunction(() => {
                const heading = document.querySelector('#headingText') || document.querySelector('h2.x9zgF');
                return !heading || (heading && (heading.offsetParent === null));
              }, { timeout: 8000 }).catch(() => null)
            ]);
          } catch (e) {}

          // Buffer to avoid immediate redirect
          await new Promise(r => setTimeout(r, 5000));

          console.log('✅ Đã click nút xác nhận (bằng nội dung văn bản, bao gồm tiếng Việt)');
          confirmClicked = true;
        }
      }

      if (!confirmClicked) {
        console.log('ℹ️  Không có popup xác nhận');
      }

      console.log('✅ Đăng nhập thành công!');
      return true;

    } catch (error) {
      console.error(`❌ Lỗi đăng nhập: ${error.message}`);
      throw error;
    }
  }

  async navigateTo2FASettings(page) {
    console.log('🔐 Đang chuyển đến trang 2FA settings...');
    
    await page.goto('https://myaccount.google.com/signinoptions/two-step-verification', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 3000));

    // Click "Tôi hiểu" if exists
    await this.clickConfirmButton(page);
  }

  async clickConfirmButton(page) {
    const confirmSelectors = [
      'input[name="confirm"]',
      'input[value="Tôi hiểu"]',
      'input[value="I understand"]',
      'button[jsname="M2UYVd"]'
    ];

    for (const selector of confirmSelectors) {
      try {
        const confirmButton = await page.$(selector);
        if (confirmButton) {
          console.log('✅ Đang click "Tôi hiểu"...');
          await confirmButton.click();
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  /**
   * Kiểm tra xem đã đăng nhập Google chưa
   * @param {Page} page - Puppeteer page
   * @returns {Promise<boolean>} - true nếu đã đăng nhập
   */
  async isLoggedIn(page) {
    try {
      // Navigate to AccountChooser page to check session
      console.log('🔍 Checking login status...');
      await page.goto('https://accounts.google.com/v3/signin/accountchooser?flowName=GlifWebSignIn&flowEntry=ServiceLogin', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(r => setTimeout(r, 2000));

      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Check if on AccountChooser page with "Choose an account" heading
      const accountChooserCheck = await page.evaluate(() => {
        const heading = document.querySelector('#headingText') || 
                       document.querySelector('h1[data-a11y-title-piece]') ||
                       document.querySelector('[data-a11y-title-piece]');
        
        const hasChooseHeading = heading && 
          (heading.textContent.toLowerCase().includes('choose') ||
           heading.textContent.toLowerCase().includes('chọn tài khoản'));
        
        // Check for email input (new login)
        const hasEmailInput = !!document.querySelector('input[type="email"]');
        
        // Check for account list (already have sessions)
        const accountList = document.querySelectorAll('[data-identifier]');
        
        // Check if any account shows "Signed out" status
        let hasSignedOutAccount = false;
        accountList.forEach(item => {
          const signedOutText = item.querySelector('.lrLKwc');
          if (signedOutText && signedOutText.textContent.toLowerCase().includes('signed out')) {
            hasSignedOutAccount = true;
          }
        });
        
        return {
          hasChooseHeading,
          hasEmailInput,
          accountCount: accountList.length,
          hasSignedOutAccount,
          heading: heading?.textContent || ''
        };
      });

      console.log(`🔍 Page check:`, JSON.stringify(accountChooserCheck, null, 2));

      // If has account list with "Signed out" status → session expired, need full re-login
      if (accountChooserCheck.accountCount > 0 && accountChooserCheck.hasSignedOutAccount) {
        console.log(`⚠️  Account found but SIGNED OUT - session expired`);
        console.log('ℹ️  Browser profile needs to be cleared and re-login');
        return false; // Return false to trigger profile cleanup in controller
      }

      // If has "Choose an account" heading with active accounts → can just click to continue
      if (accountChooserCheck.hasChooseHeading && accountChooserCheck.accountCount > 0 && !accountChooserCheck.hasSignedOutAccount) {
        console.log(`✅ Account chooser with active session (${accountChooserCheck.accountCount} accounts)`);
        console.log('ℹ️  Can click on account to continue (no need to login again)');
        return true; // Session is still valid, just need to select account
      }

      // If has email input → definitely not logged in
      if (accountChooserCheck.hasEmailInput) {
        console.log('ℹ️  Not logged in (Email input found)');
        return false;
      }

      // If redirected to myaccount, user is logged in
      if (currentUrl.includes('myaccount.google.com') || 
          currentUrl.includes('accounts.google.com/b/')) {
        console.log('✅ Logged in (Redirected to account page)');
        return true;
      }

      // Check for profile avatar as indicator
      const hasProfileAvatar = await page.evaluate(() => {
        return !!document.querySelector('img[alt*="Google"]') || 
               !!document.querySelector('[data-ogsr-up]') ||
               !!document.querySelector('a[aria-label*="Google Account"]');
      });

      if (hasProfileAvatar) {
        console.log('✅ Logged in (Profile avatar found)');
        return true;
      }

      console.log('⚠️  Unclear login status, assuming NOT logged in');
      return false;

    } catch (error) {
      console.log(`⚠️  Không xác định được trạng thái login: ${error.message}`);
      return false;
    }
  }

  /**
   * Click vào account trong AccountChooser list
   * @param {Page} page - Puppeteer page
   * @param {string} email - Email của account cần click
   * @returns {Promise<boolean>} - true nếu click thành công
   */
  async clickAccountInChooser(page, email) {
    try {
      console.log(`🖱️  Đang click vào account: ${email}`);
      
      // Wait for account list to load
      await page.waitForSelector('[data-identifier]', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 1000));
      
      // Click on the account with matching email
      const clicked = await page.evaluate((targetEmail) => {
        const accountItems = document.querySelectorAll('[data-identifier]');
        
        for (const item of accountItems) {
          const emailAttr = item.getAttribute('data-identifier');
          const emailText = item.querySelector('[data-email]');
          
          if (emailAttr === targetEmail || (emailText && emailText.textContent === targetEmail)) {
            // Check if this account is signed out
            const signedOutText = item.querySelector('.lrLKwc');
            if (signedOutText && signedOutText.textContent.toLowerCase().includes('signed out')) {
              console.log('⚠️  Account is signed out, cannot click');
              return false;
            }
            
            // Click the account
            item.click();
            return true;
          }
        }
        return false;
      }, email);
      
      if (clicked) {
        console.log('✅ Đã click vào account');
        await new Promise(r => setTimeout(r, 3000));
        return true;
      } else {
        console.log('❌ Không tìm thấy account hoặc account đã signed out');
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Lỗi khi click account: ${error.message}`);
      return false;
    }
  }

  async logout(page) {
    try {
      console.log('🚪 Đang logout...');
      await page.goto('https://accounts.google.com/Logout', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });
      await new Promise(r => setTimeout(r, 3000));
      console.log('✅ Đã logout');
    } catch (error) {
      console.error('❌ Lỗi logout:', error);
    }
  }
}

module.exports = new GoogleAuthService();
