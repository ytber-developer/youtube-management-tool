const { AccountYoutube } = require('../models');
const browserService = require('../services/browser.service');
const googleAuthService = require('../services/google.auth.service');
const authenticatorService = require('../services/authenticator.service');
const youtubeService = require('../services/youtube.service');
const csvService = require('../services/csv.service');
const facebDownloader = require('../services/faceb.downloader.service');
const fs = require('fs');
const path = require('path');
const sessionService = require('../services/session.service');

class VerifyAuthenticatorController {
  
  async autoSetup2FA(req, res) {
    let browser = null;
    let csvPath = null;
    let accounts = [];
    
    try {
      // Check if CSV file is provided
      if (req.files && req.files.file) {
        // MODE 1: Upload CSV file - Import new accounts
        console.log('📁 Mode: Import from CSV file\n');

        csvPath = req.files.file[0].path;
        console.log('📁 CSV Path:', csvPath);
        
        accounts = csvService.loadAccountsFromCSV(csvPath);
        
        if (accounts.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No accounts found in CSV'
          });
        }

        console.log('💾 Đang lưu accounts vào database...\n');
        
        for (let i = 0; i < accounts.length; i++) {
          const account = accounts[i];
          
          try {
            // Normalize boolean flags from CSV (accept '1','true','yes', boolean)
            const normalizeBool = (value) => {
              if (!value) return false;
              if (typeof value === 'string') {
                const s = value.trim().toLowerCase();
                return s === '1' || s === 'true' || s === 'yes';
              }
              return !!value;
            };

            const isCreateChannelFlag = normalizeBool(account.is_create_channel);
            const isAuthenticatorFlag = normalizeBool(account.is_authenticator);
            const isUploadAvatarFlag = normalizeBool(account.is_upload_avatar);
            
            // Extract code_authenticators if provided
            const codeAuthenticators = account.code_authenticators && account.code_authenticators.trim() 
              ? account.code_authenticators.trim() 
              : null;
            
            // Extract channel_link if provided
            const channelLink = account.channel_link && account.channel_link.trim()
              ? account.channel_link.trim()
              : null;

            const [accountRecord, created] = await AccountYoutube.findOrCreate({
              where: { email: account.email },
              defaults: {
                email: account.email,
                password: account.password,
                channel_name: account.channel_name,
                channel_link: channelLink,
                avatar_url: account.avatar_url || null,
                recovery_email: account.recovery_email || null,
                code_authenticators: codeAuthenticators,
                is_authenticator: isAuthenticatorFlag,
                is_create_channel: isCreateChannelFlag,
                is_upload_avatar: isUploadAvatarFlag
              }
            });
            
            if (created) {
              console.log(`  ✅ ${account.email} - NEW`);
              if (channelLink) {
                console.log(`     🔗 channel_link: ${channelLink}`);
              }
              if (codeAuthenticators) {
                console.log(`     🔐 code_authenticators: ${codeAuthenticators.substring(0, 10)}...`);
              }
              if (isAuthenticatorFlag) {
                console.log(`     ✅ is_authenticator: true`);
              }
              if (isCreateChannelFlag) {
                console.log(`     ✅ is_create_channel: true`);
              }
              if (isUploadAvatarFlag) {
                console.log(`     ✅ is_upload_avatar: true`);
              }
            } else {
              console.log(`  ℹ️  ${account.email} - EXISTS`);
              
              // Prepare update fields
              const updateFields = {};
              
              // Update channel_link if provided in CSV and not already set
              if (channelLink && !accountRecord.channel_link) {
                updateFields.channel_link = channelLink;
                console.log(`     🔗 Will update channel_link: ${channelLink}`);
              }
              
              // Update avatar_url if provided in CSV and not already set
              if (account.avatar_url && !accountRecord.avatar_url) {
                updateFields.avatar_url = account.avatar_url;
                console.log(`     📥 Will update avatar_url`);
              }
              
              // Update code_authenticators if provided in CSV and not already set
              if (codeAuthenticators && !accountRecord.code_authenticators) {
                updateFields.code_authenticators = codeAuthenticators;
                console.log(`     � Will update code_authenticators: ${codeAuthenticators.substring(0, 10)}...`);
              }
              
              // Update status flags if CSV marks them as true and DB doesn't have them yet
              if (isAuthenticatorFlag && !accountRecord.is_authenticator) {
                updateFields.is_authenticator = true;
                console.log(`     ✅ Will mark is_authenticator=true`);
              }
              
              if (isCreateChannelFlag && !accountRecord.is_create_channel) {
                updateFields.is_create_channel = true;
                console.log(`     ✅ Will mark is_create_channel=true`);
              }
              
              if (isUploadAvatarFlag && !accountRecord.is_upload_avatar) {
                updateFields.is_upload_avatar = true;
                console.log(`     ✅ Will mark is_upload_avatar=true`);
              }
              
              // Apply updates if any
              if (Object.keys(updateFields).length > 0) {
                try {
                  await AccountYoutube.update(
                    updateFields,
                    { where: { email: account.email } }
                  );
                  console.log(`     💾 Updated fields from CSV`);
                } catch (err) {
                  console.error(`     ❌ Failed to update ${account.email}:`, err.message);
                }
              }
            }
          } catch (error) {
            console.error(`❌ Lỗi lưu ${account.email}:`, error.message);
          }
        }
        console.log('✅ Đã lưu tất cả accounts vào database\n');
        
        // Download avatars from Facebook if avatar_url exists and image_name is null
        const accountsWithAvatarUrl = accounts.filter(acc => acc.avatar_url);
        if (accountsWithAvatarUrl.length > 0) {
          console.log(`\n📥 Checking avatars to download...\n`);
          
          // Query DB to get full account info with id
          const { Op } = require('sequelize');
          const dbAccounts = await AccountYoutube.findAll({
            where: {
              email: { [Op.in]: accountsWithAvatarUrl.map(acc => acc.email) }
            },
            attributes: ['id', 'email', 'avatar_url', 'image_name']
          });
          
          // Filter accounts that need download (no image_name yet)
          const accountsToDownload = dbAccounts.filter(acc => !acc.image_name);
          const accountsAlreadyDownloaded = dbAccounts.filter(acc => acc.image_name);
          
          if (accountsAlreadyDownloaded.length > 0) {
            console.log(`✅ ${accountsAlreadyDownloaded.length} accounts already have avatars downloaded\n`);
            accountsAlreadyDownloaded.forEach(acc => {
              console.log(`   ✅ ${acc.email}: ${acc.image_name}`);
            });
          }
          
          if (accountsToDownload.length === 0) {
            console.log(`\n✅ All avatars already downloaded, skipping download step\n`);
          } else {
            console.log(`\n📥 Downloading ${accountsToDownload.length} avatars from Facebook using parallel tabs...\n`);
            
            const avatarsDir = path.join(__dirname, '../../avatars');
            const downloadResults = await facebDownloader.downloadMultipleAvatars(
              accountsToDownload, 
              avatarsDir
            );
            
            // Update DB with image_name for successful downloads
            console.log('\n💾 Updating database with downloaded image names...');
            for (const result of downloadResults) {
              if (result.success && result.imageName) {
                try {
                  await AccountYoutube.update(
                    { image_name: result.imageName },
                    { where: { email: result.email } }
                  );
                  console.log(`   ✅ Updated image_name for ${result.email}: ${result.imageName}`);
                } catch (error) {
                  console.error(`   ❌ Failed to update image_name for ${result.email}:`, error.message);
                }
              }
            }
            
            const successCount = downloadResults.filter(r => r.success).length;
            console.log(`\n✅ Downloaded ${successCount}/${accountsToDownload.length} avatars successfully\n`);
          }
        }

      } else {
        // MODE 2: No CSV - Retry failed accounts from database
        console.log('🔄 Mode: Process accounts from database\n');
        
        const { Op } = require('sequelize');
        const dbAccounts = await AccountYoutube.findAll({
          where: {
            [Op.or]: [
              // Accounts without 2FA
              { is_authenticator: false },
              // Accounts with 2FA but no channel
              {
                is_authenticator: true,
                is_create_channel: false
              },
              // Accounts with channel but no avatar
              {
                is_authenticator: true,
                is_create_channel: true,
                is_upload_avatar: false
              }
            ]
          },
          order: [['id', 'ASC']]
        });

        if (dbAccounts.length === 0) {
          return res.json({
            success: true,
            message: 'No accounts need processing',
            data: [],
            summary: {
              total: 0,
              success: 0,
              failed: 0,
              skipped: 0
            }
          });
        }

        console.log(`📊 Found ${dbAccounts.length} accounts in database\n`);
        
        // Remove duplicates by email
        const uniqueAccountsMap = new Map();
        dbAccounts.forEach(acc => {
          if (!uniqueAccountsMap.has(acc.email)) {
            uniqueAccountsMap.set(acc.email, acc);
          }
        });
        
        const uniqueAccounts = Array.from(uniqueAccountsMap.values());
        console.log(`📊 After removing duplicates: ${uniqueAccounts.length} unique accounts\n`);
        
        // Convert DB records to account format
        accounts = uniqueAccounts.map(acc => ({
          email: acc.email,
          password: acc.password,
          channel_name: acc.channel_name,
          avatar_url: acc.avatar_url  // Include avatar_url from DB
        }));
        
        // Debug: Log accounts with their avatar_url status
        console.log(`📋 Accounts from DB:`);
        accounts.forEach((acc, idx) => {
          console.log(`  [${idx + 1}] ${acc.email}`);
          console.log(`      avatar_url: ${acc.avatar_url || 'NULL'}`);
        });
        console.log('');
      }

