const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UploadCampaign = sequelize.define('UploadCampaign', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  account_youtube_id: { type: DataTypes.INTEGER, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('new', 'running', 'pending', 'done'),
    allowNull: false,
    defaultValue: 'new',
    comment: 'new=queued, running=active, pending=on hold, done=finished'
  },
  scheduled_start_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When cron should auto-promote to running (null = ASAP)'
  },
  options: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON: { visibility, scheduleDate }',
    get() { try { return JSON.parse(this.getDataValue('options')); } catch { return {}; } },
    set(val) { this.setDataValue('options', JSON.stringify(val || {})); }
  },
  total_videos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'upload_campaigns',
  timestamps: true
});

module.exports = UploadCampaign;
