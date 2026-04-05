'use strict';

// Fix: global Sequelize config has underscored:true, so timestamp columns must be
// created_at / updated_at (snake_case), not createdAt / updatedAt.
// SQLite does not support ALTER COLUMN RENAME directly, so we recreate the table.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the incorrectly-named table created by the previous migration
    await queryInterface.dropTable('upload_campaigns');

    // Recreate with snake_case timestamp columns
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
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('upload_campaigns');
  }
};
