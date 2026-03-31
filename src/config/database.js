const path = require('path');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  dialectModule: require('better-sqlite3'),
  storage: path.join(__dirname, '../../tool_ytb.db'),
  logging: false,
  define: {
    timestamps: true,
    underscored: true
  }
});

module.exports = sequelize;
