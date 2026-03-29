require('dotenv').config();
const { runMigrations } = require('../services/migrate.service');

async function ensureMigrationsTable() {
  try {
    const { DataTypes } = require('sequelize');
    await sequelize.getQueryInterface().createTable('migrations', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      executed_at: { type: DataTypes.DATE, allowNull: true }
    }, { ifNotExists: true });
  } catch (error) {
    console.error('❌ Error creating migrations table:', error.message);
    throw error;
  }
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

async function removeMigrationRecord(name) {
  await sequelize.query('DELETE FROM migrations WHERE name = ?', {
    replacements: [name]
  });
}

async function undoLastMigration() {
  try {
    console.log('🔄 Undoing last migration...\n');
    
    await ensureMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('⚠️  No migrations to undo');
      process.exit(0);
    }
    
    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationPath = path.join(migrationsDir, lastMigration);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`❌ Migration file not found: ${lastMigration}`);
      process.exit(1);
    }
    
    console.log(`📝 Rolling back: ${lastMigration}`);
    
    // Clear require cache to ensure fresh module load
    delete require.cache[require.resolve(migrationPath)];
    
    const migration = require(migrationPath);
    
    if (!migration.down) {
      console.log(`❌ Migration ${lastMigration} does not have a down method`);
      process.exit(1);
    }
    
    // Pass both queryInterface and Sequelize (with DataTypes)
    const { DataTypes } = require('sequelize');
    const SequelizeWithDataTypes = { ...DataTypes, QueryTypes: require('sequelize').QueryTypes };
    await migration.down(sequelize.getQueryInterface(), SequelizeWithDataTypes);
    await removeMigrationRecord(lastMigration);
    console.log(`✅ Successfully rolled back: ${lastMigration}\n`);
    
    console.log('🎉 Undo completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Undo failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function migrate() {
async function main() {
  try {
    console.log('🚀 Running migrations...\n');
    const result = await runMigrations();

    if (result.migrated.length === 0) {
      console.log('✅', result.message);
    } else {
      result.migrated.forEach(f => console.log(`✅ Completed: ${f}`));
      console.log(`\n🎉 ${result.message}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