      // Filter and prepare accounts for processing
      const accountsToProcess = [];
      const processedEmails = new Set(); // Track processed emails to avoid duplicates
      
      for (const account of accounts) {
        // Skip if already added to process list
        if (processedEmails.has(account.email)) {
          console.log(`⏭️  Skip: ${account.email} (duplicate in list)\n`);
          continue;
        }
        
        const existingAccount = await AccountYoutube.findOne({
          where: { email: account.email }
        });
        
        // Skip if account has authenticator, channel AND avatar uploaded
        if (existingAccount && 
            existingAccount.is_authenticator === true && 
            existingAccount.is_create_channel === true &&
            existingAccount.is_upload_avatar === true) {
          console.log(`⏭️  Skip: ${account.email} (đã có Authenticator, Channel và Avatar)\n`);
          continue;
        }
        
        // Use existing avatar_url from DB if available
        if (existingAccount) {
          account.avatar_url = existingAccount.avatar_url;
        }
        
        accountsToProcess.push(account);
        processedEmails.add(account.email); // Mark as processed
      }

      if (accountsToProcess.length === 0) {
        return res.json({
          success: true,
          message: 'All accounts already have authenticator, channel and avatar',
          data: [],
          summary: {
            total: accounts.length,
            success: 0,
            failed: 0,
            skipped: accounts.length
          }
        });
      }

