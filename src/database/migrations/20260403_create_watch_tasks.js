const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('watch_tasks', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      campaign_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'watch_campaigns', key: 'id' },
        onDelete: 'CASCADE'
      },
      account_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      video_url: {
        type: DataTypes.STRING,
        allowNull: false
      },
      video_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order of video in campaign (0, 1, 2...)'
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending | running | done | failed'
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true
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

    await queryInterface.addIndex('watch_tasks', ['campaign_id', 'status']);
    await queryInterface.addIndex('watch_tasks', ['campaign_id', 'video_index', 'status']);
    console.log('✅ Created table: watch_tasks');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('watch_tasks');
    console.log('✅ Dropped table: watch_tasks');
  }
};
