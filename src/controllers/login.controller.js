const youtubeLoginService = require('../services/youtube.login.service');
const { AccountYoutube } = require('../models');

class LoginController {

  /**
   * POST /api/v1/login
   * Đăng nhập một account YouTube bằng ID hoặc email (lấy password từ DB)
   */
  async login(req, res) {
    try {
      const { id, email } = req.body;

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền id hoặc email của account'
        });
      }

      // Tìm account trong DB
      const where = id ? { id } : { email };
      const account = await AccountYoutube.findOne({ where });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy account trong database'
        });
      }

      const result = await youtubeLoginService.login(
        account.email,
        account.password,
        { keepBrowserOpen: false }
      );

      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('❌ Login controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/login/multiple
   * Đăng nhập nhiều accounts từ database theo danh sách IDs hoặc emails
   */
  async loginMultiple(req, res) {
    try {
      const { ids, emails, concurrentLimit, delayBetween } = req.body;

      if ((!ids || ids.length === 0) && (!emails || emails.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền danh sách ids hoặc emails'
        });
      }

      // Tìm accounts trong DB
      let accounts;
      if (ids && ids.length > 0) {
        accounts = await AccountYoutube.findAll({
          where: { id: ids },
          attributes: ['email', 'password']
        });
      } else {
        accounts = await AccountYoutube.findAll({
          where: { email: emails },
          attributes: ['email', 'password']
        });
      }

      if (accounts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy accounts trong database'
        });
      }

      const accountList = accounts.map(acc => ({
        email: acc.email,
        password: acc.password
      }));

      const result = await youtubeLoginService.loginMultiple(accountList, {
        concurrentLimit: concurrentLimit || 3,
        delayBetween: delayBetween || 2000
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error('❌ Login multiple controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/login/all
   * Đăng nhập tất cả accounts từ database (có thể filter)
   */
  async loginAll(req, res) {
    try {
      const {
        filter = {},
        concurrentLimit,
        delayBetween
      } = req.body;

      const result = await youtubeLoginService.loginFromDatabase(filter, {
        concurrentLimit: concurrentLimit || 3,
        delayBetween: delayBetween || 2000
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error('❌ Login all controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new LoginController();
