const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('account_youtubes', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      index_avatar: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Index of avatar to use'
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      code_authenticators: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '2FA/Authenticator code'
      },
      channel_name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      channel_link: {
        type: DataTypes.STRING,
        allowNull: true
      },
      is_authenticator: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether 2FA is enabled'
      },
      is_create_channel: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether YouTube channel has been created'
      },
      is_upload_avatar: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether avatar has been uploaded'
      },
      folder_avatar: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Avatar folder name used for this account'
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    console.log('✅ Created table: account_youtubes with all columns (including index_avatar)');
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('account_youtubes');
    console.log('✅ Dropped table: account_youtubes');
  }
};
