/**
 * Check if user is logged in on YouTube
 * More reliable than checking Google accounts page
 */
async function isLoggedInOnYouTube(page) {
  try {
    const currentUrl = page.url();
    
    // Make sure we're on YouTube
    if (!currentUrl.includes('youtube.com')) {
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Wait for page to load
    await page.waitForSelector('ytd-app', { timeout: 10000 }).catch(() => {});
    
    // Check multiple indicators
    const loginStatus = await page.evaluate(() => {
      const indicators = {
        hasSignInButton: false,
        hasAvatar: false,
        hasAccountMenu: false,
        debugInfo: {}
      };
      
      // 1. Check for "Sign in" button (means NOT logged in)
      const signInSelectors = [
        'a[aria-label*="Sign in"]',
        'a[href*="accounts.google.com/ServiceLogin"]',
        'ytd-button-renderer a[href*="ServiceLogin"]',
        'paper-button[aria-label*="Sign in"]'
      ];
      
      for (const selector of signInSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.toLowerCase().includes('sign in')) {
          indicators.hasSignInButton = true;
          indicators.debugInfo.signInButton = selector;
          break;
        }
      }
      
      // 2. Check for user avatar (means logged in)
      const avatarSelectors = [
        '#avatar-btn',
        'button[aria-label*="Google Account"]',
        'ytd-topbar-menu-button-renderer#avatar-btn',
        'button#avatar-btn img',
        'yt-img-shadow#avatar img'
      ];
      
      for (const selector of avatarSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          indicators.hasAvatar = true;
          indicators.debugInfo.avatar = selector;
          break;
        }
      }
      
      // 3. Check for account menu button
      const menuButton = document.querySelector('ytd-topbar-menu-button-renderer#avatar-btn button');
      if (menuButton) {
        indicators.hasAccountMenu = true;
      }
      
      // 4. Check for channel switcher (only visible when logged in)
      const channelSwitcher = document.querySelector('ytd-active-account-header-renderer');
      if (channelSwitcher) {
        indicators.debugInfo.hasChannelSwitcher = true;
      }
      
      return indicators;
    });
    
    console.log('🔍 YouTube Login Check:', JSON.stringify(loginStatus, null, 2));
    
    // If "Sign in" button exists, definitely NOT logged in
    if (loginStatus.hasSignInButton) {
      console.log('❌ NOT logged in (Sign in button found)');
      return false;
    }
    
    // If avatar exists, definitely logged in
    if (loginStatus.hasAvatar || loginStatus.hasAccountMenu) {
      console.log('✅ Logged in (User avatar/menu found)');
      return true;
    }
    
    // Fallback: no clear indicator, assume not logged in to be safe
    console.log('⚠️  Unclear login status, assuming NOT logged in');
    return false;
    
  } catch (error) {
    console.error('❌ Error checking YouTube login status:', error.message);
    // On error, return false to trigger login attempt
    return false;
  }
}

module.exports = {
  isLoggedInOnYouTube
};
