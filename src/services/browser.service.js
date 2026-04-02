const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const sessionService = require('./session.service');

puppeteer.use(StealthPlugin());

class BrowserService {
  constructor() {
    // Track active browsers: Map<email, { browser, pages: Page[] }>
    this.activeBrowsers = new Map();
  }

  /**
   * Get active browser for email (if exists)
   */
  getActiveBrowser(email) {
    return this.activeBrowsers.get(email);
  }

  /**
   * Check if browser is still open and valid
   */
  async isBrowserActive(email) {
    const browserInfo = this.activeBrowsers.get(email);
    if (!browserInfo) return false;

    try {
      // Check if browser process is still running
      const pages = await browserInfo.browser.pages();
      return pages.length > 0;
    } catch (error) {
      // Browser crashed or closed
      this.activeBrowsers.delete(email);
      return false;
    }
  }

  /**
   * Launch browser with optional profile for email
   * OR reuse existing browser and ALWAYS use first tab (to avoid Google detection)
   * @param {boolean|null} headless - Headless mode
   * @param {string|null} email - Email to load profile for (null = no profile)
   * @param {number} retries - Number of retry attempts
   * @param {boolean} reuseIfOpen - If true, reuse existing browser (use first tab instead of new browser)
   * @returns {Promise<{browser: Browser, page: Page, isNewBrowser: boolean}>}
   */
  async launchBrowser(headless = null, email = null, retries = 3, reuseIfOpen = true) {
    // Check if browser already open for this email and should reuse
    if (reuseIfOpen && email) {
      const isActive = await this.isBrowserActive(email);
      if (isActive) {
        console.log(`🔄 Browser already open for [${email}], reusing first tab...`);
        const browserInfo = this.activeBrowsers.get(email);
        const page = await this.createPage(browserInfo.browser);
        browserInfo.pages.push(page);
        
        // ALWAYS use the first tab to avoid Google detection issues
        // New tabs created by browser.newPage() don't inherit all anti-detection measures
        const pages = await browserInfo.browser.pages();
        
        if (pages.length === 0) {
          console.log('⚠️ No pages found, creating first page...');
          const page = await this.createPage(browserInfo.browser);
          browserInfo.pages = [page];
          return {
            browser: browserInfo.browser,
            page: page,
            isNewBrowser: false
          };
        }
        
        // Use the FIRST tab (index 0) - this is the most important tab
        const firstTab = pages[0];
        console.log(`✅ Reusing FIRST tab (${pages.length} tabs total)`);
        
        // Close extra tabs to keep things clean (optional, but recommended)
        if (pages.length > 1) {
          console.log(`🧹 Closing ${pages.length - 1} extra tabs...`);
          for (let i = 1; i < pages.length; i++) {
            try {
              await pages[i].close();
            } catch (err) {
              // Ignore if tab already closed
            }
          }
        }
        
        return {
          browser: browserInfo.browser,
          page: firstTab,
          isNewBrowser: false
        };
      }
    }
    // Use env variable if not explicitly set
    const isHeadless = headless !== null
      ? headless
      : process.env.HEADLESS === 'true';

    const profileInfo = email ? ` with profile [${email}]` : '';
    console.log(`🌐 Launching Chrome browser ${isHeadless ? '(headless)' : '(visible)'}${profileInfo}...`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const fs = require('fs');
        const path = require('path');

        // Allow overriding paths via env for flexibility
        let chromeExecutable = process.env.CHROME_EXECUTABLE || null;
        let defaultUserDataDir = process.env.CHROME_USER_DATA_DIR || null;

        const platform = process.platform; // 'darwin', 'win32', 'linux'

        if (!chromeExecutable) {
          if (platform === 'darwin') {
            chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          } else if (platform === 'win32') {
            const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
            const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
            const candidates = [
              path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
              path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
            ];
            const found = candidates.find(p => fs.existsSync(p));
            chromeExecutable = found || candidates[0];
          } else {
            // linux default
            chromeExecutable = '/usr/bin/google-chrome';
          }
        }

        if (!defaultUserDataDir) {
          if (platform === 'darwin') {
            defaultUserDataDir = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Google', 'Chrome');
          } else if (platform === 'win32') {
            const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
            defaultUserDataDir = path.join(localAppData, 'Google', 'Chrome', 'User Data');
          } else {
            defaultUserDataDir = path.join(process.env.HOME || '', '.config', 'google-chrome');
          }
        }

        // Expand $HOME and ~ in defaultUserDataDir if present
        try {
          const os = require('os');
          const home = process.env.HOME || os.homedir();
          if (typeof defaultUserDataDir === 'string') {
            defaultUserDataDir = defaultUserDataDir.replace('$HOME', home).replace(/^~(?=$|\/|\\)/, home);
          }
        } catch (err) {
          // ignore
        }

        // Optionally use a temporary profile (avoid conflicts with system Chrome)
        // Set CHROME_USE_TEMP_PROFILE=true in .env to enable
        let useTempProfile = process.env.CHROME_USE_TEMP_PROFILE === 'true';
        let tempProfilePath = null;
        if (useTempProfile) {
          const os = require('os');
          tempProfilePath = path.join(os.tmpdir(), `puppeteer-temp-profile-${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
          try {
            fs.mkdirSync(tempProfilePath, { recursive: true });
            console.log('⚠️ Using temporary Chrome profile at', tempProfilePath);
          } catch (e) {
            console.warn('⚠️ Could not create temp profile dir, falling back to default user data dir');
            tempProfilePath = null;
            useTempProfile = false;
          }
        }

        // If a real persisted profile exists for this email, prefer it over a temp profile
        if (email) {
          try {
            if (sessionService.hasProfile(email)) {
              if (useTempProfile) console.log('ℹ️ Real profile found for', email, '- overriding CHROME_USE_TEMP_PROFILE and using persisted profile');
              useTempProfile = false;
            }
          } catch (e) {
            // ignore
          }
        }

        // Build args dynamically so we can avoid adding sandbox/unupported flags on macOS system Chrome
        const baseArgs = [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--window-size=1200,900',
          '--disable-features=TranslateUI',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-infobars',
          // ===== CRITICAL: Remove automation flags =====
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-features=ChromeWhatsNewUI',
          // Language
          '--lang=en-US,en',
          // User agent hints
          `--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
        ];

        // By default, avoid adding sandbox-disabling flags when launching the real Google Chrome on macOS
        // Those flags are unsupported on macOS and produce the warning: "You are using an unsupported command-line flag..."
        // Keep flags when running in containers/CI where sandboxing causes issues by setting env: KEEP_SANDBOX_FLAGS=true
        const isSystemChromeOnMac = process.platform === 'darwin' && chromeExecutable.includes('Google Chrome.app');
        if (!isSystemChromeOnMac || process.env.KEEP_SANDBOX_FLAGS === 'true') {
          // Only prepend sandbox-specific flags when not using system Chrome on macOS or when explicitly requested
          baseArgs.unshift('--no-sandbox', '--disable-setuid-sandbox');
        }

        const launchOptions = {
          headless: isHeadless,
          executablePath: chromeExecutable,
          userDataDir: defaultUserDataDir,
          args: baseArgs,
          ignoreDefaultArgs: [
            '--enable-automation'
          ],
          ignoreHTTPSErrors: true,
          defaultViewport: null, // Use actual viewport instead of fixed size
          timeout: 60000
        };

        // Decide which userDataDir to use
        let userDataDirToUse = defaultUserDataDir;
        if (useTempProfile && tempProfilePath) {
          userDataDirToUse = tempProfilePath;
        }

        if (email) {
          // Prefer an explicit persistent profile directory under browser-profiles for this email
          const profilePath = sessionService.getProfilePath(email);
          try {
            if (profilePath && require('fs').existsSync(profilePath)) {
              userDataDirToUse = profilePath;
              useTempProfile = false; // persist, do not use temp
              console.log(`📂 Using persistent profile for [${email}]: ${profilePath} (overriding temp profile if set)`);
            } else if (profilePath) {
              // Profile path was returned but doesn't exist yet - attempt to create it so profile becomes persistent
              try {
                require('fs').mkdirSync(profilePath, { recursive: true });
                userDataDirToUse = profilePath;
                useTempProfile = false;
                console.log(`📂 Created and using profile directory for [${email}]: ${profilePath}`);
              } catch (mkdirErr) {
                console.warn(`⚠️ Could not create persistent profile dir ${profilePath}:`, mkdirErr.message);
                // Fall back to temp profile if available
                if (useTempProfile && tempProfilePath) {
                  userDataDirToUse = tempProfilePath;
                  console.log(`⚠️ Falling back to temporary profile for [${email}]: ${tempProfilePath}`);
                }
              }
            } else if (useTempProfile && tempProfilePath) {
              // No profilePath configured, and env requests temp profile
              userDataDirToUse = tempProfilePath;
              console.log(`⚠️ Using temporary profile for [${email}] to avoid SingletonLock conflicts`);
            }
          } catch (e) {
            // If anything unexpected happens, fall back sensibly
            console.warn('⚠️ Profile selection error:', e.message);
            if (useTempProfile && tempProfilePath) userDataDirToUse = tempProfilePath;
          }
        } else {
          // Not launching with an email/profile; honor temp profile setting if requested
          if (useTempProfile && tempProfilePath) {
            userDataDirToUse = tempProfilePath;
          }
        }

        launchOptions.userDataDir = userDataDirToUse;
        // Preserve for cleanup handling later
        launchOptions._tempProfilePath = tempProfilePath;

        const browser = await puppeteer.launch(launchOptions);
        
        // Get existing pages (usually 1 blank tab is created automatically)
        const pages = await browser.pages();
        let page;
        
        if (pages.length > 0) {
          // Use the first existing tab (most reliable for anti-detection)
          page = pages[0];
          console.log(`✅ Using existing first tab`);
          
          // Apply anti-detection measures to existing tab
          // await this.applyAntiDetection(page);

          // Auto-save cookies when navigating to important Google/YouTube pages (throttled)
          try {
            if (!this._lastSavedCookies) this._lastSavedCookies = new Map();
            page.on('framenavigated', async (frame) => {
              try {
                const url = frame.url();
                if (!url) return;
                const keyHosts = ['studio.youtube.com', 'myaccount.google.com', 'accounts.google.com', 'youtube.com'];
                const matched = keyHosts.some(h => url.includes(h));
                if (!matched) return;
                
                const last = this._lastSavedCookies.get(email) || 0;
                const now = Date.now();
                // Throttle saves to once every 10 seconds per profile
                if (now - last < 10000) return;
                this._lastSavedCookies.set(email, now);
                
                // Attempt to save cookies for this profile
                if (browser && typeof browser.saveProfileCookies === 'function') {
                  try {
                    const saved = await browser.saveProfileCookies(email);
                    if (saved) console.log(`💾 Auto-saved cookies for ${email} after navigation to ${url}`);
                  } catch (e) {
                    console.warn('⚠️ Auto-save cookies failed:', e.message);
                  }
                }
              } catch (e) {
                // ignore
              }
            });
          } catch (e) {
            // ignore
          }

         }

        // Track browser and page
        if (email) {
          this.activeBrowsers.set(email, {
            browser: browser,
            pages: [page]
          });

          // Attempt to load saved cookies for this profile, if any
          try {
            const savedCookies = sessionService.loadCookies(email);
            if (savedCookies && Array.isArray(savedCookies) && savedCookies.length > 0) {
              console.log(`🔁 Loading saved cookies for ${email} (${savedCookies.length} cookies)`);
              try {
                // Best-effort: navigate to cookie domain before setting cookies
                try {
                  const firstCookie = savedCookies.find(c => c.domain || c.url);
                  if (firstCookie) {
                    const domain = firstCookie.domain ? (firstCookie.domain.startsWith('.') ? firstCookie.domain.slice(1) : firstCookie.domain) : null;
                    const url = firstCookie.url || (domain ? `https://${domain}/` : null);
                    if (url) {
                      try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
                      } catch (navErr) {
                        // ignore navigation errors
                      }
                    }
                  }
                } catch (e) {
                  // ignore
                }

                // Set cookies on the page
                await page.setCookie(...savedCookies);
                console.log('✅ Cookies set on page');
              } catch (setErr) {
                console.warn('⚠️ Failed to set cookies on page:', setErr.message);
              }
            }
          } catch (err) {
            // ignore
          }

          // Clean up when browser closes
          browser.on('disconnected', () => {
            console.log(`🔴 Browser closed for [${email}]`);
            this.activeBrowsers.delete(email);
            // Cleanup temp profile if created
            try {
              const tmpPath = launchOptions._tempProfilePath;
              if (tmpPath) {
                const rimraf = require('fs');
                console.log('🧹 Removing temp profile:', tmpPath);
                try { rimraf.rmSync(tmpPath, { recursive: true, force: true }); } catch (e) { /* ignore */ }
              }
            } catch (e) {
              /* ignore */
            }
          });
         }

        console.log(`✅ Browser launched successfully`);

        // After launch, provide a helper to save cookies after successful login
        const self = this;
        browser.saveProfileCookies = async function(emailToSave) {
          try {
            if (!emailToSave) return false;
            const pages = await browser.pages();
            if (!pages || pages.length === 0) return false;
            const targetPage = pages[0];
            const cookies = await targetPage.cookies();
            sessionService.saveCookies(emailToSave, cookies);
            return true;
          } catch (err) {
            console.error('❌ Failed to save profile cookies:', err.message);
            return false;
          }
        };

        return {
          browser: browser,
          page: page,
          isNewBrowser: true
        };
      } catch (error) {
        console.error(`❌ Browser launch attempt ${attempt}/${retries} failed: ${error.message}`);
        if (attempt < retries) {
          console.log(`   Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Apply anti-detection measures to a page
   * This is extracted from createPage to be reusable for existing pages
   */
  async applyAntiDetection(page) {
    // Set realistic user agent (latest Chrome on macOS)
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set viewport to match common screen resolutions
    await page.setViewport({
      width: 1200,
      height: 900,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    });

    // Set extra HTTP headers to look more human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    // Advanced anti-detection - MUST run before page navigation
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
      
      // Mock plugins to look like a real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin},
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: {type: "application/pdf", suffixes: "pdf", description: "", enabledPlugin: Plugin},
            description: "",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          },
          {
            0: {type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: Plugin},
            1: {type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: Plugin},
            description: "",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client"
          }
        ]
      });
      
      // Set languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Override chrome property
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Add missing properties to make it look more real
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0
      });

      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });

      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.'
      });

      // Override getUserMedia to prevent detection
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return getUserMedia(constraints);
        };
      }

      // Mock battery API
      if (!navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
          addEventListener: () => {},
          removeEventListener: () => {}
        });
      }

      // Override permissions
      const originalPermissions = navigator.permissions;
      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: (parameters) => {
            if (parameters.name === 'notifications') {
              return Promise.resolve({ state: 'default' });
            }
            return originalPermissions.query(parameters);
          }
        })
      });

      // Remove automation-related properties
      delete navigator.__proto__.webdriver;
      
      // Mock connection API
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false
        })
      });

      // Mock deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });

      // Mock hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8
      });
    });

    // Add random mouse movements to mimic human behavior
    page.on('load', async () => {
      try {
        await page.evaluate(() => {
          // Add random delays to make actions look more human
          const addRandomDelay = () => Math.floor(Math.random() * 100) + 50;
          
          // Simulate mouse movements occasionally
          let moveCount = 0;
          const maxMoves = Math.floor(Math.random() * 5) + 3;
          
          const moveMouseRandomly = () => {
            if (moveCount < maxMoves) {
              const x = Math.floor(Math.random() * window.innerWidth);
              const y = Math.floor(Math.random() * window.innerHeight);
              
              const event = new MouseEvent('mousemove', {
                clientX: x,
                clientY: y,
                bubbles: true
              });
              
              document.dispatchEvent(event);
              moveCount++;
              
              setTimeout(moveMouseRandomly, addRandomDelay() * 10);
            }
          };
          
          // Start random mouse movements after a delay
          setTimeout(moveMouseRandomly, addRandomDelay());
        });
      } catch (err) {
        // Ignore errors in random mouse movements
      }
    });
  }

  async createPage(browser) {
    const page = await browser.newPage();
    // await this.applyAntiDetection(page);
    return page;
  }

  async clearSession(page) {
    try {
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Close specific page/tab
   */
  async closePage(email, page) {
    const browserInfo = this.activeBrowsers.get(email);
    if (!browserInfo) return;

    try {
      await page.close();
      
      // Remove from tracked pages
      browserInfo.pages = browserInfo.pages.filter(p => p !== page);
      
      console.log(`🗑️  Closed tab for [${email}]. Remaining tabs: ${browserInfo.pages.length}`);
      
      // If no pages left, close browser
      if (browserInfo.pages.length === 0) {
        await browserInfo.browser.close();
        this.activeBrowsers.delete(email);
        console.log(`🔴 Browser closed for [${email}] (no tabs remaining)`);
      }
    } catch (error) {
      console.error('Error closing page:', error);
    }
  }

  /**
   * Close browser for email
   */
  async closeBrowser(email) {
    const browserInfo = this.activeBrowsers.get(email);
    if (!browserInfo) {
      console.log(`⚠️  No active browser found for [${email}]`);
      return false;
    }

    try {
      await browserInfo.browser.close();
      this.activeBrowsers.delete(email);
      console.log(`✅ Browser closed for [${email}]`);
      return true;
    } catch (error) {
      console.error(`❌ Error closing browser for [${email}]:`, error);
      this.activeBrowsers.delete(email); // Clean up anyway
      return false;
    }
  }

  /**
   * Get all active browsers
   */
  getActiveBrowsers() {
    const result = [];
    for (const [email, info] of this.activeBrowsers.entries()) {
      result.push({
        email: email,
        tabCount: info.pages.length
      });
    }
    return result;
  }
}

module.exports = new BrowserService();