      console.log(`📊 Cần xử lý: ${accountsToProcess.length}/${accounts.length} accounts\n`);

      const results = [];
      const concurrentBrowsers = parseInt(process.env.CONCURRENT_TABS) || 5;
      
      console.log(`🚀 Chạy parallel với ${concurrentBrowsers} browsers cùng lúc\n`);
      console.log(`ℹ️  Import mode: Không dùng profile (fresh browsers)\n`);

      // Process accounts in batches
      for (let i = 0; i < accountsToProcess.length; i += concurrentBrowsers) {
        const batch = accountsToProcess.slice(i, i + concurrentBrowsers);
        console.log(`\n📦 Batch ${Math.floor(i / concurrentBrowsers) + 1}: Processing ${batch.length} accounts...`);
        
        const batchResults = await Promise.all(
          batch.map(account => {
            // Pass useProfile=false for import mode
            return setupSingleAccountWithBrowser(account, { useProfile: false });
          })
        );
        
        results.push(...batchResults);
        
        const batchSuccess = batchResults.filter(r => r.success).length;
        console.log(`✅ Batch completed: ${batchSuccess}/${batch.length} success\n`);
        
        // Delay between batches to avoid rate limiting
        if (i + concurrentBrowsers < accountsToProcess.length) {
          console.log('⏳ Waiting 5s before next batch...\n');
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      if (csvPath && fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      const skippedCount = accounts.length - accountsToProcess.length;

      res.json({
        success: true,
        message: `Completed: ${successCount} success, ${failCount} failed, ${skippedCount} skipped`,
        data: results,
        summary: {
          total: accounts.length,
          success: successCount,
          failed: failCount,
          skipped: skippedCount,
          processed: accountsToProcess.length
        }
      });

    } catch (error) {
      console.error('❌ Controller Error:', error);
      console.error('Stack:', error.stack);
      
      if (csvPath && fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
      
      res.status(500).json({
        success: false,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  }

  // Retry verify authenticator and create channel for specific account by ID
  async retryVerifyById(req, res) {
      try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Account ID is required'
        });
      }

      // Find account in database
      const account = await AccountYoutube.findByPk(id);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          message: `Account with ID ${id} not found`
        });
      }

      console.log(`\n🔄 Retrying verify for account: ${account.email}`);
      console.log(`📋 Account info from DB:`);
      console.log(`   ID: ${account.id}`);
      console.log(`   Email: ${account.email}`);
      console.log(`   Channel Name: "${account.channel_name}"`);
      console.log(`   is_authenticator: ${account.is_authenticator}`);
      console.log(`   is_create_channel: ${account.is_create_channel}`);
      console.log(`   code_authenticators: ${account.code_authenticators ? 'EXISTS' : 'NULL'}`);
      
      // Prepare account object for processing
      const accountData = {
        email: account.email,
        password: account.password,
        recoveryEmail: account.recovery_email,
        channel_name: account.channel_name  // ✅ Use correct field from DB
      };

