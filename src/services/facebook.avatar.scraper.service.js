const puppeteer = require('puppeteer');

class FacebookAvatarScraperService {
  /**
   * Lấy link avatar Facebook (user/page)
   * @param {string} fbUrl - URL Facebook user hoặc page
   * @returns {Promise<string>} - Link ảnh avatar lớn nhất
   */
  async getAvatarUrl(fbUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
      // Truy cập trang Facebook
      await page.goto(fbUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Tìm thẻ img avatar (có thể thay đổi theo giao diện FB)
      // Ưu tiên thẻ img có alt chứa tên user/page và src chứa scontent
      const avatarUrl = await page.evaluate(() => {
        // Tìm tất cả thẻ img có src chứa 'scontent' (ảnh FB)
        const imgs = Array.from(document.querySelectorAll('img'));
        const avatarImg = imgs.find(img =>
          img.src && img.src.includes('scontent') &&
          (img.alt?.toLowerCase().includes('profile picture') || img.alt?.toLowerCase().includes('ảnh đại diện') || img.width > 100)
        );
        return avatarImg ? avatarImg.src : null;
      });
      if (!avatarUrl) throw new Error('Không tìm thấy avatar!');
      return avatarUrl;
    } finally {
      await browser.close();
    }
  }
}

module.exports = FacebookAvatarScraperService;
