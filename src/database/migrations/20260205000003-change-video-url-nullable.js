'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change video_url to allow NULL (vì chưa upload thì chưa có URL)
    await queryInterface.changeColumn('uploaded_videos', 'video_url', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'YouTube video URL after upload'
    });

    console.log('✅ Changed video_url to allow NULL');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to NOT NULL
    await queryInterface.changeColumn('uploaded_videos', 'video_url', {
      type: Sequelize.STRING,
      allowNull: false,
      comment: 'YouTube video URL after upload'
    });

    console.log('✅ Reverted video_url to NOT NULL');
  }
};
