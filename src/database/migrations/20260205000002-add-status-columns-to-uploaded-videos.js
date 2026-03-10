'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Thêm các columns mới vào bảng uploaded_videos
    await queryInterface.addColumn('uploaded_videos', 'source_url_hash', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: 'Hash of source_url to prevent duplicates'
    });

    await queryInterface.addColumn('uploaded_videos', 'local_file_path', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Path to downloaded video file'
    });

    await queryInterface.addColumn('uploaded_videos', 'video_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Video description'
    });

    await queryInterface.addColumn('uploaded_videos', 'video_visibility', {
      type: Sequelize.ENUM('public', 'unlisted', 'private'),
      defaultValue: 'public',
      allowNull: true,
      comment: 'Video visibility setting'
    });

    await queryInterface.addColumn('uploaded_videos', 'schedule_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Scheduled publish date/time'
    });

    await queryInterface.addColumn('uploaded_videos', 'status', {
      type: Sequelize.ENUM('pending', 'downloading', 'downloaded', 'uploading', 'completed', 'failed', 'skipped'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Upload status'
    });

    await queryInterface.addColumn('uploaded_videos', 'error_message', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Error message if failed'
    });

    await queryInterface.addColumn('uploaded_videos', 'download_attempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of download attempts'
    });

    await queryInterface.addColumn('uploaded_videos', 'upload_attempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of upload attempts'
    });

    await queryInterface.addColumn('uploaded_videos', 'downloaded_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when video was downloaded'
    });

    await queryInterface.addColumn('uploaded_videos', 'uploaded_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when video was uploaded to YouTube'
    });

    // Tạo index cho source_url_hash để tìm kiếm nhanh
    await queryInterface.addIndex('uploaded_videos', ['source_url_hash'], {
      name: 'idx_uploaded_videos_source_url_hash'
    });

    // Tạo index cho status để query nhanh
    await queryInterface.addIndex('uploaded_videos', ['status'], {
      name: 'idx_uploaded_videos_status'
    });

    // Tạo index composite cho account_youtube_id và status
    await queryInterface.addIndex('uploaded_videos', ['account_youtube_id', 'status'], {
      name: 'idx_uploaded_videos_account_status'
    });

    console.log('✅ Added status columns to uploaded_videos table');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('uploaded_videos', 'idx_uploaded_videos_source_url_hash');
    await queryInterface.removeIndex('uploaded_videos', 'idx_uploaded_videos_status');
    await queryInterface.removeIndex('uploaded_videos', 'idx_uploaded_videos_account_status');

    // Remove columns
    await queryInterface.removeColumn('uploaded_videos', 'source_url_hash');
    await queryInterface.removeColumn('uploaded_videos', 'local_file_path');
    await queryInterface.removeColumn('uploaded_videos', 'video_description');
    await queryInterface.removeColumn('uploaded_videos', 'video_visibility');
    await queryInterface.removeColumn('uploaded_videos', 'schedule_date');
    await queryInterface.removeColumn('uploaded_videos', 'status');
    await queryInterface.removeColumn('uploaded_videos', 'error_message');
    await queryInterface.removeColumn('uploaded_videos', 'download_attempts');
    await queryInterface.removeColumn('uploaded_videos', 'upload_attempts');
    await queryInterface.removeColumn('uploaded_videos', 'downloaded_at');
    await queryInterface.removeColumn('uploaded_videos', 'uploaded_at');

    console.log('✅ Removed status columns from uploaded_videos table');
  }
};
