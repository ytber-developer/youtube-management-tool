const campaignService = require('../services/campaign.service');
const WatchCampaign = require('../models/WatchCampaign');
const WatchTask = require('../models/WatchTask');

class CampaignController {

  async create(req, res) {
    try {
      const { name, videoUrls, accountIds, options } = req.body;

      if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
        return res.status(400).json({ success: false, message: 'videoUrls (array) is required' });
      }
      if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
        return res.status(400).json({ success: false, message: 'accountIds (array) is required' });
      }

      const validUrls = videoUrls.filter(u =>
        u && (u.includes('youtube.com/watch') || u.includes('youtube.com/shorts') || u.includes('youtu.be/'))
      );
      if (validUrls.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid YouTube URLs provided' });
      }

      const campaign = await campaignService.createCampaign({
        name: name || `Campaign ${new Date().toLocaleString('vi-VN')}`,
        videoUrls: validUrls,
        accountIds,
        options: options || {}
      });

      const progress = await campaignService.getCampaignProgress(campaign.id);

      res.json({ success: true, data: progress });
    } catch (err) {
      console.error('❌ Campaign create error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async list(req, res) {
    try {
      const campaigns = await WatchCampaign.findAll({ order: [['createdAt', 'DESC']] });
      const result = await Promise.all(campaigns.map(c => campaignService.getCampaignProgress(c.id)));
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async get(req, res) {
    try {
      const progress = await campaignService.getCampaignProgress(req.params.id);
      if (!progress) return res.status(404).json({ success: false, message: 'Campaign not found' });
      res.json({ success: true, data: progress });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async pause(req, res) {
    try {
      await campaignService.updateCampaignStatus(req.params.id, 'paused');
      res.json({ success: true, message: 'Campaign paused' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async resume(req, res) {
    try {
      await campaignService.updateCampaignStatus(req.params.id, 'running');
      res.json({ success: true, message: 'Campaign resumed' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async stop(req, res) {
    try {
      // Mark all pending tasks as failed, then mark campaign done
      const campaign = await WatchCampaign.findByPk(req.params.id);
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });

      await WatchTask.update(
        { status: 'failed', error: 'Stopped by user' },
        { where: { campaign_id: req.params.id, status: 'pending' } }
      );
      await campaign.update({ status: 'done' });
      res.json({ success: true, message: 'Campaign stopped' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async deleteCampaign(req, res) {
    try {
      const campaign = await WatchCampaign.findByPk(req.params.id);
      if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
      await WatchTask.destroy({ where: { campaign_id: req.params.id } });
      await campaign.destroy();
      res.json({ success: true, message: 'Campaign deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new CampaignController();
