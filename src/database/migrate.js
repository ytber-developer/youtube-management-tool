require('dotenv').config();
const { runMigrations } = require('../services/migrate.service');

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
