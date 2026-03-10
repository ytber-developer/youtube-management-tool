const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove legacy avatar fields
    await queryInterface.removeColumn('account_youtubes', 'index_avatar');
    await queryInterface.removeColumn('account_youtubes', 'folder_avatar');
    console.log('✅ Removed index_avatar and folder_avatar columns');
  },

  down: async (queryInterface, Sequelize) => {
    // Restore columns if needed (rollback)
    await queryInterface.addColumn('account_youtubes', 'index_avatar', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'index of avatar in the folder_avatar'
    });
    
    await queryInterface.addColumn('account_youtubes', 'folder_avatar', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Avatar folder name used for this account'
    });
    console.log('✅ Restored index_avatar and folder_avatar columns');
  }
};
