const googleAuthService = require('../services/google.auth.service');

/**
 * Check if logged in, and auto re-login if session expired
 * @param {Page} page - Puppeteer page
 * @param {string} email - Account email
 * @param {string} password - Account password
 * @returns {Promise<boolean>} - true if logged in successfully
 */
async function ensureLoggedIn(page, email, password) {
  try {
    console.log(`🔍 [${email}] Checking session status...`);
    
    // Check if already logged in
    const isLoggedIn = await googleAuthService.isLoggedIn(page);
    
    if (isLoggedIn) {
      console.log(`✅ [${email}] Session valid - already logged in`);
      return true;
    }
    
    // Session expired or not found
    console.log(`⚠️  [${email}] Session expired or not found`);
    
    if (!password) {
      console.log(`❌ [${email}] No password available for auto re-login`);
      throw new Error('Session expired and no password available for re-login');
    }
    
    // Attempt to re-login
    console.log(`🔐 [${email}] Attempting auto re-login...`);
    await googleAuthService.login(page, email, password);
    
    // Verify login success
    const isLoggedInAfter = await googleAuthService.isLoggedIn(page);
    
    if (isLoggedInAfter) {
      console.log(`✅ [${email}] Auto re-login successful`);
      return true;
    } else {
      console.log(`❌ [${email}] Auto re-login failed - session check failed`);
      throw new Error('Auto re-login failed');
    }
    
  } catch (error) {
    console.error(`❌ [${email}] ensureLoggedIn error:`, error.message);
    throw error;
  }
}

/**
 * Check session and auto re-login if needed (without throwing error)
 * @param {Page} page - Puppeteer page
 * @param {string} email - Account email
 * @param {string} password - Account password (optional)
 * @returns {Promise<{loggedIn: boolean, reloginAttempted: boolean, reloginSuccess: boolean}>}
 */
async function checkAndRelogin(page, email, password) {
  const result = {
    loggedIn: false,
    reloginAttempted: false,
    reloginSuccess: false
  };
  
  try {
    console.log(`🔍 [${email}] Checking session status...`);
    
    // Check if already logged in
    const isLoggedIn = await googleAuthService.isLoggedIn(page);
    
    if (isLoggedIn) {
      console.log(`✅ [${email}] Session valid`);
      result.loggedIn = true;
      return result;
    }
    
    // Session expired
    console.log(`⚠️  [${email}] Session expired`);
    
    if (!password) {
      console.log(`⚠️  [${email}] No password for auto re-login`);
      return result;
    }
    
    // Attempt re-login
    result.reloginAttempted = true;
    console.log(`🔐 [${email}] Attempting auto re-login...`);
    
    try {
      await googleAuthService.login(page, email, password);
      
      // Verify
      const isLoggedInAfter = await googleAuthService.isLoggedIn(page);
      
      if (isLoggedInAfter) {
        console.log(`✅ [${email}] Auto re-login successful`);
        result.loggedIn = true;
        result.reloginSuccess = true;
      } else {
        console.log(`❌ [${email}] Re-login verification failed`);
      }
    } catch (loginError) {
      console.error(`❌ [${email}] Re-login error:`, loginError.message);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ [${email}] checkAndRelogin error:`, error.message);
    return result;
  }
}

module.exports = {
  ensureLoggedIn,
  checkAndRelogin
};
