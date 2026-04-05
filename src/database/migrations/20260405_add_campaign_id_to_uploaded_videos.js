'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('uploaded_videos', 'campaign_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'id',
      references: { model: 'upload_campaigns', key: 'id' },
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('uploaded_videos', 'order_index', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
      after: 'campaign_id',
      comment: 'Order within a campaign (0-based)'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('uploaded_videos', 'order_index');
    await queryInterface.removeColumn('uploaded_videos', 'campaign_id');
  }
};
