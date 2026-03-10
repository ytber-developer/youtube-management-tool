const speakeasy = require('speakeasy');
const fs = require('fs');
const path = require('path');

class AuthenticatorService {
  
  async clickAuthenticatorLink(page) {
    console.log('🔍 Đang tìm link "Authenticator"...');
    await new Promise(r => setTimeout(r, 2000));

    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const authLink = links.find(link => 
        link.textContent?.includes('Authenticator') || 
        link.href?.includes('authenticator')
      );
      if (authLink) {
        authLink.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('✅ Đã click vào Authenticator');
      await new Promise(r => setTimeout(r, 3000));
    }

    return clicked;
  }

  async clickSetupButton(page) {
    console.log('🔍 Đang tìm nút "Set up authenticator"...');
    
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span'));
      const setupBtn = buttons.find(btn => 
        btn.textContent?.includes('Set up') || 
        btn.textContent?.includes('authenticator')
      );
      if (setupBtn) {
        setupBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('✅ Đã click "Set up authenticator"');
      await new Promise(r => setTimeout(r, 4000));
    }

    return clicked;
  }

  async clickCantScanButton(page) {
    console.log('\n🔍 Đang tìm nút "Can\'t scan it?"...');
    await new Promise(r => setTimeout(r, 4000)); // Đợi lâu hơn để popup hiển thị đầy đủ

    let clickedCantScan = false;

    // Method 1: Try direct button selector inside center tag
    try {
      console.log('📍 Thử method 1: Tìm button trong center tag...');
      const cantScanButton = await page.$('center button[jsname="Pr7Yme"]');
      if (cantScanButton) {
        const text = await page.evaluate(el => el?.textContent || '', cantScanButton);
        if (text.includes("Can't scan")) {
          console.log('✅ Tìm thấy button "Can\'t scan it?" trong center tag');
          console.log('🖱️  Đang click...');
          await cantScanButton.click();
          await new Promise(r => setTimeout(r, 3000));
          console.log('✅ Đã click "Can\'t scan it?"');
          console.log('🎉 Bây giờ bạn sẽ thấy secret key để copy!');
          clickedCantScan = true;
          return true;
        }
      }
    } catch (e) {
      console.log('⚠️  Method 1 failed');
    }

    // Method 2: Find all buttons with jsname Pr7Yme
    if (!clickedCantScan) {
      try {
        console.log('� Thử method 2: Tìm tất cả buttons với jsname="Pr7Yme"...');
        const allButtons = await page.$$('button[jsname="Pr7Yme"]');
        console.log(`   Tìm thấy ${allButtons.length} buttons`);
        
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = await page.evaluate(el => el?.textContent || '', button);
          const trimmed = text.trim();
          const lower = trimmed.toLowerCase();
          
          // Show hex codes for debugging
          const hexCodes = [...trimmed].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
          
          console.log(`\n   Button ${i + 1}:`);
          console.log(`      Raw text: "${text}"`);
          console.log(`      Trimmed: "${trimmed}"`);
          console.log(`      Hex codes: ${hexCodes}`);
          console.log(`      Length: ${trimmed.length}`);
          console.log(`      Lowercase: "${lower}"`);
          
          // Normalize special characters (curly quotes, etc.)
          const normalized = lower
            .replace(/[\u2018\u2019]/g, "'")  // Replace curly single quotes
            .replace(/[\u201C\u201D]/g, '"')  // Replace curly double quotes
            .replace(/\s+/g, ' ');             // Normalize whitespace
          
          console.log(`      Normalized: "${normalized}"`);
          
          // Debug: kiểm tra từng điều kiện
          const hasApostrophe = normalized.includes("can't scan");
          const noApostrophe = normalized.includes("cant scan");
          const hasSpace = normalized.includes("can t scan");
          
          console.log(`      Has "can't scan": ${hasApostrophe}`);
          console.log(`      Has "cant scan": ${noApostrophe}`);
          console.log(`      Has "can t scan": ${hasSpace}`);
          
          if (hasApostrophe || noApostrophe || hasSpace) {
            console.log(`\n✅ ✅ ✅ MATCH FOUND ở button thứ ${i + 1}!`);
            console.log('🖱️  Đang click...');
            
            try {
              await button.click();
              console.log('✅ Click command executed');
              await new Promise(r => setTimeout(r, 3000));
              console.log('✅ Đã click "Can\'t scan it?"');
              console.log('🎉 Bây giờ bạn sẽ thấy secret key để copy!');
              clickedCantScan = true;
              return true;
            } catch (clickErr) {
              console.log('❌ Lỗi khi click:', clickErr);
            }
          } else {
            console.log(`      ❌ No match`);
          }
          console.log(''); // Empty line for readability
        }
        
        if (!clickedCantScan) {
          console.log('⚠️  Method 2: Không tìm thấy text "Can\'t scan" trong các button');
        }
      } catch (e) {
        console.log('⚠️  Method 2 failed:', e);
      }
    }

