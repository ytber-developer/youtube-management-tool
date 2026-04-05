const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Add watch_duration_minutes to watch_campaigns
    await queryInterface.addColumn('watch_campaigns', 'watch_duration_minutes', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: 'Watch duration per video in minutes'
    });

    // Add actual_duration_seconds to watch_tasks
    await queryInterface.addColumn('watch_tasks', 'actual_duration_seconds', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Actual seconds watched for this task'
    });

    console.log('✅ Added watch_duration_minutes to watch_campaigns');
    console.log('✅ Added actual_duration_seconds to watch_tasks');
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('watch_campaigns', 'watch_duration_minutes');
    await queryInterface.removeColumn('watch_tasks', 'actual_duration_seconds');
  }
};
