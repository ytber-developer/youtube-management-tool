require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../models');

async function ensureMigrationsTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
  await sequelize.query('INSERT INTO migrations (name) VALUES (?)', {
    replacements: [name]
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
  try {
    console.log('🚀 Running migrations...\n');
    
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations folder found');
      process.exit(0);
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found');
      process.exit(0);
    }

    const executedMigrations = await getExecutedMigrations();
    
    if (process.argv.includes('--fresh')) {
      // Run down for all executed migrations in reverse order
      console.log('🔄 Running fresh migration (dropping all tables)...\n');
      
      for (let i = executedMigrations.length - 1; i >= 0; i--) {
        const migrationName = executedMigrations[i];
        const migrationPath = path.join(migrationsDir, migrationName);
        
        if (fs.existsSync(migrationPath)) {
          console.log(`📝 Rolling back: ${migrationName}`);
          
          // Clear require cache to ensure fresh module load
          delete require.cache[require.resolve(migrationPath)];
          
          const migration = require(migrationPath);
          
          if (migration.down) {
            // Pass both queryInterface and Sequelize (with DataTypes)
            const { DataTypes } = require('sequelize');
            const SequelizeWithDataTypes = { ...DataTypes, QueryTypes: require('sequelize').QueryTypes };
            await migration.down(sequelize.getQueryInterface(), SequelizeWithDataTypes);
            await removeMigrationRecord(migrationName);
            console.log(`✅ Rolled back: ${migrationName}\n`);
          }
        }
      }
      
      // Drop migrations table
      await sequelize.query('DROP TABLE IF EXISTS migrations');
      await ensureMigrationsTable();
    }

    const executedAfterFresh = await getExecutedMigrations();
    const pendingMigrations = migrationFiles.filter(file => !executedAfterFresh.includes(file));

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      process.exit(0);
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);

    for (const file of pendingMigrations) {
      console.log(`📝 Running: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      
      // Clear require cache to ensure fresh module load
      delete require.cache[require.resolve(migrationPath)];
      
      const migration = require(migrationPath);
      
      // Pass both queryInterface and Sequelize (with DataTypes)
      const { DataTypes } = require('sequelize');
      const SequelizeWithDataTypes = { ...DataTypes, QueryTypes: require('sequelize').QueryTypes };
      await migration.up(sequelize.getQueryInterface(), SequelizeWithDataTypes);
      await recordMigration(file);
      console.log(`✅ Completed: ${file}\n`);
    }
    
    console.log('🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check command line arguments
if (process.argv.includes('--undo')) {
  undoLastMigration();
} else {
  migrate();
}
