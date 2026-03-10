const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FacebDownloaderService {
  
  constructor() {
    // Path to store Facebook cookies
    this.cookiesPath = path.join(__dirname, '../../fb-cookies.json');
  }

  /**
   * Login to Facebook and save cookies
   */
  async loginToFacebook(page) {
    try {
      console.log('🔐 Checking Facebook login status...');
      
      // Try to load existing cookies
      if (fs.existsSync(this.cookiesPath)) {
        console.log('📂 Loading saved Facebook cookies...');
        const cookiesString = fs.readFileSync(this.cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        
        // Check if cookies are still valid (faster with domcontentloaded)
        await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000)); // Reduced from 2000ms
        
        const isLoggedIn = await page.evaluate(() => {
          // Check for logged-in indicators
          return !document.querySelector('input[name="email"]') && 
                 (document.querySelector('[data-visualcompletion="ignore-dynamic"]') || 
                  document.querySelector('[aria-label*="Facebook"]'));
        });
        
        if (isLoggedIn) {
          console.log('✅ Facebook session is active (using saved cookies)');
          return true;
        } else {
          console.log('⚠️  Saved cookies expired, logging in again...');
        }
      }
      
      // Login if no valid cookies
      const fbEmail = process.env.FB_EMAIL;
      const fbPassword = process.env.FB_PASSWORD;
      
      if (!fbEmail || !fbPassword) {
        console.log('⚠️  FB_EMAIL or FB_PASSWORD not set in .env, skipping login');
        console.log('ℹ️  Public photos may still work without login');
        return false;
      }
      
      console.log(`🔐 Logging into Facebook as ${fbEmail}...`);
      
      await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1000)); // Reduced from 2000ms
      
      // Enter email (with shorter timeout)
      const emailInput = await page.waitForSelector('input[name="email"]', { timeout: 5000 }).catch(() => null);
      if (!emailInput) {
        console.log('⚠️  Could not find login form, skipping Facebook login');
        return false;
      }
      
      await page.type('input[name="email"]', fbEmail, { delay: 50 }); // Faster typing
      
      // Enter password
      await page.type('input[name="pass"]', fbPassword, { delay: 50 }); // Faster typing
      
      // Click login button (use domcontentloaded instead of networkidle2)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.click('button[name="login"]')
      ]);
      
      await new Promise(r => setTimeout(r, 2000)); // Keep this for login verification
      
      // Check if login successful
      const loginSuccess = await page.evaluate(() => {
        return !document.querySelector('input[name="email"]');
      });
      
      if (!loginSuccess) {
        throw new Error('Facebook login failed');
      }
      
      console.log('✅ Facebook login successful');
      
      // Save cookies
      const cookies = await page.cookies();
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('💾 Facebook cookies saved');
      
      return true;
      
    } catch (error) {
      console.error('❌ Facebook login error:', error.message);
      return false;
    }
  }

  /**
   * Download avatar using popup window approach
   * Opens Facebook URL in popup, extracts image, downloads it
   */
  async downloadAvatarInTab(page, facebookUrl, outputFolder, fileName) {
    try {
      // Navigate to Facebook URL (faster with domcontentloaded)
      await page.goto(facebookUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500)); // Reduced from 2000ms
      
      // Find and extract image URL
      const imageUrl = await page.evaluate(() => {
        const selectors = [
          'img[data-visualcompletion="media-vc-image"]',
          'img.x1ey2m1c',
          'img[src*="scontent"]',
          'img[src*="fbcdn"]',
          'div[role="img"] img',
          'img.spotlight'
        ];
        
        for (const selector of selectors) {
          const img = document.querySelector(selector);
          if (img && img.src && img.src.includes('scontent')) {
            return img.src;
          }
        }
        
        const allImages = Array.from(document.querySelectorAll('img'));
        const largeImage = allImages.find(img => 
          img.naturalWidth > 200 && 
          img.src && 
          (img.src.includes('scontent') || img.src.includes('fbcdn'))
        );
        
        return largeImage?.src || null;
      });
      
      if (!imageUrl) {
        throw new Error('Could not find image URL');
      }
      
      // Download image
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      
      let ext = '.jpg';
      const urlPath = imageUrl.split('?')[0];
      const urlExt = path.extname(urlPath);
      if (urlExt && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(urlExt.toLowerCase())) {
        ext = urlExt;
      }
      
      const imageName = `${fileName}${ext}`;
      const filePath = path.join(outputFolder, imageName);
      
      const response = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.facebook.com/',
        },
        timeout: 30000,
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      return {
        success: true,
        imageName,
        path: filePath
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download multiple avatars in parallel using 10 tabs
   */
  async downloadMultipleAvatars(accounts, outputFolder) {
    const PARALLEL_TABS = 10;
    let browser = null;
    
    try {
      console.log(`\n�� Starting parallel avatar download (${PARALLEL_TABS} tabs)...`);
      console.log(`📊 Total accounts: ${accounts.length}\n`);
      
      browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1400,1200',
          '--disable-web-security'
        ]
      });

      // Create a login page and login once for the browser session
      const loginPage = await browser.newPage();
      await loginPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const loginSuccess = await this.loginToFacebook(loginPage);
      if (!loginSuccess) {
        console.log('⚠️  Proceeding without Facebook login (may fail on private photos)');
      }
      
      await loginPage.close();

      const results = [];
      
      // Process accounts in batches
      for (let i = 0; i < accounts.length; i += PARALLEL_TABS) {
        const batch = accounts.slice(i, Math.min(i + PARALLEL_TABS, accounts.length));
        const batchNum = Math.floor(i / PARALLEL_TABS) + 1;
        const totalBatches = Math.ceil(accounts.length / PARALLEL_TABS);
        
        console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${batch.length} accounts)...`);
        
        // Open tabs and load cookies
        const tabs = await Promise.all(
          batch.map(async () => {
            const tab = await browser.newPage();
            
            // Load cookies to each tab
            if (fs.existsSync(this.cookiesPath)) {
              const cookiesString = fs.readFileSync(this.cookiesPath, 'utf8');
              const cookies = JSON.parse(cookiesString);
              await tab.setCookie(...cookies);
            }
            
            return tab;
          })
        );
        
        // Set user agent for all tabs
        await Promise.all(
          tabs.map(tab => tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'))
        );
        
        // Download in parallel
        const batchResults = await Promise.all(
          batch.map(async (account, index) => {
            const tab = tabs[index];
            const fileName = `avatar_${account.email.split('@')[0]}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            console.log(`   [${i + index + 1}/${accounts.length}] Downloading: ${account.email}`);
            
            const downloadResult = await this.downloadAvatarInTab(
              tab,
              account.avatar_url,
              outputFolder,
              fileName
            );
            
            if (downloadResult.success) {
              console.log(`   ✅ [${i + index + 1}] ${account.email} → ${downloadResult.imageName}`);
            } else {
              console.error(`   ❌ [${i + index + 1}] ${account.email}: ${downloadResult.error}`);
            }
            
            return {
              email: account.email,
              id: account.id,
              ...downloadResult
            };
          })
        );
        
        // Close tabs
        await Promise.all(tabs.map(tab => tab.close()));
        
        results.push(...batchResults);
        
        // Wait before next batch
        if (i + PARALLEL_TABS < accounts.length) {
          console.log('\n⏳ Waiting 2s before next batch...');
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      await browser.close();
      
      const successCount = results.filter(r => r.success).length;
      console.log(`\n✅ Download complete: ${successCount}/${accounts.length} successful\n`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error in downloadMultipleAvatars:', error.message);
      if (browser) {
        await browser.close().catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Legacy single download method
   */
  async downloadAvatar(facebookUrl, outputFolder, fileName) {
    let browser = null;
    
    try {
      console.log(`\n📥 Downloading avatar from Facebook: ${facebookUrl}`);
      
      browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1200']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Login to Facebook first
      const loginSuccess = await this.loginToFacebook(page);
      if (!loginSuccess) {
        console.log('⚠️  Proceeding without Facebook login (may fail on private photos)');
      }
      
      const result = await this.downloadAvatarInTab(page, facebookUrl, outputFolder, fileName);
      
      await browser.close();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      console.log(`✅ Downloaded to: ${result.path}`);
      return result.path;
      
    } catch (error) {
      console.error('❌ Error downloading avatar:', error.message);
      if (browser) {
        await browser.close().catch(() => {});
      }
      throw error;
    }
  }
}

module.exports = new FacebDownloaderService();
