'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('uploaded_videos', 'scheduled_start_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'schedule_date',
      comment: 'When the server should start this upload (null = process ASAP)'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('uploaded_videos', 'scheduled_start_at');
  }
};
