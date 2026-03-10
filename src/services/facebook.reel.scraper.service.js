const puppeteer = require('puppeteer');

class FacebookReelScraperService {
  /**
   * Lấy tất cả link Reel từ Facebook Page
   * @param {string} pageUrl - VD: https://www.facebook.com/tenpage
   * @param {number} maxReels - Số lượng tối đa muốn lấy
   * @returns {Promise<string[]>}
   */
  async getPageReels(pageUrl, maxReels = 50) {
    console.log(`[FB REEL SCRAPER] Bắt đầu crawl page: ${pageUrl} (tối đa ${maxReels} reels)`);
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
      // Thay thế page.waitForTimeout bằng sleep
      const sleep = ms => new Promise(res => setTimeout(res, ms));

      // Truy cập tab Reels của page
      const reelsTabUrl = pageUrl.replace(/\/$/, '') + '/reels';
      console.log(`[FB REEL SCRAPER] Truy cập: ${reelsTabUrl}`);
      await page.goto(reelsTabUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(3000);

      // Đóng popup login nếu có
      try {
        await page.waitForSelector('div[aria-label="Close"]', { timeout: 7000 });
        await page.click('div[aria-label="Close"]');
        console.log('[FB REEL SCRAPER] Đã đóng popup login.');
      } catch (e) {
        console.log('[FB REEL SCRAPER] Không thấy popup login hoặc đã đóng.');
      }

      // Scroll từ từ để load thêm reels (giống thao tác người dùng)
      let prevScroll = 0;
      for (let i = 0; i < 100; i++) {
        // Scroll từng đoạn nhỏ (step = 800px), lặp 10 lần mỗi vòng
        for (let j = 0; j < 10; j++) {
          await page.evaluate(() => window.scrollBy(0, 800));
          await sleep(600); // nghỉ ngắn giữa các lần scroll nhỏ
        }
        await sleep(7000); // nghỉ lâu sau mỗi vòng scroll lớn
        const currScroll = await page.evaluate(() => window.pageYOffset);
        if (currScroll === prevScroll) {
          console.log('[FB REEL SCRAPER] Đã scroll tới cuối trang.');
          break;
        }
        prevScroll = currScroll;
      }

      // Lấy link các reel (lọc bỏ query, giống python)
      const reelLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href*="/reel/"]'))
          .map(a => {
            let href = a.getAttribute('href');
            if (!href) return null;
            // Chuẩn hóa link đầy đủ
            if (!href.startsWith('http')) href = 'https://facebook.com' + href;
            // Bỏ query string
            return href.split('/?s=')[0];
          })
          .filter(Boolean)
      );

      // Loại bỏ trùng lặp
      const uniqueLinks = Array.from(new Set(reelLinks)).slice(0, maxReels);
      console.log(`[FB REEL SCRAPER] Tổng số link reel lấy được: ${uniqueLinks.length}`);

      return uniqueLinks;
    } finally {
      await browser.close();
      console.log('[FB REEL SCRAPER] Đã đóng trình duyệt.');
    }
  }
}

module.exports = FacebookReelScraperService;
