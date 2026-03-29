module.exports = {
    up: async (queryInterface) => {
        const dialect = queryInterface.sequelize.getDialect();
        if (dialect === 'sqlite') {
            console.log('⏭️  Skipping charset conversion (not needed for SQLite)');
            return;
        }
        await queryInterface.sequelize.query(`
      ALTER TABLE uploaded_videos
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        await queryInterface.sequelize.query(`
      ALTER TABLE account_youtubes
      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        console.log('✅ Converted tables to utf8mb4 charset (emoji support)');
    },

    down: async (queryInterface) => {
        const dialect = queryInterface.sequelize.getDialect();
        if (dialect === 'sqlite') {
            return;
        }
        await queryInterface.sequelize.query(`
      ALTER TABLE uploaded_videos
      CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci;
    `);
        await queryInterface.sequelize.query(`
      ALTER TABLE account_youtubes
      CONVERT TO CHARACTER SET utf8 COLLATE utf8_general_ci;
    `);
        console.log('✅ Reverted tables to utf8 charset');
    }
};
