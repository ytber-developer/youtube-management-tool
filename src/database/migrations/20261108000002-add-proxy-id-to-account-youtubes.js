'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('account_youtubes', 'proxy_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Proxy cố định gắn với account (null = không dùng proxy)'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('account_youtubes', 'proxy_id');
  }
};
