const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for video file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Tạo folder riêng cho mỗi account. Tên folder lấy từ input của request nên
    // phải làm sạch: chỉ giữ ký tự an toàn, để "../" hay "C:\..." không thể
    // ghi file ra ngoài uploads/videos (path traversal).
    const baseDir = path.resolve(__dirname, '../../uploads/videos');
    const raw = String(req.body.email || req.body.id || 'default');
    const folder = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 100) || 'default';
    const uploadDir = path.resolve(baseDir, folder);
    if (!uploadDir.startsWith(baseDir + path.sep)) {
      return cb(new Error('Tên thư mục upload không hợp lệ'));
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Giữ nguyên extension gốc
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const uniqueName = `${Date.now()}-${nameWithoutExt}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  },
  fileFilter: (req, file, cb) => {
    // Chấp nhận các format video phổ biến
    const allowedMimes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-flv',
      'video/webm',
      'video/x-matroska'
    ];
    
    const allowedExts = ['.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.flv', '.webm', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Chỉ chấp nhận file video. Format được hỗ trợ: ${allowedExts.join(', ')}`));
    }
  }
});

module.exports = uploadVideo;
