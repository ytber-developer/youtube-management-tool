const express = require('express');
const router = express.Router();
const proxyController = require('../../controllers/proxy.controller');

/** @route GET    /api/v1/proxies               Danh sách proxy + account đang dùng */
router.get('/', proxyController.list);

/** @route POST   /api/v1/proxies               Thêm 1 proxy hoặc nhiều proxy ({ lines }) */
router.post('/', proxyController.create);

/** @route POST   /api/v1/proxies/check-all     Kiểm tra tất cả proxy */
router.post('/check-all', proxyController.checkAll);

/** @route POST   /api/v1/proxies/assign        Gán / gỡ proxy cho account ({ accountIds, proxyId }) */
router.post('/assign', proxyController.assign);

/** @route POST   /api/v1/proxies/auto-assign   Tự gán account chưa có proxy ({ maxPerProxy }) */
router.post('/auto-assign', proxyController.autoAssign);

/** @route PUT    /api/v1/proxies/:id           Sửa proxy (mật khẩu trống = giữ nguyên) */
router.put('/:id', proxyController.update);

/** @route DELETE /api/v1/proxies/:id           Xoá proxy (gỡ khỏi account trước) */
router.delete('/:id', proxyController.remove);

/** @route POST   /api/v1/proxies/:id/check     Kiểm tra 1 proxy */
router.post('/:id/check', proxyController.check);

module.exports = router;
