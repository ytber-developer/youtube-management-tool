const sequelize = require('../config/database');
const AccountYoutube = require('./AccountYoutube');
const UploadedVideo = require('./UploadedVideo');
const WatchCampaign = require('./WatchCampaign');
const WatchTask = require('./WatchTask');

// Associations
AccountYoutube.hasMany(UploadedVideo, {
  foreignKey: 'account_youtube_id',
  as: 'videos'
});
UploadedVideo.belongsTo(AccountYoutube, {
  foreignKey: 'account_youtube_id',
  as: 'account'
});

WatchCampaign.hasMany(WatchTask, { foreignKey: 'campaign_id', as: 'tasks' });
WatchTask.belongsTo(WatchCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

module.exports = {
  sequelize,
  AccountYoutube,
  UploadedVideo,
  WatchCampaign,
  WatchTask
};
