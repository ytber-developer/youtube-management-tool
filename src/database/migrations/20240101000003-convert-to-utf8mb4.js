const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface) => {
        // Alter table to use utf8mb4 charset
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
        // Revert to utf8
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
