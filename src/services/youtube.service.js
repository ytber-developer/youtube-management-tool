const channelService = require('./youtube/channel.service');
const avatarService = require('./youtube/avatar.service');

class YoutubeService {
  
  /**
   * Create a new YouTube channel
   * @param {Page} page - Puppeteer page instance
   * @param {string} channelName - Name for the channel
   * @returns {Promise<{created: boolean, channelName?: string, message?: string, channelExists?: boolean}>}
   */
  async createChannel(page, channelName) {
    return await channelService.createChannel(page, channelName);
  }

  /**
   * Get channel information after creation
   * @param {Page} page - Puppeteer page instance
   * @returns {Promise<{name: string, link: string}>}
   */
  async getChannelInfo(page) {
    return await channelService.getChannelInfo(page);
  }

  /**
   * Upload avatar to channel
   * @param {Page} page - Puppeteer page instance
   * @param {string} channelId - Channel ID
   * @param {string} imagePath - Path to avatar image
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async uploadAvatar(page, channelId, imagePath) {
    return await avatarService.uploadAvatar(page, channelId, imagePath);
  }
}

module.exports = new YoutubeService();
