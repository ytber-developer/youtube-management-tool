const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('account_youtubes', 'recovery_email', {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Recovery email for account'
    });
    console.log('✅ Added recovery_email column');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('account_youtubes', 'recovery_email');
    console.log('✅ Removed recovery_email column');
  }
};
