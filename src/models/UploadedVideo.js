const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UploadedVideo = sequelize.define('UploadedVideo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  account_youtube_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  video_url: {
    type: DataTypes.STRING,
    allowNull: true, // Changed to true vì chưa upload thì chưa có URL
    comment: 'YouTube video URL after upload'
  },
  title: {
    type: DataTypes.TEXT,  // Changed to TEXT to support long titles with hashtags
    allowNull: true,
    comment: 'Video title (can contain hashtags and be very long)'
  },
  source_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Original video URL (Facebook, TikTok, etc.)'
  },
  source_url_hash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Hash of source_url to prevent duplicates'
  },
  local_file_path: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Path to downloaded video file'
  },
  video_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Video description'
  },
  video_visibility: {
    type: DataTypes.ENUM('public', 'unlisted', 'private'),
    defaultValue: 'public',
    allowNull: true,
    comment: 'Video visibility setting'
  },
  schedule_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Scheduled publish date/time'
  },
  status: {
    type: DataTypes.ENUM('pending', 'downloading', 'downloaded', 'uploading', 'completed', 'failed', 'skipped'),
    defaultValue: 'pending',
    allowNull: false,
    comment: 'Upload status'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if failed'
  },
  download_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of download attempts'
  },
  upload_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of upload attempts'
  },
  downloaded_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when video was downloaded'
  },
  uploaded_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when video was uploaded to YouTube'
  }
}, {
  tableName: 'uploaded_videos',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = UploadedVideo;
