'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('upload_campaigns', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      account_youtube_id: { type: Sequelize.INTEGER, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('new', 'running', 'pending', 'done'),
        allowNull: false,
        defaultValue: 'new'
      },
      scheduled_start_at: { type: Sequelize.DATE, allowNull: true },
      options: { type: Sequelize.TEXT, allowNull: true },
      total_videos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('upload_campaigns');
    // Also drop ENUM type if using Postgres (MySQL doesn't need this)
  }
};
