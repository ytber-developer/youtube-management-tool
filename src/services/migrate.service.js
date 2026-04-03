const path = require('path');
const fs = require('fs');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

const migrationsDir = path.join(__dirname, '../database/migrations');

async function ensureMigrationsTable() {
  await sequelize.getQueryInterface().createTable('migrations', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    executed_at: { type: DataTypes.DATE, allowNull: true }
  }, { ifNotExists: true });
}

async function getExecutedMigrations() {
  try {
    const [results] = await sequelize.query('SELECT name FROM migrations ORDER BY id');
    return results.map(r => r.name);
  } catch (error) {
    return [];
  }
}

async function recordMigration(name) {
  await sequelize.query('INSERT INTO migrations (name, executed_at) VALUES (?, ?)', {
    replacements: [name, new Date().toISOString()]
  });
}

async function runMigrations() {
  await ensureMigrationsTable();

  if (!fs.existsSync(migrationsDir)) {
    return { migrated: [], message: 'No migrations folder found' };
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  const executedMigrations = await getExecutedMigrations();
  const pendingMigrations = migrationFiles.filter(f => !executedMigrations.includes(f));

  if (pendingMigrations.length === 0) {
    return { migrated: [], message: 'Database is up to date' };
  }

  const migrated = [];
  for (const file of pendingMigrations) {
    const migrationPath = path.join(migrationsDir, file);
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);
    await migration.up(sequelize.getQueryInterface(), DataTypes);
    await recordMigration(file);
    migrated.push(file);
  }

  return { migrated, message: `${migrated.length} migration(s) completed successfully` };
}

async function getStatus() {
  try {
    await sequelize.authenticate();
    await ensureMigrationsTable();

    const [executed] = await sequelize.query('SELECT name, executed_at FROM migrations ORDER BY id');

    const migrationFiles = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort()
      : [];

    const executedNames = executed.map(r => r.name);
    const pending = migrationFiles.filter(f => !executedNames.includes(f));

    return {
      connected: true,
      totalMigrations: migrationFiles.length,
      executedMigrations: executed.length,
      pendingMigrations: pending.length,
      migrations: executed
    };
  } catch (err) {
    return { connected: false, totalMigrations: 0, executedMigrations: 0, pendingMigrations: 0, migrations: [] };
  }
}

async function pullSource() {
  const { exec } = require('child_process');
  const rootDir = path.join(__dirname, '../../');

  return new Promise((resolve, reject) => {
    exec('git pull', { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ output: stdout.trim() || stderr.trim(), message: 'Pull source thành công' });
    });
  });
}

module.exports = { runMigrations, getStatus, pullSource };
