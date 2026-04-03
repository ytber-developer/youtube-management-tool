const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WatchTask = sequelize.define('WatchTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campaign_id: { type: DataTypes.INTEGER, allowNull: false },
  account_id: { type: DataTypes.INTEGER, allowNull: false },
  video_url: { type: DataTypes.STRING, allowNull: false },
  video_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  error: { type: DataTypes.TEXT, allowNull: true },
  started_at: { type: DataTypes.DATE, allowNull: true },
  finished_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'watch_tasks',
  timestamps: true
});

module.exports = WatchTask;
