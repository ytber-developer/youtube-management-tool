'use strict';

/** Đăng video content (content/<date>/<folder>) qua hàng đợi upload: cần nhớ video nào, thumbnail và tags */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('uploaded_videos', 'content_id', {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: 'ID video content (<date>/<folder>) nếu upload từ trang /content'
    });
    await queryInterface.addColumn('uploaded_videos', 'thumbnail_path', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Ảnh thumbnail tải lên cùng video (tuỳ chọn)'
    });
    await queryInterface.addColumn('uploaded_videos', 'tags', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON mảng tags'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('uploaded_videos', 'content_id');
    await queryInterface.removeColumn('uploaded_videos', 'thumbnail_path');
    await queryInterface.removeColumn('uploaded_videos', 'tags');
  }
};
