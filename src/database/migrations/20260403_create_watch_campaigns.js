const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('watch_campaigns', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      video_urls: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'JSON array of video URLs'
      },
      account_ids: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'JSON array of account IDs'
      },
      batch_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      max_duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 120,
        comment: 'Max watch time per video in seconds'
      },
      options: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON: { autoLike, autoSubscribe, autoComment, humanBehavior }'
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending | running | paused | done'
      },
      current_video_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Which video is currently being processed'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });
    console.log('✅ Created table: watch_campaigns');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('watch_campaigns');
    console.log('✅ Dropped table: watch_campaigns');
  }
};
