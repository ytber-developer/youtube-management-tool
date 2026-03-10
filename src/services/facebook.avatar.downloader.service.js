const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FacebookAvatarDownloader {
  /**
   * Lấy direct image link từ Facebook photo URL
   * @param {string} fbPhotoUrl - URL ảnh Facebook (photo.php)
   * @returns {Promise<string>} - Direct image URL
   */
  async getDirectImageUrl(fbPhotoUrl) {
    let browser = null;
    try {
      console.log('🌐 Launching browser to get Facebook image...');
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto(fbPhotoUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForTimeout(3000);
      
      // Tìm thẻ img có src chứa 'scontent' (ảnh FB)
      const directImg = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const avatarImg = imgs.find(img =>
          img.src && img.src.includes('scontent') &&
          (img.alt?.toLowerCase().includes('profile picture') || 
           img.alt?.toLowerCase().includes('ảnh đại diện') || 
           img.width > 100)
        );
        return avatarImg ? avatarImg.src : null;
      });
      
      await browser.close();
      
      if (!directImg) {
        throw new Error('Không tìm thấy direct image link từ Facebook!');
      }
      
      console.log('✅ Got direct image URL');
      return directImg;
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  /**
   * Download avatar từ Facebook về folder
   * @param {string} fbPhotoUrl - URL ảnh Facebook
   * @param {string} outputFolder - Thư mục đích để lưu ảnh
   * @param {string} fileName - Tên file (không bao gồm extension)
   * @returns {Promise<string>} - Đường dẫn file đã lưu
   */
  async downloadAvatar(fbPhotoUrl, outputFolder, fileName) {
    try {
      console.log(`\n📥 Downloading avatar from: ${fbPhotoUrl}`);
      
      // Lấy direct image URL
      const directImgUrl = await this.getDirectImageUrl(fbPhotoUrl);
      
      // Tạo thư mục nếu chưa tồn tại
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      
      // Lấy extension từ URL
      const ext = path.extname(directImgUrl.split('?')[0]) || '.jpg';
      const filePath = path.join(outputFolder, `${fileName}${ext}`);
      
      // Download file
      console.log(`💾 Saving to: ${filePath}`);
      const response = await axios({
        url: directImgUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      console.log(`✅ Avatar downloaded successfully: ${fileName}${ext}`);
      return filePath;
    } catch (error) {
      console.error(`❌ Error downloading avatar:`, error.message);
      throw error;
    }
  }

  /**
   * Download nhiều avatar từ list accounts
   * @param {Array} accounts - Danh sách accounts [{email, avatar_url}]
   * @param {string} outputFolder - Thư mục đích
   * @returns {Promise<Array>} - Danh sách kết quả
   */
  async downloadMultipleAvatars(accounts, outputFolder) {
    const results = [];
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (!account.avatar_url) {
        console.log(`⏭️  Skip ${account.email}: No avatar_url`);
        results.push({
          email: account.email,
          success: false,
          error: 'No avatar_url'
        });
        continue;
      }
      
      try {
        const fileName = `avatar_${account.email.split('@')[0]}_${Date.now()}`;
        const filePath = await this.downloadAvatar(account.avatar_url, outputFolder, fileName);
        
        results.push({
          email: account.email,
          success: true,
          filePath: filePath
        });
      } catch (error) {
        results.push({
          email: account.email,
          success: false,
          error: error.message
        });
      }
      
      // Delay giữa các lần download
      if (i < accounts.length - 1) {
        console.log('⏳ Waiting 2s before next download...');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    return results;
  }
}

module.exports = new FacebookAvatarDownloader();
