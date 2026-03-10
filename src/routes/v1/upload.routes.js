const express = require('express');
const router = express.Router();
const uploadController = require('../../controllers/upload.controller');
const uploadVideo = require('../../middlewares/upload.video');

/**
 * @route POST /api/v1/upload/download
 * @desc Tải video từ URL qua taivideo.vn
 * @body { videoUrl: string, quality?: 'best' | 'hd' | 'sd' }
 */
router.post('/download', uploadController.downloadVideo);

/**
 * @route POST /api/v1/upload/youtube
 * @desc Upload video từ file local lên YouTube
 * @body { id?: number, email?: string, videoPath: string, title?: string, description?: string, visibility?: 'public' | 'unlisted' | 'private', tags?: string[], scheduleDate?: string (ISO format: '2024-01-15T10:00:00') }
 */
router.post('/youtube', uploadController.uploadToYoutube);

/**
 * @route POST /api/v1/upload/download-and-upload
 * @desc Flow hoàn chỉnh: Download từ URL -> Upload lên YouTube HOẶC Upload file từ client -> Upload lên YouTube
 * @multipart form-data:
 *   - video OR videoFile: file (optional) - File video upload từ client
 *   - id: number (optional) - ID của account
 *   - email: string (optional) - Email của account (cần id hoặc email)
 *   - sourceUrl: string (optional) - URL video để download (Facebook, TikTok, etc.)
 *   - title: string (optional) - Tiêu đề video
 *   - description: string (optional) - Mô tả video
 *   - visibility: string (optional) - 'public' | 'unlisted' | 'private' (default: 'public')
 *   - tags: string[] (optional) - Tags cho video
 *   - scheduleDate: string (optional) - ISO format: '2024-01-15T10:00:00'
 * @note Phải truyền ít nhất 1 trong 2: sourceUrl hoặc file video
 */
router.post('/download-and-upload', uploadVideo.fields([
  { name: 'video', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 }
]), uploadController.downloadAndUpload);

/**
 * @route GET /api/v1/upload/downloads
 * @desc Lấy danh sách file đã download
 */
router.get('/downloads', uploadController.getDownloadedFiles);

/**
 * @route POST /api/v1/upload/batch-upload
 * @desc Upload nhiều video (tối đa 15) từ URLs cho 1 account
 * @body { 
 *   id?: number, 
 *   email?: string, 
 *   videos: [{ 
 *     sourceUrl: string, 
 *     title?: string, 
 *     description?: string, 
 *     visibility?: 'public' | 'unlisted' | 'private', 
 *     tags?: string[], 
 *     scheduleDate?: string 
 *   }] 
 * }
 */
router.post('/batch-upload', uploadController.batchUpload);

/**
 * @route POST /api/v1/upload/batch-upload-files
 * @desc Upload nhiều file video từ máy (tối đa 15) cho 1 account
 * @multipart form-data:
 *   - id: number - ID của account
 *   - visibility: string (optional) - 'public' | 'unlisted' | 'private'
 *   - scheduleDate: string (optional) - ISO format
 *   - video_0, video_1, ..., video_N: video files
 *   - fileCount: number - Số lượng files
 */
router.post('/batch-upload-files', uploadVideo.array('video', 15), uploadController.batchUploadFiles);

/**
 * @route GET /api/v1/upload/videos
 * @desc Lấy danh sách video đã upload lên YouTube
 * @query { page?: number, limit?: number, search?: string }
 */
router.get('/videos', uploadController.getUploadedVideos);

module.exports = router;
