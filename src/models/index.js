const sequelize = require('../config/database');
const AccountYoutube = require('./AccountYoutube');
const UploadedVideo = require('./UploadedVideo');
const UploadCampaign = require('./UploadCampaign');
const WatchCampaign = require('./WatchCampaign');
const WatchTask = require('./WatchTask');

// AccountYoutube ↔ UploadedVideo
AccountYoutube.hasMany(UploadedVideo, { foreignKey: 'account_youtube_id', as: 'videos' });
UploadedVideo.belongsTo(AccountYoutube, { foreignKey: 'account_youtube_id', as: 'account' });

// UploadCampaign ↔ UploadedVideo
UploadCampaign.hasMany(UploadedVideo, { foreignKey: 'campaign_id', as: 'videos' });
UploadedVideo.belongsTo(UploadCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

// UploadCampaign ↔ AccountYoutube
UploadCampaign.belongsTo(AccountYoutube, { foreignKey: 'account_youtube_id', as: 'account' });

// WatchCampaign ↔ WatchTask
WatchCampaign.hasMany(WatchTask, { foreignKey: 'campaign_id', as: 'tasks' });
WatchTask.belongsTo(WatchCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

module.exports = {
  sequelize,
  AccountYoutube,
  UploadedVideo,
  UploadCampaign,
  WatchCampaign,
  WatchTask
};
