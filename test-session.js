/**
 * Example: Test Session Management
 * 
 * Demonstrates how to:
 * 1. Login once and save session
 * 2. Reuse session without re-login
 * 3. Manage profiles
 */

require('dotenv').config();
const youtubeLoginService = require('./src/services/youtube.login.service');
const browserService = require('./src/services/browser.service');
const sessionService = require('./src/services/session.service');

async function testSessionManagement() {
  const testEmail = '3plavmr4g@aaiil.vip'; // Change this
  const testPassword = '431t30xj'; // Change this

  console.log('\n🧪 Testing Session Management\n');

  try {
    // Step 1: Check if profile exists
    console.log('Step 1: Checking profile...');
    if (sessionService.hasProfile(testEmail)) {
      console.log(`✅ Profile exists for ${testEmail}`);
      const size = sessionService.getProfileSize(testEmail);
      console.log(`📊 Profile size: ${size} MB`);
    } else {
      console.log(`❌ No profile found for ${testEmail}`);
    }

    // Step 2: Login (will create profile if not exists)
    console.log('\nStep 2: Logging in...');
    const loginResult = await youtubeLoginService.login(testEmail, testPassword, {
      useProfile: true,
      keepBrowserOpen: false,
      headless: false
    });
    console.log('Login result:', loginResult);

    // Wait a bit
    await new Promise(r => setTimeout(r, 3000));

    // Step 3: Test reusing session (no password needed)
    console.log('\nStep 3: Testing session reuse...');
    console.log('Opening browser with saved session (no re-login)...');
    
    const browser = await browserService.launchBrowser(false, 3, testEmail);
    const page = await browserService.createPage(browser);
    
    // Navigate to YouTube Studio
    console.log('Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if logged in
    const isLoggedIn = await page.evaluate(() => {
      const avatar = document.querySelector('img[alt*="profile"], button#avatar-btn');
      return !!avatar;
    });
    
    if (isLoggedIn) {
      console.log('✅ Successfully logged in using saved session!');
    } else {
      console.log('❌ Not logged in - session might be expired');
    }
    
    await browser.close();

    // Step 4: Show profile info
    console.log('\nStep 4: Profile information:');
    const profiles = sessionService.listProfiles();
    console.log(`Total profiles: ${profiles.length}`);
    profiles.forEach(profile => {
      const size = sessionService.getProfileSize(profile.replace(/_/g, '@'));
      console.log(`  - ${profile}: ${size} MB`);
    });

    console.log('\n✅ Session management test completed!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  testSessionManagement()
    .then(() => {
      console.log('Test finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testSessionManagement;
