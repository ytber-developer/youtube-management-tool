/**
 * Security middleware cho API chạy cục bộ.
 *
 * API không có đăng nhập, nên phải đảm bảo chỉ frontend của tool trên CHÍNH
 * máy này gọi được:
 *  - CORS chỉ cho phép origin localhost / 127.0.0.1 (cộng thêm CORS_ORIGINS)
 *  - Chặn request ghi dữ liệu (POST/PUT/PATCH/DELETE) gửi từ trang web khác:
 *    trình duyệt luôn gửi header Origin cho request cross-origin, nên một trang
 *    web lạ bạn đang mở không thể âm thầm gọi API (xoá account, chạy git pull...)
 *  - requireLoopback: endpoint nguy hiểm chỉ nhận request từ chính máy này
 */

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function extraOrigins() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // không phải request từ trình duyệt (curl, server nội bộ)
  return LOCAL_ORIGIN.test(origin) || extraOrigins().includes(origin.replace(/\/$/, ''));
}

/** Options cho package `cors` */
const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin))
};

/** Chặn request ghi dữ liệu đến từ origin lạ (chống CSRF) */
function blockForeignOrigins(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    console.warn(`🛡️  Chặn ${req.method} ${req.originalUrl} từ origin lạ: ${origin}`);
    return res.status(403).json({ success: false, message: `Origin không được phép: ${origin}` });
  }
  next();
}

function isLoopbackAddress(addr) {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

/** Chỉ cho phép request từ chính máy đang chạy tool */
function requireLoopback(req, res, next) {
  const addr = req.socket && req.socket.remoteAddress;
  if (!isLoopbackAddress(addr)) {
    console.warn(`🛡️  Chặn ${req.method} ${req.originalUrl} từ ${addr} (chỉ cho phép từ máy này)`);
    return res.status(403).json({ success: false, message: 'Chức năng này chỉ dùng được trên chính máy chạy tool' });
  }
  next();
}

module.exports = { corsOptions, blockForeignOrigins, requireLoopback, isAllowedOrigin };
