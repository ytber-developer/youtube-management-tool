'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('proxies', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      label: { type: Sequelize.STRING(255), allowNull: true },
      protocol: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'http' },
      host: { type: Sequelize.STRING(255), allowNull: false },
      port: { type: Sequelize.INTEGER, allowNull: false },
      username: { type: Sequelize.STRING(255), allowNull: true },
      password: { type: Sequelize.STRING(255), allowNull: true },
      country: { type: Sequelize.STRING(64), allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'unknown' },
      last_ip: { type: Sequelize.STRING(64), allowNull: true },
      last_latency_ms: { type: Sequelize.INTEGER, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      last_checked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('proxies');
  }
};
