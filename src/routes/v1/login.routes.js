const express = require('express');
const router = express.Router();
const loginController = require('../../controllers/login.controller');

/**
 * @route POST /api/v1/login
 * @desc Đăng nhập một account YouTube (lấy từ DB)
 * @body { id?: number, email?: string }
 */
router.post('/', loginController.login);

/**
 * @route POST /api/v1/login/multiple
 * @desc Đăng nhập nhiều accounts từ DB
 * @body { ids?: number[], emails?: string[], concurrentLimit?: number, delayBetween?: number }
 */
router.post('/multiple', loginController.loginMultiple);

/**
 * @route POST /api/v1/login/all
 * @desc Đăng nhập tất cả accounts từ DB (có filter)
 * @body { filter?: object, concurrentLimit?: number, delayBetween?: number }
 */
router.post('/all', loginController.loginAll);

module.exports = router;
