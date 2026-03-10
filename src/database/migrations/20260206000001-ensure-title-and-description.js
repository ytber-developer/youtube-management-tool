'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('uploaded_videos');
    
    // Ensure title is TEXT (not VARCHAR)
    if (tableInfo.title && tableInfo.title.type !== 'TEXT') {
      await queryInterface.changeColumn('uploaded_videos', 'title', {
        type: Sequelize.TEXT,
        allowNull: true
      });
      console.log('✅ Changed title to TEXT');
    }

    // Ensure video_description exists as TEXT
    if (!tableInfo.video_description) {
      await queryInterface.addColumn('uploaded_videos', 'video_description', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Video description for upload'
      });
      console.log('✅ Added video_description column');
    } else if (tableInfo.video_description.type !== 'TEXT') {
      await queryInterface.changeColumn('uploaded_videos', 'video_description', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Video description for upload'
      });
      console.log('✅ Changed video_description to TEXT');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Revert title back to VARCHAR(255)
    await queryInterface.changeColumn('uploaded_videos', 'title', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    // Remove video_description if it was added
    const tableInfo = await queryInterface.describeTable('uploaded_videos');
    if (tableInfo.video_description) {
      await queryInterface.removeColumn('uploaded_videos', 'video_description');
    }

    console.log('✅ Reverted changes');
  }
};
