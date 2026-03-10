/**
 * Watch Service - Main Router (Puppeteer + Chrome)
 * 
 * Automatically detects video type and delegates to appropriate service:
 * - YouTube Shorts → watch.short.puppeteer.service.js
 * - Regular Videos → watch.normal.puppeteer.service.js
 */

const watchShortsService = require('./youtube/watch.short.puppeteer.service');
const watchNormalService = require('./youtube/watch.normal.puppeteer.service');

class WatchService {
  
  /**
   * Detect if URL is a YouTube Short
   */
  isYouTubeShort(url) {
    return url.includes('/shorts/');
  }
  
  /**
   * Watch YouTube video/short (auto-detect type and delegate)
   * @param {Object} page - Puppeteer page object
   * @param {string} videoUrl - YouTube video URL
   * @param {number} duration - Duration to watch in seconds (default: 30s)
   * @param {Object} options - Options for watching
   * @param {boolean} options.humanBehavior - Enable human-like behavior (default: true)
   * @param {boolean} options.randomDuration - Use random duration (default: false)
   * @param {boolean} options.autoSubscribe - Auto subscribe to channel (default: false)
   * @param {boolean} options.autoComment - Auto comment on video (default: false)
   * @param {boolean} options.autoLike - Auto like video (default: false)
   */
  async watchVideo(page, videoUrl, duration = 30, options = {}) {
    const isShort = this.isYouTubeShort(videoUrl);
    
    console.log(`\n🎯 Detected: ${isShort ? '📱 YouTube Short' : '🎬 Regular Video'}`);
    
    if (isShort) {
      return await watchShortsService.watchShort(page, videoUrl, duration, options);
    } else {
      return await watchNormalService.watchVideo(page, videoUrl, duration, options);
    }
  }
}

module.exports = new WatchService();
