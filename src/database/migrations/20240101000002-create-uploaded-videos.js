const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('uploaded_videos', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      account_youtube_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'account_youtubes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      video_url: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'YouTube video URL after upload'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true
      },
      source_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Original video URL (Facebook, TikTok, etc.)'
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

    await queryInterface.addIndex('uploaded_videos', ['account_youtube_id']);
    await queryInterface.addIndex('uploaded_videos', ['email']);

    console.log('✅ Created table: uploaded_videos');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('uploaded_videos');
    console.log('✅ Dropped table: uploaded_videos');
  }
};
