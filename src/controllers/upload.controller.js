const youtubeUploadService = require('../services/youtube.upload.service');
const VideoDownloadService = require('../services/video.download.service');
const { AccountYoutube, UploadedVideo } = require('../models');
const { Op } = require('sequelize');

class UploadController {

  /**
   * POST /api/v1/upload/download
   * Tải video từ URL (TikTok, Facebook, etc.) qua taivideo.vn
   */
  async downloadVideo(req, res) {
    try {
      const { videoUrl, quality } = req.body;

      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          message: 'videoUrl là bắt buộc'
        });
      }

      const videoDownloadService = new VideoDownloadService();
      const result = await videoDownloadService.downloadVideo(videoUrl, {
        quality: quality || 'best'
      });

      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('❌ Download controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/upload/youtube
   * Upload video từ file local lên YouTube
   */
  async uploadToYoutube(req, res) {
    try {
      const { id, email, videoPath, title, description, visibility, tags, scheduleDate } = req.body;

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền id hoặc email của account'
        });
      }

      if (!videoPath) {
        return res.status(400).json({
          success: false,
          message: 'videoPath là bắt buộc'
        });
      }

      // Tìm account
      const where = id ? { id } : { email };
      const account = await AccountYoutube.findOne({ where });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy account trong database'
        });
      }

      const result = await youtubeUploadService.uploadVideo(
        account.email,
        videoPath,
        { title, description, visibility, tags, scheduleDate },
        { closeBrowser: req.body.closeBrowser || false } // Có thể truyền từ frontend
      );

      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('❌ Upload controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/upload/download-and-upload
   * Flow hoàn chỉnh: Tải video từ URL -> Upload lên YouTube
   * Hoặc: Upload file video từ client -> Upload lên YouTube
   * 
   * Hỗ trợ 2 cách:
   * 1. Truyền sourceUrl: Tải video từ URL (Facebook, TikTok, etc.)
   * 2. Truyền file qua multipart/form-data: Upload file trực tiếp
   */
  async downloadAndUpload(req, res) {
    try {
      const {
        id,
        email,
        sourceUrl,
        title,
        description,
        visibility,
        tags,
        scheduleDate
      } = req.body;

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền id hoặc email của account'
        });
      }

      // Kiểm tra có file upload không - hỗ trợ cả req.file và req.files
      let uploadedFile = req.file;
      if (!uploadedFile && req.files) {
        // Kiểm tra cả 'video' và 'videoFile' field names
        uploadedFile = req.files.video?.[0] || req.files.videoFile?.[0];
      }
      
      // Phải có ít nhất 1 trong 2: sourceUrl hoặc file
      if (!sourceUrl && !uploadedFile) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền sourceUrl (URL video) hoặc upload file video'
        });
      }

      // Tìm account
      const where = id ? { id } : { email };
      const account = await AccountYoutube.findOne({ where });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy account trong database'
        });
      }

      let result;

      // Trường hợp 1: Upload file từ client
      if (uploadedFile) {
        console.log(`\n📤 Upload file từ client: ${uploadedFile.originalname}`);
        
        // Lấy tên file gốc làm title mặc định (bỏ đuôi .mp4, .mov, etc.)
        const defaultTitle = title || uploadedFile.originalname.replace(/\.[^/.]+$/, '');
        
        result = await youtubeUploadService.uploadVideo(
          account.email,
          uploadedFile.path,
          { 
            title: defaultTitle, 
            description, 
            visibility, 
            tags, 
            scheduleDate 
          },
          { closeBrowser: req.body.closeBrowser || false }
        );

        // Xóa file đã upload sau khi hoàn tất (thành công hay thất bại)
        try {
          const fs = require('fs');
          if (fs.existsSync(uploadedFile.path)) {
            fs.unlinkSync(uploadedFile.path);
            console.log(`🗑️  Đã xóa file upload: ${uploadedFile.filename}`);
          }
        } catch (err) {
          console.error(`⚠️  Không thể xóa file upload: ${err.message}`);
        }

        // Lưu vào database nếu thành công
        if (result.success && result.data?.videoUrl) {
          await UploadedVideo.create({
            account_youtube_id: account.id,
            email: account.email,
            video_url: result.data.videoUrl,
            title: title || uploadedFile.originalname,
            source_url: 'uploaded-file'
          });
        }
      } 
      // Trường hợp 2: Tải từ URL
      else {
        result = await youtubeUploadService.downloadAndUpload(
          account.email,
          sourceUrl,
          { title, description, visibility, tags, scheduleDate }
        );
      }

      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('❌ Download and upload controller error:', error);
      
      // Xóa file nếu có lỗi - hỗ trợ cả req.file và req.files
      let fileToDelete = req.file;
      if (!fileToDelete && req.files) {
        fileToDelete = req.files.video?.[0] || req.files.videoFile?.[0];
      }
      
      if (fileToDelete) {
        try {
          const fs = require('fs');
          if (fs.existsSync(fileToDelete.path)) {
            fs.unlinkSync(fileToDelete.path);
          }
        } catch (err) {
          console.error(`⚠️  Không thể xóa file: ${err.message}`);
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/upload/batch-upload
   * Upload nhiều video cùng lúc (tối đa 15 videos)
   * Strategy: Download all videos in parallel FIRST, then upload sequentially
   * Body: {
   *   id: number,
   *   videos: [{sourceUrl, title?, description?, visibility?, tags?, scheduleDate?}]
   * }
   */
  async batchUpload(req, res) {
    try {
      const { id, email, videos } = req.body;

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền id hoặc email của account'
        });
      }

      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền mảng videos (tối thiểu 1 video)'
        });
      }

      if (videos.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'Tối đa 15 videos mỗi lần upload'
        });
      }

      // Validate each video has sourceUrl
      for (let i = 0; i < videos.length; i++) {
        if (!videos[i].sourceUrl) {
          return res.status(400).json({
            success: false,
            message: `Video ${i + 1}: sourceUrl là bắt buộc`
          });
        }
      }

      // Tìm account
      const where = id ? { id } : { email };
      const account = await AccountYoutube.findOne({ where });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy account trong database'
        });
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 BATCH UPLOAD - ${videos.length} VIDEOS`);
      console.log(`📧 Account: ${account.email}`);
      console.log(`${'='.repeat(60)}\n`);

      const VideoDownloadService = require('../services/video.download.service');
      const youtubeUploadService = require('../services/youtube.upload.service');

      // ========== PHASE 1: DOWNLOAD ALL VIDEOS IN PARALLEL ==========
      console.log(`\n📥 PHASE 1: DOWNLOADING ${videos.length} VIDEOS IN PARALLEL...`);
      console.log(`⏱️  Start time: ${new Date().toLocaleString()}\n`);

      const downloadPromises = videos.map(async (video, index) => {
        const videoNum = index + 1;
        console.log(`   [${videoNum}/${videos.length}] Starting download: ${video.sourceUrl}`);

        try {
          // Create separate download service instance for each video (separate email folder)
          const downloadService = new VideoDownloadService(`${account.email}-${videoNum}`);
          const downloadResult = await downloadService.downloadVideo(video.sourceUrl);

          if (!downloadResult.success) {
            console.log(`   ❌ [${videoNum}/${videos.length}] Download failed: ${downloadResult.message}`);
            return {
              index: videoNum,
              sourceUrl: video.sourceUrl,
              success: false,
              phase: 'download',
              message: downloadResult.message,
              error: downloadResult.error,
              videoDetails: video
            };
          }

          console.log(`   ✅ [${videoNum}/${videos.length}] Download complete: ${downloadResult.data.filePath}`);

          return {
            index: videoNum,
            sourceUrl: video.sourceUrl,
            success: true,
            phase: 'download',
            filePath: downloadResult.data.filePath,
            title: video.title || downloadResult.data.title,
            description: video.description || downloadResult.data.description,
            videoDetails: video,
            downloadService // Keep reference to delete file later
          };

        } catch (error) {
          console.error(`   ❌ [${videoNum}/${videos.length}] Download error:`, error.message);
          return {
            index: videoNum,
            sourceUrl: video.sourceUrl,
            success: false,
            phase: 'download',
            message: 'Download failed',
            error: error.message,
            videoDetails: video
          };
        }
      });

      // Wait for all downloads to complete
      const downloadResults = await Promise.all(downloadPromises);

      const downloadSuccess = downloadResults.filter(r => r.success).length;
      const downloadFailed = downloadResults.length - downloadSuccess;

      console.log(`\n📊 PHASE 1 COMPLETE:`);
      console.log(`   ✅ Downloaded: ${downloadSuccess}/${videos.length}`);
      console.log(`   ❌ Failed: ${downloadFailed}/${videos.length}`);
      console.log(`   ⏱️  End time: ${new Date().toLocaleString()}\n`);

      // If no downloads succeeded, return early
      if (downloadSuccess === 0) {
        return res.json({
          success: false,
          message: 'All downloads failed',
          data: {
            total: videos.length,
            downloaded: 0,
            uploaded: 0,
            failed: videos.length,
            results: downloadResults.map(r => ({
              index: r.index,
              sourceUrl: r.sourceUrl,
              success: false,
              message: r.message || 'Download failed',
              error: r.error
            }))
          }
        });
      }

      // ========== PHASE 2: UPLOAD ALL VIDEOS SEQUENTIALLY ==========
      console.log(`\n📤 PHASE 2: UPLOADING ${downloadSuccess} VIDEOS SEQUENTIALLY...`);
      console.log(`⏱️  Start time: ${new Date().toLocaleString()}\n`);

      const finalResults = [];

      for (const downloadResult of downloadResults) {
        if (!downloadResult.success) {
          // Download failed, add to final results
          finalResults.push({
            index: downloadResult.index,
            sourceUrl: downloadResult.sourceUrl,
            success: false,
            message: downloadResult.message || 'Download failed',
            error: downloadResult.error
          });
          continue;
        }

        const videoNum = downloadResult.index;
        console.log(`\n   [${videoNum}/${videos.length}] Uploading to YouTube: ${downloadResult.filePath}`);

        try {
          // Determine title: prefer user-provided title in videos[].title, then download metadata
          const uploadTitle = downloadResult.title || (downloadResult.videoDetails && downloadResult.videoDetails.title) || 'Untitled';

          // Upload video to YouTube
          const uploadResult = await youtubeUploadService.uploadVideo(
            account.email,
            downloadResult.filePath,
            {
              title: uploadTitle,
              description: downloadResult.description,
              visibility: downloadResult.videoDetails.visibility || 'public',
              tags: downloadResult.videoDetails.tags,
              scheduleDate: downloadResult.videoDetails.scheduleDate
            }
          );

          finalResults.push({
            index: videoNum,
            sourceUrl: downloadResult.sourceUrl,
            success: uploadResult.success,
            message: uploadResult.message,
            videoUrl: uploadResult.data?.videoUrl,
            error: uploadResult.error,
            title: uploadTitle
          });

          if (uploadResult.success) {
            console.log(`   ✅ [${videoNum}/${videos.length}] Upload success: ${uploadResult.data?.videoUrl}`);
            
            // Persist uploaded video record in DB
            try {
              await UploadedVideo.create({
                account_youtube_id: account.id,
                email: account.email,
                video_url: uploadResult.data?.videoUrl,
                title: uploadTitle,
                source_url: downloadResult.sourceUrl
              });
            } catch (dbErr) {
              console.warn(`⚠️  Failed to save UploadedVideo record: ${dbErr.message}`);
            }
            
            // Delete downloaded file after successful upload
            if (downloadResult.downloadService) {
              const deleted = downloadResult.downloadService.deleteDownloadedFile(downloadResult.filePath);
              if (deleted) {
                console.log(`   🗑️  [${videoNum}/${videos.length}] Deleted local file`);
              }
            }
          } else {
            console.log(`   ❌ [${videoNum}/${videos.length}] Upload failed: ${uploadResult.message}`);
          }

          // Delay giữa các upload để tránh spam YouTube
          if (videoNum < downloadResults.filter(r => r.success).length) {
            console.log(`   ⏳ Waiting 3s before next upload...`);
            await new Promise(r => setTimeout(r, 3000));
          }

        } catch (error) {
          console.error(`   ❌ [${videoNum}/${videos.length}] Upload error:`, error.message);
          finalResults.push({
            index: videoNum,
            sourceUrl: downloadResult.sourceUrl,
            success: false,
            message: 'Upload failed',
            error: error.message
          });

          // Still delete the file even if upload failed
          if (downloadResult.downloadService) {
            downloadResult.downloadService.deleteDownloadedFile(downloadResult.filePath);
          }
        }
      }

      const uploadSuccess = finalResults.filter(r => r.success).length;
      const uploadFailed = finalResults.length - uploadSuccess;

      console.log(`\n📊 PHASE 2 COMPLETE:`);
      console.log(`   ✅ Uploaded: ${uploadSuccess}/${videos.length}`);
      console.log(`   ❌ Failed: ${uploadFailed}/${videos.length}`);
      console.log(`   ⏱️  End time: ${new Date().toLocaleString()}`);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 BATCH UPLOAD COMPLETE: ${uploadSuccess}/${videos.length} SUCCESS`);
      console.log(`${'='.repeat(60)}\n`);

      return res.json({
        success: uploadSuccess > 0,
        message: `Uploaded ${uploadSuccess}/${videos.length} videos successfully`,
        data: {
          total: videos.length,
          downloaded: downloadSuccess,
          uploaded: uploadSuccess,
          failed: uploadFailed,
          results: finalResults,
          summary: {
            total: videos.length,
            success: uploadSuccess,
            failed: uploadFailed
          }
        }
      });

    } catch (error) {
      console.error('❌ Batch upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/upload/batch-upload-files
   * Upload nhiều file video từ máy lên YouTube (tối đa 15 files)
   * Body: FormData with fields:
   *   - id: number (account ID)
   *   - visibility: string (optional)
   *   - scheduleDate: string (optional)
   *   - video_0, video_1, ... video_N: video files
   *   - fileCount: number
   */
  async batchUploadFiles(req, res) {
    try {
      const { id, email, visibility, scheduleDate } = req.body;

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          message: 'Cần truyền id hoặc email của account'
        });
      }

      // req.files is an array when using uploadVideo.array()
      const files = req.files || [];

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy file nào để upload'
        });
      }

      if (files.length > 15) {
        return res.status(400).json({
          success: false,
          message: 'Tối đa 15 files mỗi lần upload'
        });
      }

      // Tìm account
      const where = id ? { id } : { email };
      const account = await AccountYoutube.findOne({ where });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy account trong database'
        });
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 BATCH FILE UPLOAD - ${files.length} FILES`);
      console.log(`📧 Account: ${account.email}`);
      console.log(`${'='.repeat(60)}\n`);

      const youtubeUploadService = require('../services/youtube.upload.service');
      const fs = require('fs');
      
      const finalResults = [];
      let uploadSuccess = 0;
      let uploadFailed = 0;

      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const videoNum = i + 1;
        
        console.log(`\n   [${videoNum}/${files.length}] Uploading file: ${file.originalname}`);

        try {
          // Get title from filename (remove extension)
          const title = file.originalname.replace(/\.[^/.]+$/, '');

          const uploadResult = await youtubeUploadService.uploadVideo(
            account.email,
            file.path,
            {
              title,
              visibility: visibility || 'public',
              scheduleDate: scheduleDate || undefined
            }
          );

          finalResults.push({
            index: videoNum,
            sourceUrl: file.originalname,
            success: uploadResult.success,
            message: uploadResult.message,
            videoUrl: uploadResult.data?.videoUrl,
            error: uploadResult.error
          });

          if (uploadResult.success) {
            console.log(`   ✅ [${videoNum}/${files.length}] Upload success: ${uploadResult.data?.videoUrl}`);
            uploadSuccess++;
          } else {
            console.log(`   ❌ [${videoNum}/${files.length}] Upload failed: ${uploadResult.message}`);
            uploadFailed++;
          }

          // Delete uploaded file
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log(`   🗑️  [${videoNum}/${files.length}] Deleted local file`);
            }
          } catch (err) {
            console.error(`   ⚠️  Failed to delete file: ${err.message}`);
          }

          // Delay giữa các upload
          if (i < files.length - 1) {
            console.log(`   ⏳ Waiting 3s before next upload...`);
            await new Promise(r => setTimeout(r, 3000));
          }

        } catch (error) {
          console.error(`   ❌ [${videoNum}/${files.length}] Upload error:`, error.message);
          uploadFailed++;
          
          finalResults.push({
            index: videoNum,
            sourceUrl: file.originalname,
            success: false,
            message: 'Upload failed',
            error: error.message
          });

          // Still delete the file
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (err) {
            console.error(`   ⚠️  Failed to delete file: ${err.message}`);
          }
        }
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎉 BATCH FILE UPLOAD COMPLETE: ${uploadSuccess}/${files.length} SUCCESS`);
      console.log(`${'='.repeat(60)}\n`);

      return res.json({
        success: uploadSuccess > 0,
        message: `Uploaded ${uploadSuccess}/${files.length} files successfully`,
        data: {
          total: files.length,
          uploaded: uploadSuccess,
          failed: uploadFailed,
          results: finalResults,
          summary: {
            total: files.length,
            success: uploadSuccess,
            failed: uploadFailed
          }
        }
      });

    } catch (error) {
      console.error('❌ Batch file upload error:', error);
      
      // Clean up any uploaded files on error
      if (req.files && Array.isArray(req.files)) {
        const fs = require('fs');
        req.files.forEach(file => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (err) {
            console.error(`Failed to delete file: ${err.message}`);
          }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/upload/downloads
   * Lấy danh sách file đã download
   */
  async getDownloadedFiles(req, res) {
    try {
      const files = videoDownloadService.getDownloadedFiles();

      return res.status(200).json({
        success: true,
        message: `Tìm thấy ${files.length} files`,
        data: files
      });

    } catch (error) {
      console.error('❌ Get downloads error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/upload/videos
   * Lấy danh sách video đã upload lên YouTube
   * @query { page?: number, limit?: number, search?: string }
   */
  async getUploadedVideos(req, res) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause for search
      const whereClause = search
        ? {
            [Op.or]: [
              { email: { [Op.like]: `%${search}%` } },
              { title: { [Op.like]: `%${search}%` } },
              { video_url: { [Op.like]: `%${search}%` } },
              { source_url: { [Op.like]: `%${search}%` } }
            ]
          }
        : {};

      // Query with pagination
      const { count, rows } = await UploadedVideo.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: offset,
        order: [['created_at', 'DESC']], // Use snake_case because model has underscored: true
        include: [
          {
            model: AccountYoutube,
            as: 'account',
            attributes: ['id', 'email', 'channel_name', 'channel_link'],
            required: false
          }
        ]
      });

      return res.status(200).json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('❌ Get uploaded videos error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new UploadController();
