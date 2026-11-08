const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Proxy = sequelize.define('Proxy', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  label: { type: DataTypes.STRING(255), allowNull: true },
  // http | https | socks5
  protocol: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'http' },
  host: { type: DataTypes.STRING(255), allowNull: false },
  port: { type: DataTypes.INTEGER, allowNull: false },
  username: { type: DataTypes.STRING(255), allowNull: true },
  password: { type: DataTypes.STRING(255), allowNull: true },
  country: { type: DataTypes.STRING(64), allowNull: true },
  // unknown | active | dead
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'unknown' },
  last_ip: { type: DataTypes.STRING(64), allowNull: true },
  last_latency_ms: { type: DataTypes.INTEGER, allowNull: true },
  last_error: { type: DataTypes.TEXT, allowNull: true },
  last_checked_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'proxies',
  timestamps: true
});

module.exports = Proxy;
