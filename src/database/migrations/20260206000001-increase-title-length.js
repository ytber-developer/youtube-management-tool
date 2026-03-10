'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change title from VARCHAR(255) to TEXT to store long titles
    await queryInterface.changeColumn('uploaded_videos', 'title', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Video title (can be long with hashtags)'
    });

    console.log('✅ Changed title to TEXT');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to VARCHAR(255)
    await queryInterface.changeColumn('uploaded_videos', 'title', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Video title'
    });

    console.log('✅ Reverted title to VARCHAR(255)');
  }
};