      console.log(`📤 Account data to process:`);
      console.log(`   channel_name: "${accountData.channel_name}"`);

      // Process with existing function (retry mode uses profile)
      const result = await setupSingleAccountWithBrowser(accountData, { useProfile: true });

      // Refetch account from database to get latest status
      const updatedAccount = await AccountYoutube.findByPk(id);
      
      // Return result with updated status
      if (result.success) {
        console.log(`✅ Successfully verified account: ${account.email}`);
        
        return res.json({
          success: true,
          message: 'Account verified and channel created successfully',
          data: {
            id: updatedAccount.id,
            email: updatedAccount.email,
            channelName: updatedAccount.channel_name,
            channelLink: updatedAccount.channel_link,
            is_authenticator: updatedAccount.is_authenticator,
            is_create_channel: updatedAccount.is_create_channel
          }
        });
      } else {
        console.log(`❌ Failed to verify account: ${account.email}`);
        
        return res.status(400).json({
          success: false,
          message: 'Failed to verify account',
          error: result.error,
          data: {
            id: updatedAccount.id,
            email: updatedAccount.email,
            is_authenticator: updatedAccount.is_authenticator,
            is_create_channel: updatedAccount.is_create_channel
          }
        });
      }

    } catch (error) {
      console.error('Error retrying verify:', error);
      return res.status(500).json({
        success: false,
        message: 'Error retrying verify',
        error: error.message
      });
    }
  }
}

