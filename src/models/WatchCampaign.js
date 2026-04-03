const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WatchCampaign = sequelize.define('WatchCampaign', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  video_urls: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() { try { return JSON.parse(this.getDataValue('video_urls')); } catch { return []; } },
    set(val) { this.setDataValue('video_urls', JSON.stringify(val)); }
  },
  account_ids: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() { try { return JSON.parse(this.getDataValue('account_ids')); } catch { return []; } },
    set(val) { this.setDataValue('account_ids', JSON.stringify(val)); }
  },
  batch_size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  max_duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 120 },
  options: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() { try { return JSON.parse(this.getDataValue('options')); } catch { return {}; } },
    set(val) { this.setDataValue('options', JSON.stringify(val)); }
  },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  current_video_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'watch_campaigns',
  timestamps: true
});

module.exports = WatchCampaign;
