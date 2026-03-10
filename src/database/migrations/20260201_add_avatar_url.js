'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('account_youtubes', 'avatar_url', {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Facebook avatar URL to download'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('account_youtubes', 'avatar_url');
  }
};
