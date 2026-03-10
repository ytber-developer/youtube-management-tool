const path = require('path');
const { AVATAR_SETTINGS, YOUTUBE_SELECTORS } = require('../../config/constants');
const fileHelper = require('../../helpers/file.helper');

class AvatarService {
  /**
   * Upload avatar for YouTube channel
   * @param {Page} page 
   * @param {string} channelId 
   * @param {string} imagePath 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async uploadAvatar(page, channelId, imagePath) {
    try {
      console.log(`🖼️  Đang upload avatar cho channel: ${channelId}`);

      // Navigate to channel editing page
      // Support both channel ID (UCxxxx) and handle (@ChannelName) formats
      let editUrl;
      if (channelId.startsWith('@')) {
        // For handles, use the handle directly in the URL
        editUrl = `https://studio.youtube.com/channel/${channelId}/editing`;
      } else {
        // For channel IDs, use standard format
        editUrl = `https://studio.youtube.com/channel/${channelId}/editing`;
      }
      
      await page.goto(editUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(r => setTimeout(r, 3000));

      console.log('🔍 Đang tìm nút "Upload" cho Profile Picture...');

      // Find and click Upload button
      const uploadClicked = await page.evaluate(() => {
        const profileSection = document.querySelector('ytcp-profile-image-upload');
        if (!profileSection) return false;

        const uploadBtn = profileSection.querySelector('ytcp-button#upload-button');
        if (uploadBtn) {
          uploadBtn.click();
          return true;
        }
        return false;
      });

      if (!uploadClicked) {
        throw new Error('Could not find Profile Picture Upload button');
      }

      console.log('✅ Đã click nút Upload (Profile Picture)');
      await new Promise(r => setTimeout(r, 1000));

      // Upload file
      console.log(`📤 Đang upload file: ${imagePath}`);
      const fileInput = await page.$(YOUTUBE_SELECTORS.FILE_INPUT);

      if (!fileInput) {
        throw new Error('Could not find file input');
      }

      await fileInput.uploadFile(imagePath);
      console.log('✅ Đã select file');
      await new Promise(r => setTimeout(r, AVATAR_SETTINGS.WAIT_AFTER_UPLOAD));

      // Click Done button
      console.log('🔍 Đang tìm nút "Done"...');
      await new Promise(r => setTimeout(r, 2000));

      const doneClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, ytcp-button'));
        const doneBtn = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          return text.includes('done') ||
                 text.includes('save') ||
                 ariaLabel.includes('done') ||
                 ariaLabel.includes('save');
        });

        if (doneBtn) {
          doneBtn.click();
          return true;
        }
        return false;
      });

      if (doneClicked) {
        console.log('✅ Đã click "Done"');
      }

      await new Promise(r => setTimeout(r, AVATAR_SETTINGS.WAIT_AFTER_DONE));

      // Click Publish button
      console.log('🔍 Đang tìm nút "Publish"...');
      const publishClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, ytcp-button'));
        const publishBtn = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('publish');
        });

        if (publishBtn) {
          publishBtn.click();
          return true;
        }
        return false;
      });

      if (publishClicked) {
        console.log('✅ Đã click "Publish"');
        console.log('⏳ Đang chờ save changes...');
        await new Promise(r => setTimeout(r, AVATAR_SETTINGS.WAIT_AFTER_PUBLISH));

        // Handle "Leave site?" dialog if appears
        console.log('🔍 Checking for "Leave site?" dialog...');
        try {
          await new Promise(r => setTimeout(r, AVATAR_SETTINGS.WAIT_FOR_DIALOG));

          const leaveClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const leaveBtn = buttons.find(btn => {
              const text = btn.textContent?.toLowerCase().trim() || '';
              return text === 'leave' || text === 'rời khỏi';
            });

            if (leaveBtn) {
              leaveBtn.click();
              return true;
            }
            return false;
          });

          if (leaveClicked) {
            console.log('✅ Đã click "Leave" trong dialog');
            await new Promise(r => setTimeout(r, 2000));
          } else {
            console.log('✅ Changes saved successfully (no dialog appeared)');
          }
        } catch (e) {
          console.log('✅ Changes saved successfully');
        }
      }

      console.log('🎉 Upload avatar thành công!');
      return { success: true };

    } catch (error) {
      console.error('❌ Lỗi upload avatar:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload avatar by index from avatars folder
   * @param {Page} page 
   * @param {string} channelLink 
   * @param {number} indexAvatar 
   * @returns {Promise<{success: boolean, avatarName?: string, error?: string}>}
   */
  async uploadAvatarByIndex(page, channelLink, indexAvatar) {
    try {
      if (!channelLink || !indexAvatar) {
        return { success: false, error: 'Missing channelLink or indexAvatar' };
      }

      console.log('\n🖼️  Đang upload avatar...');

      // Get avatar file by index
      const avatarsDir = path.join(__dirname, '../../../avatars');
      const avatarResult = fileHelper.getAvatarByIndex(avatarsDir, indexAvatar);

      if (!avatarResult.success) {
        console.log(`⚠️  ${avatarResult.error}`);
        return avatarResult;
      }

      console.log(`📸 Using avatar[${indexAvatar}]: ${avatarResult.filename}`);

      // Extract channel ID
      const channelId = fileHelper.extractChannelId(channelLink);
      if (!channelId) {
        return { success: false, error: 'Invalid channel link' };
      }

      // Upload avatar
      const uploadResult = await this.uploadAvatar(page, channelId, avatarResult.path);
      
      if (uploadResult.success) {
        return {
          success: true,
          avatarName: avatarResult.filename
        };
      }

      return uploadResult;

    } catch (error) {
      console.error('⚠️  Lỗi upload avatar:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AvatarService();
