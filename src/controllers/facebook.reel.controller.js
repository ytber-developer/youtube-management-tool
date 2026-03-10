const FacebookReelScraperService = require('../services/facebook.reel.scraper.service');

class FacebookReelController {
  /**
   * POST /api/v1/facebook/reels
   * Body: { pageUrl: string, maxReels?: number }
   */
  async getReels(req, res) {
    try {
      const { pageUrl, maxReels } = req.body;
      if (!pageUrl) {
        return res.status(400).json({ success: false, message: 'pageUrl là bắt buộc' });
      }
      const service = new FacebookReelScraperService();
      const links = await service.getPageReels(pageUrl, maxReels || 50);
      return res.json({ success: true, data: links });
    } catch (error) {
      console.error('[FB REEL CONTROLLER] Lỗi:', error); // Thêm log lỗi chi tiết
      return res.status(500).json({ success: false, message: error.message, stack: error.stack });
    }
  }
}

module.exports = new FacebookReelController();
