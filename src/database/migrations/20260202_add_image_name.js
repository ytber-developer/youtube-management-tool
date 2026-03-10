const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('account_youtubes', 'image_name', {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Downloaded avatar image filename'
    });
    console.log('✅ Added image_name column');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('account_youtubes', 'image_name');
    console.log('✅ Removed image_name column');
  }
};