// Setup single account with its own browser instance
async function setupSingleAccountWithBrowser(account, options = {}) {
  let browser = null;
  
  try {
    console.log(`\n🌐 [${account.email}] Launching browser...`);
    
    // Use HEADLESS_AUTHENTICATOR for authenticator setup
    const headless = process.env.HEADLESS_AUTHENTICATOR === 'true';
    
    // Check if should use profile (default: false for import, true for retry)
    const useProfile = options.useProfile === true;
    
    if (useProfile) {
      // ✅ Retry mode: Use profile for session reuse
      const profileEmail = account.email;
      console.log(`📂 Using profile for: ${profileEmail} (retry mode)`);
      
      const launchResult = await browserService.launchBrowser(
        headless, 
        profileEmail,
        3,           // retries
        true         // reuseIfOpen - reuse browser and open new tab if already running
      );
      
      browser = launchResult.browser;
      const page = launchResult.page;
      const isNewBrowser = launchResult.isNewBrowser;
      
      if (isNewBrowser) {
        console.log(`🆕 Launched new browser for [${account.email}]`);
      } else {
        console.log(`♻️  Reusing existing browser, opened new tab for [${account.email}]`);
      }
      
      const result = await setupSingleAccount(browser, account, { 
        profileEmail: profileEmail  // Pass profile email
      });
      
      // Only close browser if it was newly created
      // If reused, just close the page/tab
      if (isNewBrowser) {
        await browser.close();
        console.log(`✅ [${account.email}] Browser closed`);
      } else {
        await page.close();
        console.log(`✅ [${account.email}] Tab closed (browser still running)`);
      }
      
      return result;
      
    } else {
      // ✅ Import mode: Fresh browser without profile
      console.log(`🆕 Fresh browser (no profile) for [${account.email}]`);
      
      const launchResult = await browserService.launchBrowser(
        headless, 
        null,        // No profile
        3,           // retries
        false        // Don't reuse
      );
      
      browser = launchResult.browser;
      const page = launchResult.page;
      
      const result = await setupSingleAccount(browser, account, { 
        profileEmail: null  // No profile
      });
      
      // Always close browser in import mode
      await browser.close();
      console.log(`✅ [${account.email}] Browser closed`);
      
      return result;
    }
    
  } catch (error) {
    console.error(`❌ [${account.email}] Error:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }
    
    return {
      email: account.email,
      password: account.password,
      channel_name: account.channel_name,
      success: false,
      error: error.message
    };
  }
}

async function setupSingleAccount(browser, account, options = {}) {
  const page = await browserService.createPage(browser);
  
  try {
    // Check if using profile (retry mode)
    const usingProfile = options.profileEmail ? true : false;
    
    let isSessionValid = false;
    
    if (usingProfile) {
      console.log(`♻️  Using profile session for ${options.profileEmail}`);
      
      // Check if session is still valid
      console.log('🔍 Checking if session is still valid...');
      isSessionValid = await googleAuthService.isLoggedIn(page);
      
      if (isSessionValid) {
        console.log('✅ Session is valid, will skip login');
      } else {
        console.log('⚠️  Session expired or invalid, will need to login again');
        console.log('🧹 Clearing expired session...');
        await browserService.clearSession(page);
      }
    } else {
      console.log(`🆕 Starting fresh - clearing any existing session`);
      await browserService.clearSession(page);
    }

    // Check if account already has authenticator
    const existingAccount = await AccountYoutube.findOne({
      where: { email: account.email }
    });

    let secretKey = existingAccount?.code_authenticators;
    let totp = null;
    let skipAuth = false;

    // Check if DB already has authenticator code
    const hasAuthenticatorCode = existingAccount && existingAccount.code_authenticators;
    
    // If already has authenticator_code BUT is_authenticator is FALSE
    // => Only try to enable 2FA, don't generate/change code
    if (hasAuthenticatorCode && !existingAccount.is_authenticator) {
      console.log('\n⚠️  Account có authenticator_code nhưng is_authenticator=false');
      console.log('🔄 Sẽ chỉ thử enable 2FA, KHÔNG generate/change code');
      secretKey = existingAccount.code_authenticators;
      console.log(`🔑 Dùng secret key có sẵn: ${secretKey.substring(0, 4)}...${secretKey.substring(secretKey.length - 4)}`);
      
      // Login if needed
      if (isSessionValid) {
        console.log('✅ Đã login sẵn, skip login step');
      } else {
        console.log('🔐 Đang login...');
        await googleAuthService.login(page, account.email, account.password);
      }
      
      console.log('🔍 Navigate đến 2FA settings...');
      await googleAuthService.navigateTo2FASettings(page);
      
      // Try to find and click "Turn on 2-Step Verification" button
      console.log('🔍 Tìm và click "Turn on 2-Step Verification"...');
      const clickedTurnOn2Step = await authenticatorService.clickTurnOn2StepButton(page);
      
      if (!clickedTurnOn2Step) {
        console.log('❌ Không tìm thấy "Turn on 2-Step Verification" button');
        
        // Check if Google is asking for phone number
        const hasPhonePopup = await authenticatorService.detectPhoneNumberPopup(page);
        
        if (hasPhonePopup) {
          console.log('📱 Google đang yêu cầu thêm số điện thoại!');
          console.log('🔄 Sẽ thử skip phone popup...');
          
          // Try to skip the phone popup
          const skipped = await authenticatorService.skipPhoneNumberPopup(page);
          
          if (!skipped) {
            console.log('⚠️  Không thể skip phone popup');
            console.log('📱 Bạn có thể cần thêm số điện thoại thủ công, logout và retry lại');
            throw new Error('Google requires phone number to enable 2FA. Please add a phone number manually, logout, and retry.');
          }
          
          // If skip succeeded, retry clicking "Turn on 2-Step"
          console.log('✅ Đã skip phone popup, đang retry "Turn on 2-Step" button...');
          await new Promise(r => setTimeout(r, 3000));
          
          const clickedTurnOn2StepRetry = await authenticatorService.clickTurnOn2StepButton(page);
          if (!clickedTurnOn2StepRetry) {
            console.log('❌ Vẫn không tìm thấy "Turn on 2-Step Verification" button sau khi skip');
            throw new Error('Could not find "Turn on 2-Step Verification" button after skipping phone popup. Please retry later.');
          }
          
          console.log('✅ Đã click "Turn on 2-Step Verification" sau khi skip phone popup!');
        } else {
          console.log('⚠️  KHÔNG set is_authenticator=true, user có thể retry sau');
          throw new Error('Could not find "Turn on 2-Step Verification" button. Authenticator code is saved but 2FA is not enabled yet. Please retry later.');
        }
      }
      
      console.log('✅ Đã click "Turn on 2-Step Verification"');
      
      // Click "Done" button
      const clickedDone = await authenticatorService.clickDoneButton(page);
      if (!clickedDone) {
        console.log('⚠️  Could not find "Done" button, continuing...');
      }
      
      console.log('🎉 Đã bật 2-Step Verification!');
      
      // NOW we can set is_authenticator to true
      await AccountYoutube.update(
        { 
          is_authenticator: true,
          last_login_at: new Date()
        },
        { where: { email: account.email } }
      );
      
      console.log('💾 Đã set is_authenticator=true');
      skipAuth = true;
      
    } else if (existingAccount && existingAccount.is_authenticator === true && secretKey) {
      // Already has 2FA enabled, skip setup
      console.log('\n✅ Account đã có Authenticator enabled (is_authenticator=true), skip setup 2FA');
      console.log(`🔑 Secret key: ${secretKey.substring(0, 4)}...${secretKey.substring(secretKey.length - 4)}`);
      skipAuth = true;
      
      // Login if needed
      if (isSessionValid) {
        console.log('✅ Đã login sẵn, skip login step');
      } else {
        console.log('🔐 Đang login...');
        await googleAuthService.login(page, account.email, account.password);
      }
      
      console.log('✅ Login success, ready to check channel');
      
    } else {
      // Setup 2FA from scratch (generate new code)
      console.log('🔐 Đang setup 2FA từ đầu (generate new authenticator code)...');
      
      // Login if needed
      if (isSessionValid) {
        console.log('✅ Đã login sẵn, skip login step');
      } else {
        console.log('🔐 Đang login...');
        await googleAuthService.login(page, account.email, account.password);
      }
      
      await googleAuthService.navigateTo2FASettings(page);

      const clickedAuth = await authenticatorService.clickAuthenticatorLink(page);
      if (!clickedAuth) {
        throw new Error('Could not click Authenticator link');
      }

      const clickedSetup = await authenticatorService.clickSetupButton(page);
      if (!clickedSetup) {
        throw new Error('Could not click Set up button');
      }

      const clickedCantScan = await authenticatorService.clickCantScanButton(page);
      if (!clickedCantScan) {
        throw new Error('Could not click Can\'t scan button');
      }

      secretKey = await authenticatorService.extractSecretKey(page);
      if (!secretKey) {
        throw new Error('Could not extract secret key');
      }

      console.log(`✅ Secret key: ${secretKey.substring(0, 4)}...${secretKey.substring(secretKey.length - 4)}`);

      totp = authenticatorService.generateOTP(secretKey);
      console.log(`🔐 OTP Code: ${totp}`);

      await authenticatorService.clickNextButton(page);

      const otpEntered = await authenticatorService.enterOTP(page, totp);
      if (!otpEntered) {
        throw new Error('Could not enter OTP');
      }

      const verified = await authenticatorService.clickVerifyButton(page);
      if (!verified) {
        throw new Error('Could not click Verify button');
      }

      console.log('🎉 Verify OTP thành công!');

      // Step 1: Click "Turn on" link first (to close popup and show the main button)
      console.log('🔍 Step 1: Click "Turn on" link để tắt popup...');
      const clickedTurnOnLink = await authenticatorService.clickTurnOnLink(page);
      if (!clickedTurnOnLink) {
        console.log('⚠️  Could not find "Turn on" link, continuing anyway...');
      } else {
        console.log('✅ Đã click "Turn on" link');
      }

      // Step 2: Reload page to ensure clean state
      console.log('� Step 2: Reload page để đảm bảo state sạch...');
      await page.reload({ waitUntil: 'load' });
      console.log('✅ Page đã reload');
      await new Promise(r => setTimeout(r, 3000));

      // Step 3: Click "Turn on 2-Step Verification" button
      console.log('� Step 3: Click "Turn on 2-Step Verification" button...');
      const clickedTurnOn2Step = await authenticatorService.clickTurnOn2StepButton(page);
      
      if (!clickedTurnOn2Step) {
        console.log('❌ Không tìm thấy "Turn on 2-Step Verification" button');
        console.log('💡 Thử reload và click lại lần nữa...');
        
        // Retry with reload
        await page.reload({ waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 3000));
        
        const clickedRetry = await authenticatorService.clickTurnOn2StepButton(page);
        
        if (!clickedRetry) {
          console.log('❌ Vẫn không tìm thấy button sau retry');
          
          // Save code but NOT set is_authenticator to true
          const [updatedCount] = await AccountYoutube.update(
            { 
              code_authenticators: secretKey,
              channel_name: account.channel_name,
              is_authenticator: false,
              last_login_at: new Date()
            },
            { where: { email: account.email } }
          );

          if (updatedCount === 0) {
            await AccountYoutube.create({
              email: account.email,
              password: account.password,
              code_authenticators: secretKey,
              channel_name: account.channel_name,
              is_authenticator: false,
              last_login_at: new Date()
            });
          }

          console.log('💾 Đã lưu code_authenticators (is_authenticator=false)');
          throw new Error('Could not find "Turn on 2-Step Verification" button. Authenticator code is saved. Please retry later.');
        }
      }
      
      console.log('✅ Đã click "Turn on 2-Step Verification"');
      
      // Click "Done" button after turning on 2-Step Verification
      const clickedDone = await authenticatorService.clickDoneButton(page);
      if (!clickedDone) {
        console.log('⚠️  Could not find "Done" button, continuing...');
      }

      console.log('🎉 Đã bật 2-Step Verification!');

      // NOW we can save and set is_authenticator to true
      const [updatedCount] = await AccountYoutube.update(
        { 
          code_authenticators: secretKey,
          channel_name: account.channel_name,
          is_authenticator: true,
          last_login_at: new Date()
        },
        { where: { email: account.email } }
      );

      if (updatedCount === 0) {
        console.log('⚠️  Account not found in database, creating...');
        await AccountYoutube.create({
          email: account.email,
          password: account.password,
          code_authenticators: secretKey,
          channel_name: account.channel_name,
          is_authenticator: true,
          last_login_at: new Date()
        });
      }

      console.log('💾 Đã lưu Authenticator vào database với is_authenticator=true');
      
      // Verify the update was successful
      const verifyAccount = await AccountYoutube.findOne({ where: { email: account.email } });
      console.log(`✅ Verified is_authenticator: ${verifyAccount.is_authenticator} (type: ${typeof verifyAccount.is_authenticator})`);
      console.log(`✅ Verified code_authenticators: ${verifyAccount.code_authenticators ? 'SET' : 'NULL'}`);
    }

    // ==================== STEP 2: CREATE CHANNEL ====================
    console.log('\n🔍 Step 2: Checking channel status...');
    const accountAfterAuth = await AccountYoutube.findOne({
      where: { email: account.email }
    });

    console.log(`   is_authenticator: ${accountAfterAuth.is_authenticator} (type: ${typeof accountAfterAuth.is_authenticator})`);
    console.log(`   is_create_channel: ${accountAfterAuth.is_create_channel} (type: ${typeof accountAfterAuth.is_create_channel})`);
    console.log(`   is_upload_avatar: ${accountAfterAuth.is_upload_avatar} (type: ${typeof accountAfterAuth.is_upload_avatar})`);
    console.log(`   channel_link: ${accountAfterAuth.channel_link || 'null'}`);

    let channelInfo = { name: '', link: '' };
    let avatarUploaded = false;
    let avatarName = '';

    // Create channel if not exists
    if (!accountAfterAuth.is_create_channel || !accountAfterAuth.channel_link) {
      // Double check - if CSV provided channel_link, we should trust it and skip creation
      if (accountAfterAuth.channel_link && accountAfterAuth.channel_link.startsWith('http')) {
        console.log('✅ Step 2: CSV provided channel_link, marking as done and skipping creation');
        console.log(`   channel_link: ${accountAfterAuth.channel_link}`);
        
        // Update is_create_channel to true since we have the link
        await AccountYoutube.update(
          { is_create_channel: true },
          { where: { email: account.email } }
        );
        
        channelInfo.link = accountAfterAuth.channel_link;
        channelInfo.name = accountAfterAuth.channel_name;
      } else {
        // No channel_link, need to create
        try {
          console.log('\n📺 Step 2: Creating YouTube channel...');
          
          const channelName = account.channel_name || `Channel ${account.email.split('@')[0]}`;
          console.log(`📝 Channel name từ DB: "${accountAfterAuth.channel_name}"`);
          console.log(`📝 Channel name sẽ dùng: "${channelName}"`);
          
          const createResult = await youtubeService.createChannel(page, channelName);
          
          // Get channel info
          channelInfo = await youtubeService.getChannelInfo(page);
          console.log(`✅ Channel info:`, channelInfo);

          // Use actual channel name from createResult (may be modified during retry)
          const actualChannelName = createResult.channelName || channelInfo.name || channelName;
          console.log(`📝 Actual channel name to save: "${actualChannelName}"`);

          // Update channel info to database
          const channelUpdateData = {
            channel_name: actualChannelName, // Use actual name (may have been modified)
            is_create_channel: true
          };
          
          if (channelInfo.link && channelInfo.link.startsWith('http')) {
            channelUpdateData.channel_link = channelInfo.link;
          }

          await AccountYoutube.update(channelUpdateData, { where: { email: account.email } });
          console.log('💾 Đã lưu thông tin channel vào database');

        } catch (channelError) {
          console.error('❌ Lỗi tạo channel:', channelError.message);
          // Don't update anything to DB if channel creation failed
          // Throw error to mark this account as failed
          throw new Error(`Failed to create channel: ${channelError.message}`);
        }
      }
    } else {
      console.log('✅ Step 2: Account đã có channel, skip tạo channel');
      channelInfo.link = accountAfterAuth.channel_link;
      channelInfo.name = accountAfterAuth.channel_name;
    }

    // ==================== STEP 3: UPLOAD AVATAR ====================
    // Refresh account data to get latest channel info
    const accountBeforeAvatar = await AccountYoutube.findOne({
      where: { email: account.email }
    });

    // Upload avatar if channel exists and not yet uploaded
    if (accountBeforeAvatar.channel_link && !accountBeforeAvatar.is_upload_avatar) {
      try {
        console.log('\n🖼️  Step 3: Uploading avatar...');
        
        const avatarsDir = path.join(__dirname, '../../avatars');
        const fs = require('fs');
        let avatarPath = null;
        
        // Check if avatar already downloaded
        if (accountBeforeAvatar.image_name && fs.existsSync(path.join(avatarsDir, accountBeforeAvatar.image_name))) {
          avatarPath = path.join(avatarsDir, accountBeforeAvatar.image_name);
          console.log(`📸 Using downloaded avatar: ${accountBeforeAvatar.image_name}`);
        } else if (accountBeforeAvatar.avatar_url) {
          // Download now
          console.log(`📥 Downloading avatar from Facebook...`);
          const fileName = `avatar_${account.email.split('@')[0]}_${Date.now()}`;
          avatarPath = await facebDownloader.downloadAvatar(
            accountBeforeAvatar.avatar_url,
            avatarsDir,
            fileName
          );
          const imageName = path.basename(avatarPath);
          avatarName = imageName;
          
          // Save image_name to DB
          await AccountYoutube.update(
            { image_name: imageName },
            { where: { email: account.email } }
          );
          console.log(`💾 Saved image_name: ${imageName}`);
        }
        
        if (avatarPath) {
          // Extract channel ID
          const { fileHelper } = require('../helpers');
          const channelId = fileHelper.extractChannelId(accountBeforeAvatar.channel_link);
          
          if (channelId) {
            const youtubeService = require('../services/youtube.service');
            
            try {
              await youtubeService.uploadAvatar(page, channelId, avatarPath);
              avatarUploaded = true;
              avatarName = path.basename(avatarPath);
              
              // Mark avatar as uploaded
              await AccountYoutube.update(
                { is_upload_avatar: true },
                { where: { email: account.email } }
              );
              
              console.log('✅ Đã upload avatar thành công');
            } catch (uploadError) {
              console.error('❌ Lỗi khi upload avatar:', uploadError.message);
              console.log('⚠️  Avatar upload failed, will NOT mark as uploaded (can retry later)');
              // Don't set avatarUploaded = true
              // Don't update is_upload_avatar
            }
          } else {
            console.log('⚠️  Không thể extract channel ID từ channel_link');
          }
        } else {
          console.log('ℹ️  Không có avatar để upload');
        }
      } catch (avatarError) {
        console.error('⚠️  Lỗi trong avatar step:', avatarError.message);
        // Continue even if avatar step fails
      }
    } else if (accountBeforeAvatar.is_upload_avatar) {
      console.log('✅ Step 3: Avatar đã được upload trước đó');
    } else {
      console.log('ℹ️  Step 3: Skip upload avatar (chưa có channel hoặc không có avatar_url)');
    }

    console.log('\n🎉 Setup hoàn tất!');

    // DON'T logout - preserve session/cookies
    // await googleAuthService.logout(page);
    console.log('✅ Giữ session (không logout để preserve cookies)');
    
    await page.close();

    // Get final account status
    const finalAccount = await AccountYoutube.findOne({
      where: { email: account.email }
    });

    return {
      email: account.email,
      password: account.password,
      channel_name: finalAccount.channel_name,
      success: true,
      secretKey: secretKey,
      otpCode: totp,
      skippedAuth: skipAuth,
      channelCreated: !!finalAccount.channel_link,
      channelLink: finalAccount.channel_link,
      avatarUploaded: avatarUploaded,
      avatar: avatarName
    };

  } catch (error) {
    console.error(`❌ Lỗi: ${error.message}`);
    
    try {
      // Only set is_authenticator to false if 2FA setup itself failed (secretKey not saved)
      // Check if secretKey was already saved to avoid overwriting successful 2FA setup
      const existingAccount = await AccountYoutube.findOne({ where: { email: account.email } });
      
      const updateData = {
        notes: `Setup failed: ${error.message}`
      };
      
      // Only set is_authenticator to false if it wasn't already set to true (2FA not completed yet)
      if (!existingAccount?.code_authenticators || existingAccount.is_authenticator !== true) {
        updateData.is_authenticator = false;
        console.log('⚠️  2FA setup failed, setting is_authenticator to false');
      } else {
        console.log('ℹ️  2FA was successful, keeping is_authenticator as true despite later errors');
      }
      
      await AccountYoutube.update(updateData, { where: { email: account.email } });
    } catch (dbError) {
      console.error('❌ Lỗi update database:', dbError.message);
    }
    
    try { await page.close(); } catch(e) {}
    return { 
      email: account.email,
      password: account.password,
      channel_name: account.channel_name,
      success: false, 
      error: error.message 
    };
  }
}

module.exports = new VerifyAuthenticatorController();