    // Method 3: Use evaluate to find and click
    if (!clickedCantScan) {
      try {
        console.log('📍 Thử method 3: Dùng evaluate để tìm và click...');
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const cantScanBtn = buttons.find((btn) => 
            btn.textContent?.includes("Can't scan it?") || 
            btn.textContent?.includes("Can't scan")
          );
          if (cantScanBtn) {
            cantScanBtn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 3000));
          console.log('✅ Đã click "Can\'t scan it?" bằng evaluate');
          console.log('🎉 Bây giờ bạn sẽ thấy secret key để copy!');
          clickedCantScan = true;
          return true;
        }
      } catch (e) {
        console.log('⚠️  Method 3 failed:', e);
      }
    }

    if (!clickedCantScan) {
      console.log('\n⚠️  Không tìm thấy nút "Can\'t scan it?" sau 3 methods');
      console.log('👉 Popup có thể chưa load xong');
      console.log('👉 Bạn có thể click thủ công trong browser');
      console.log('📋 Vị trí: Trong popup QR code → button "Can\'t scan it?"');
    }

    return clickedCantScan;
  }

  async extractSecretKey(page) {
    try {
      console.log('🔍 Đang tìm secret key...');

      // Method 1: Find in li.mzEcT with strong tag
      const secretKeyFromGoogle = await page.evaluate(() => {
        const listItems = Array.from(document.querySelectorAll('li.mzEcT'));
        
        for (const li of listItems) {
          const text = li.textContent || '';
          
          if (text.includes('key') && (text.includes("spaces don't matter") || text.includes('Enter your email'))) {
            const strong = li.querySelector('strong');
            if (strong) {
              const keyText = strong.textContent?.trim() || '';
              const cleaned = keyText.replace(/\s/g, '').toUpperCase();
              
              if (cleaned.length >= 16 && cleaned.length <= 32 && /^[A-Z2-7]+$/.test(cleaned)) {
                return cleaned;
              }
            }
          }
        }
        
        return null;
      });

      if (secretKeyFromGoogle) {
        return secretKeyFromGoogle;
      }

      // Method 2: Find in all elements
      const secretKey = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, span, strong, code'));
        
        const blacklist = [
          'SKIP', 'MAIN', 'CONTENT', 'AUTHENTICATOR', 'SETUP',
          'NAVIGATION', 'MENU', 'BUTTON', 'NEXT', 'BACK',
          'GOOGLE', 'ACCOUNT', 'SECURITY', 'SETTINGS'
        ];

        for (const el of elements) {
          const isInButton = el.closest('button') !== null;
          const isInNav = el.closest('nav') !== null;
          const isInHeader = el.closest('header') !== null;

          if (isInButton || isInNav || isInHeader) continue;

          const text = el.textContent?.trim() || '';
          const cleaned = text.replace(/\s/g, '').toUpperCase();

          const hasBlacklistedWord = blacklist.some(word => cleaned.includes(word));
          
          if (!hasBlacklistedWord &&
              cleaned.length >= 16 && 
              cleaned.length <= 32 && 
              /^[A-Z2-7]+$/.test(cleaned)) {
            return cleaned;
          }
        }
        
        return null;
      });

      return secretKey;
    } catch (error) {
      console.error('❌ Lỗi extract secret key:', error);
      return null;
    }
  }

  generateOTP(secretKey) {
    return speakeasy.totp({
      secret: secretKey,
      encoding: 'base32'
    });
  }

  async clickNextButton(page) {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, span[role="button"]'));
      const nextBtn = buttons.find(btn => {
        const text = btn.textContent?.trim() || '';
        return text === 'Next' || text === 'Tiếp theo';
      });
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('✅ Đã click "Next"');
      await new Promise(r => setTimeout(r, 2000));
    }

    return clicked;
  }

  async enterOTP(page, otpCode) {
    const otpInputSelectors = [
      'input[jsname="YPqjbf"]',
      'input[placeholder*="Enter Code"]',
      'input[type="text"][autocomplete="off"]'
    ];

    for (const selector of otpInputSelectors) {
      try {
        const otpInput = await page.$(selector);
        if (otpInput) {
          console.log('✅ Tìm thấy input OTP');
          // Clear input using evaluate instead of keyboard
          await page.evaluate(el => {
            el.value = '';
            el.focus();
          }, otpInput);
          await otpInput.type(otpCode, { delay: 100 });
          console.log('✅ Đã nhập OTP code');
          return true;
        }
      } catch (e) {
        // Continue
      }
    }

    return false;
  }

  async clickVerifyButton(page) {
    await new Promise(r => setTimeout(r, 1500));

    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, span[role="button"], span[jsname="V67aGc"]'));
      const verifyBtn = buttons.find(btn => {
        const text = btn.textContent?.trim() || '';
        return text === 'Verify' || text === 'Xác minh';
      });
      if (verifyBtn) {
        verifyBtn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('✅ Đã click "Verify"');
      await new Promise(r => setTimeout(r, 4000));
    }

    return clicked;
  }

  async clickTurnOnLink(page) {
    console.log('🔍 Đang tìm link "Turn on"...');
    await new Promise(r => setTimeout(r, 2000));

    const clicked = await page.evaluate(() => {
      // Try to find by aria-label or class
      const turnOnLink = document.querySelector('a.UywwFc-mRLv6.UywwFc-RLmnJb[aria-label="Turn on"]');
      if (turnOnLink) {
        turnOnLink.click();
        return true;
      }

      // Fallback: find any link with "Turn on" text
      const links = Array.from(document.querySelectorAll('a'));
      const link = links.find(l => {
        const text = l.textContent?.trim() || '';
        const ariaLabel = l.getAttribute('aria-label') || '';
        return text === 'Turn on' || ariaLabel === 'Turn on';
      });
      
      if (link) {
        link.click();
        return true;
      }
      
      return false;
    });

    if (clicked) {
      console.log('✅ Đã click "Turn on"');
      await new Promise(r => setTimeout(r, 3000));
    }

    return clicked;
  }

  /**
   * Click "Turn on 2-Step Verification" button
   * 
   * IMPORTANT: This function uses strict filtering to avoid clicking wrong buttons:
   * 
   * 1. BLACKLIST approach:
   *    - Skip buttons containing keywords: 'phone', 'number', 'add', 'skip', 'remind', 'not now'
   *    - This prevents clicking "Add a phone number" button by mistake
   * 
   * 2. EXACT match requirement:
   *    - Only accept buttons with EXACT text: "Turn on 2-Step Verification"
   *    - No partial match to avoid ambiguity
   * 
   * 3. Visibility check:
   *    - Skip disabled or hidden buttons
   * 
   * 4. Multiple fallback methods:
   *    - Method 1: Find all buttons, collect info, filter with strict rules
   *    - Method 2: Use evaluate with same filtering logic
   *    - Method 3: Partial match as last resort (still with blacklist)
   */
  async clickTurnOn2StepButton(page) {
    console.log('🔍 Đang tìm nút "Turn on 2-Step Verification"...');
    
    // Wait a bit for page to settle after OTP verification
    await new Promise(r => setTimeout(r, 3000));

    let clicked = false;

    // Method 0: Wait for button to appear first
    try {
      console.log('📍 Đang đợi button xuất hiện...');
      await page.waitForSelector('button[jsname="Pr7Yme"]', {
        timeout: 10000,
        visible: true
      });
      console.log('✅ Có button với jsname="Pr7Yme" xuất hiện');
    } catch (e) {
      console.log('⚠️  Không thấy button xuất hiện sau 10s');
      await this.debugPageContent(page, `turn-on-2step-timeout-${Date.now()}`);
    }

    // Method 1: Find ALL buttons first, then filter by EXACT match with blacklist
    try {
      console.log('📍 Thử method 1: Tìm tất cả buttons và filter chính xác...');
      const buttons = await page.$$('button[jsname="Pr7Yme"]');
      console.log(`   Tìm thấy ${buttons.length} buttons với jsname="Pr7Yme"`);
      
      // Collect info about all buttons first
      const buttonsInfo = [];
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const info = await page.evaluate(el => {
          const ariaLabel = el.getAttribute('aria-label') || '';
          const span = el.querySelector('span[jsname="V67aGc"]');
          const text = span ? span.textContent?.trim() : el.textContent?.trim();
          const isVisible = el.offsetParent !== null;
          const isDisabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
          
          return {
            ariaLabel,
            text,
            isVisible,
            isDisabled
          };
        }, button);
        
        buttonsInfo.push({
          index: i,
          button,
          ...info
        });
      }
      
      // Log all buttons
      console.log('\n📋 Danh sách tất cả buttons:');
      buttonsInfo.forEach((info, idx) => {
        console.log(`   Button ${idx + 1}:`);
        console.log(`      aria-label: "${info.ariaLabel}"`);
        console.log(`      text: "${info.text}"`);
        console.log(`      visible: ${info.isVisible}`);
        console.log(`      disabled: ${info.isDisabled}`);
      });
      console.log('');
      
      // BLACKLIST: Skip buttons related to phone or other unwanted actions
      const blacklistKeywords = ['phone', 'number', 'add', 'skip', 'remind', 'not now'];
      
      // WHITELIST: Only accept buttons with EXACT match
      const validButtons = buttonsInfo.filter(info => {
        // Must be visible and not disabled
        if (!info.isVisible || info.isDisabled) {
          console.log(`   ⏭️  Skip button ${info.index + 1} (not visible or disabled)`);
          return false;
        }
        
        // Check blacklist
        const combinedText = (info.ariaLabel + ' ' + info.text).toLowerCase();
        for (const keyword of blacklistKeywords) {
          if (combinedText.includes(keyword)) {
            console.log(`   ⏭️  Skip button ${info.index + 1} (blacklist keyword: "${keyword}")`);
            return false;
          }
        }
        
        // Check for EXACT match with "Turn on 2-Step Verification"
        const isExactMatch = 
          info.ariaLabel === 'Turn on 2-Step Verification' || 
          info.text === 'Turn on 2-Step Verification';
        
        if (!isExactMatch) {
          console.log(`   ⏭️  Skip button ${info.index + 1} (not exact match)`);
          return false;
        }
        
        console.log(`   ✅ Button ${info.index + 1} is VALID (exact match + not blacklisted)`);
        return true;
      });
      
      if (validButtons.length === 0) {
        console.log('❌ Không tìm thấy button hợp lệ sau khi filter');
      } else if (validButtons.length === 1) {
        console.log(`\n✅ Tìm thấy ĐÚNG 1 button hợp lệ tại index ${validButtons[0].index + 1}`);
        
        const targetButton = validButtons[0].button;
        
        // Scroll to element
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), targetButton);
        await new Promise(r => setTimeout(r, 500));
        
        await targetButton.click();
        await new Promise(r => setTimeout(r, 4000));
        console.log('✅ Đã click "Turn on 2-Step Verification"');
        clicked = true;
        return true;
      } else {
        console.log(`⚠️  Tìm thấy ${validButtons.length} buttons hợp lệ (lỗi logic?)`);
        console.log('   Sẽ click button đầu tiên...');
        
        const targetButton = validButtons[0].button;
        
        // Scroll to element
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), targetButton);
        await new Promise(r => setTimeout(r, 500));
        
        await targetButton.click();
        await new Promise(r => setTimeout(r, 4000));
        console.log('✅ Đã click "Turn on 2-Step Verification"');
        clicked = true;
        return true;
      }
    } catch (e) {
      console.log('⚠️  Method 1 failed:', e.message);
    }

    // Method 2: Use evaluate with strict filtering (fallback)
    if (!clicked) {
      try {
        console.log('📍 Thử method 2: Dùng evaluate với strict filtering...');
        clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button[jsname="Pr7Yme"]'));
          
          const blacklist = ['phone', 'number', 'add', 'skip', 'remind', 'not now'];
          
          const validButton = buttons.find(btn => {
            // Must be visible
            if (btn.offsetParent === null || btn.disabled) {
              return false;
            }
            
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const span = btn.querySelector('span[jsname="V67aGc"]');
            const text = span ? span.textContent?.trim() : btn.textContent?.trim();
            const combinedText = (ariaLabel + ' ' + text).toLowerCase();
            
            // Check blacklist
            for (const keyword of blacklist) {
              if (combinedText.includes(keyword)) {
                return false;
              }
            }
            
            // EXACT match only
            return ariaLabel === 'Turn on 2-Step Verification' || 
                   text === 'Turn on 2-Step Verification';
          });
          
          if (validButton) {
            validButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            validButton.click();
            return true;
          }
          
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 4000));
          console.log('✅ Đã click "Turn on 2-Step Verification" bằng evaluate (method 2)');
          return true;
        }
      } catch (e) {
        console.log('⚠️  Method 2 failed:', e.message);
      }
    }

    // Method 3: Partial match as last resort (but still with blacklist)
    if (!clicked) {
      try {
        console.log('📍 Thử method 3: Partial match với blacklist...');
        clicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          
          const blacklist = ['phone', 'number', 'add', 'skip', 'remind', 'not now'];
          
          const validButton = buttons.find(btn => {
            // Must be visible
            if (btn.offsetParent === null || btn.disabled) {
              return false;
            }
            
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const span = btn.querySelector('span[jsname="V67aGc"]');
            const text = span ? span.textContent?.trim() : btn.textContent?.trim();
            const combinedText = (ariaLabel + ' ' + text).toLowerCase();
            
            // Check blacklist first
            for (const keyword of blacklist) {
              if (combinedText.includes(keyword)) {
                return false;
              }
            }
            
            // Partial match with "Turn on 2-Step"
            return combinedText.includes('turn on 2-step');
          });
          
          if (validButton) {
            validButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            validButton.click();
            return true;
          }
          
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 4000));
          console.log('✅ Đã click "Turn on 2-Step Verification" bằng evaluate (method 3)');
          return true;
        }
      } catch (e) {
        console.log('⚠️  Method 3 failed:', e.message);
      }
    }

    if (!clicked) {
      console.log('❌ Không tìm thấy nút "Turn on 2-Step Verification"');
      console.log('💡 Có thể button chưa xuất hiện hoặc đã có 2FA rồi');
      console.log('🔍 Tất cả methods đều đã kiểm tra blacklist để tránh click nhầm vào "Add phone number"');
      
      // Save debug info
      await this.debugPageContent(page, `turn-on-2step-not-found-${Date.now()}`);
    }

    return clicked;
  }

  /**
   * Reload page and retry clicking "Turn on 2-Step Verification"
   * This helps avoid phone number popup by refreshing the page state
   */
  async reloadPageAndRetryTurnOn(page) {
    console.log('🔄 Reload page và retry clicking "Turn on 2-Step Verification"...');
    
    try {
      // Reload the page
      console.log('🔄 Đang reload page...');
      await page.reload({ waitUntil: 'load' });
      console.log('✅ Page reloaded');
      
      // Wait for page to stabilize
      await new Promise(r => setTimeout(r, 3000));
      
      // Try to click "Turn on 2-Step Verification" again
      console.log('🔍 Đang tìm "Turn on 2-Step Verification" button sau reload...');
      const clicked = await this.clickTurnOn2StepButton(page);
      
      if (clicked) {
        console.log('✅ Đã click "Turn on 2-Step Verification" sau reload!');
        return true;
      } else {
        console.log('⚠️  Vẫn không tìm thấy button sau reload');
        return false;
      }
    } catch (error) {
      console.log('❌ Error reloading and retrying:', error.message);
      return false;
    }
  }

  async clickDoneButton(page) {
    console.log('🔍 Đang tìm nút "Done"...');
    await new Promise(r => setTimeout(r, 2000));

    let clicked = false;

    // Method 1: Find by text content
    try {
      console.log('📍 Thử method 1: Tìm button với text "Done"...');
      clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const doneBtn = buttons.find(btn => {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          return text === 'Done' || ariaLabel === 'Done' || 
                 text === 'Xong' || ariaLabel === 'Xong';
        });
        
        if (doneBtn) {
          doneBtn.click();
          return true;
        }
        
        return false;
      });

      if (clicked) {
        await new Promise(r => setTimeout(r, 3000));
        console.log('✅ Đã click "Done"');
        return true;
      }
    } catch (e) {
      console.log('⚠️  Method 1 failed:', e.message);
    }

    // Method 2: Find by jsname
    if (!clicked) {
      try {
        console.log('📍 Thử method 2: Tìm button với jsname...');
        const buttons = await page.$$('button[jsname="Pr7Yme"]');
        
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent?.trim() || '', button);
          
          if (text === 'Done' || text === 'Xong') {
            console.log('✅ Tìm thấy button "Done"');
            await button.click();
            await new Promise(r => setTimeout(r, 3000));
            console.log('✅ Đã click "Done"');
            clicked = true;
            return true;
          }
        }
      } catch (e) {
        console.log('⚠️  Method 2 failed:', e.message);
      }
    }

    if (!clicked) {
      console.log('⚠️  Không tìm thấy nút "Done", có thể đã hoàn tất');
    }

    return clicked;
  }

  // Helper function to debug page content
  async debugPageContent(page, filename) {
    try {
      const debugDir = path.join(__dirname, '../../debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      // Save HTML
      const html = await page.content();
      const htmlPath = path.join(debugDir, `${filename}.html`);
      fs.writeFileSync(htmlPath, html);
      console.log(`🔍 Saved HTML to: ${htmlPath}`);
      
      // Save screenshot
      const screenshotPath = path.join(debugDir, `${filename}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Saved screenshot to: ${screenshotPath}`);
    } catch (error) {
      console.log('⚠️  Debug failed:', error.message);
    }
  }

  /**
   * Detect if Google is prompting for phone number
   * Returns true if phone number popup is detected
   */
  async detectPhoneNumberPopup(page) {
    console.log('🔍 Checking for phone number popup...');
    
    try {
      await new Promise(r => setTimeout(r, 2000));
      
      const hasPhonePopup = await page.evaluate(() => {
        // Look for text indicating phone number requirement
        const phoneKeywords = [
          'add a phone number',
          'phone number',
          'add phone',
          'verify your phone',
          'enter your phone',
          'recovery phone'
        ];
        
        const bodyText = document.body.textContent?.toLowerCase() || '';
        
        // Check if any phone-related keyword exists
        for (const keyword of phoneKeywords) {
          if (bodyText.includes(keyword)) {
            return true;
          }
        }
        
        // Also check for phone input fields
        const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[placeholder*="phone"]');
        if (phoneInputs.length > 0) {
          return true;
        }
        
        return false;
      });
      
      if (hasPhonePopup) {
        console.log('📱 Detected phone number popup!');
        await this.debugPageContent(page, `phone-popup-detected-${Date.now()}`);
      } else {
        console.log('✅ No phone number popup detected');
      }
      
      return hasPhonePopup;
    } catch (error) {
      console.log('⚠️  Error detecting phone popup:', error.message);
      return false;
    }
  }

  /**
   * Handle phone number popup by adding a phone number
   * Returns true if phone was added successfully
   */
  async handlePhoneNumberPopup(page, phoneNumber) {
    console.log('📱 Handling phone number popup...');
    
    try {
      // Wait for phone input to appear
      await new Promise(r => setTimeout(r, 2000));
      
      // Find and fill phone input
      const phoneInputSelectors = [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[placeholder*="phone"]',
        'input[autocomplete="tel"]'
      ];
      
      let phoneInputFilled = false;
      for (const selector of phoneInputSelectors) {
        try {
          const phoneInput = await page.$(selector);
          if (phoneInput) {
            console.log(`✅ Found phone input with selector: ${selector}`);
            await phoneInput.click();
            await new Promise(r => setTimeout(r, 500));
            await phoneInput.type(phoneNumber, { delay: 100 });
            console.log('✅ Entered phone number');
            phoneInputFilled = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!phoneInputFilled) {
        console.log('❌ Could not find phone input field');
        return false;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      // Click Next or Continue button
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(btn => {
          const text = btn.textContent?.trim()?.toLowerCase() || '';
          return text === 'next' || text === 'continue' || text === 'tiếp theo' || text === 'tiếp tục';
        });
        
        if (nextBtn && !nextBtn.disabled) {
          nextBtn.click();
          return true;
        }
        return false;
      });
      
      if (!clicked) {
        console.log('⚠️  Could not find Next/Continue button');
        return false;
      }
      
      console.log('✅ Clicked Next/Continue button');
      await new Promise(r => setTimeout(r, 3000));
      
      // Check if verification code is required
      const needsVerification = await page.evaluate(() => {
        const bodyText = document.body.textContent?.toLowerCase() || '';
        return bodyText.includes('verification code') || 
               bodyText.includes('enter the code') ||
               bodyText.includes('verify');
      });
      
      if (needsVerification) {
        console.log('📱 Phone verification code may be required');
        console.log('⚠️  You may need to manually enter the verification code');
        // Wait longer for manual intervention
        await new Promise(r => setTimeout(r, 30000));
      }
      
      return true;
    } catch (error) {
      console.log('❌ Error handling phone popup:', error.message);
      return false;
    }
  }

  /**
   * Skip phone number popup by clicking Skip/Not now
   * Returns true if skip was successful
   */
  async skipPhoneNumberPopup(page) {
    console.log('⏭️  Attempting to skip phone number popup...');
    
    try {
      await new Promise(r => setTimeout(r, 1000));
      
      const clicked = await page.evaluate(() => {
        const skipKeywords = ['skip', 'not now', 'maybe later', 'bỏ qua', 'để sau'];
        const buttons = Array.from(document.querySelectorAll('button, a, span[role="button"]'));
        
        const skipBtn = buttons.find(btn => {
          const text = btn.textContent?.trim()?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          
          for (const keyword of skipKeywords) {
            if (text.includes(keyword) || ariaLabel.includes(keyword)) {
              return true;
            }
          }
          return false;
        });
        
        if (skipBtn) {
          skipBtn.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log('✅ Clicked skip button');
        await new Promise(r => setTimeout(r, 3000));
        return true;
      } else {
        console.log('⚠️  Could not find skip button');
        return false;
      }
    } catch (error) {
      console.log('⚠️  Error skipping phone popup:', error.message);
      return false;
    }
  }
}

module.exports = new AuthenticatorService();
