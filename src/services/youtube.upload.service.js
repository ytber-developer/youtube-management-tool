const browserService = require('./browser.service');
const googleAuthService = require('./google.auth.service');
const VideoDownloadService = require('./video.download.service');
const { AccountYoutube, UploadedVideo } = require('../models');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import helper services
const uiHelper = require('./youtube/youtube.upload.ui.service');
const formHelper = require('./youtube/youtube.upload.form.service');
const visibilityHelper = require('./youtube/youtube.upload.visibility.service');
const publishHelper = require('./youtube/youtube.upload.publish.service');

// Create singleton instance of VideoDownloadService
const videoDownloadService = new VideoDownloadService();

/**
 * Main YouTube Upload Service
 * Orchestrator - điều phối các helper services
 */
class YoutubeUploadService {

  /**
   * Upload video lên YouTube
   * @param {string} email - Email account YouTube
   * @param {string} videoPath - Đường dẫn file video
   * @param {object} videoDetails - Thông tin video
   * @param {object} options - Upload options
   * @returns {Promise<object>} - Kết quả upload
   */
  async uploadVideo(email, videoPath, videoDetails = {}, options = {}) {
    const {
      title = 'Untitled Video',
      description = '',
      visibility = 'public',
      tags = [],
      scheduleDate = null
    } = videoDetails;

    const {
      closeBrowser = false  // Nếu true: đóng browser sau upload, nếu false: giữ browser mở để reuse
    } = options;

    let browser = null;
    let page = null;
    let result = null;

    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📤 BẮT ĐẦU UPLOAD VIDEO LÊN YOUTUBE`);
      console.log(`📧 Account: ${email}`);
      console.log(`📁 File: ${videoPath}`);
      console.log(`${'='.repeat(50)}\n`);

      // Kiểm tra file tồn tại
      if (!fs.existsSync(videoPath)) {
        throw new Error(`File không tồn tại: ${videoPath}`);
      }

      // Lấy thông tin account từ DB
      const account = await AccountYoutube.findOne({ where: { email } });
      if (!account) {
        throw new Error(`Không tìm thấy account: ${email}`);
      }

      // BƯỚC 1: Khởi động browser
      console.log('⏳ Đang chuẩn bị browser...');
      const launchResult = await browserService.launchBrowser(
        false,      // headless = false (visible)
        email,      // email
        3,          // retries = 3
        true        // reuseIfOpen = true
      );
      
      browser = launchResult.browser;
      page = launchResult.page;
      const isNewBrowser = launchResult.isNewBrowser;

      if (isNewBrowser) {
        console.log('🆕 Launched new browser');
      } else {
        console.log('♻️  Reused existing browser tab');
      }

      // BƯỚC 2: Truy cập YouTube Studio và kiểm tra đăng nhập
      console.log('🎬 Đang truy cập YouTube Studio...');
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      await new Promise(r => setTimeout(r, 3000));

      // Check xem có bị redirect về login page không
      const currentUrl = page.url();
      const needsLogin = currentUrl.includes('accounts.google.com') || 
                        currentUrl.includes('signin') ||
                        currentUrl.includes('ServiceLogin');

      if (needsLogin) {
        console.log('🔐 Session expired hoặc chưa login, đang đăng nhập...');
        // Đăng nhập Google
        await googleAuthService.login(page, email, account.password);
        
        // Sau khi login xong, quay lại YouTube Studio
        console.log('🎬 Quay lại YouTube Studio...');
        await page.goto('https://studio.youtube.com', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log('✅ Đã đăng nhập (session còn hiệu lực), bỏ qua login');
      }

      // BƯỚC 3: Dismiss popups (nếu có)
      await uiHelper.dismissPermissionsPopup(page);

      // BƯỚC 4: Mở dialog upload
      console.log('📤 Đang mở dialog upload...');
      await uiHelper.clickCreateButton(page);

      // BƯỚC 5: Upload file
      console.log('📁 Đang upload file video...');
      await uiHelper.selectVideoFile(page, videoPath);

      // BƯỚC 6: Đợi upload và form sẵn sàng
      console.log('⏳ Đang đợi upload và xử lý video...');
      await uiHelper.waitForVideoProcessing(page);

      // BƯỚC 7: Nhập thông tin video
      console.log('📝 Đang nhập thông tin video...');
      await formHelper.fillVideoDetails(page, { title, description, tags });

      // BƯỚC 8: Thiết lập visibility
      console.log('🔒 Đang thiết lập visibility...');
      const visibilityResult = await visibilityHelper.setVisibility(page, visibility, scheduleDate);
      
      if (!visibilityResult.success) {
        throw new Error(visibilityResult.error || 'Failed to set visibility');
      }

      // BƯỚC 9: Publish video
      console.log('🚀 Đang publish video...');
      const publishResult = await publishHelper.publishVideo(page);
      
      if (!publishResult.success) {
        throw new Error(publishResult.error || 'Failed to publish video');
      }

      const videoUrl = publishResult.videoUrl || 'Processing...';
      if (publishResult.videoUrl) {
        console.log(`✅ Video URL: ${videoUrl}`);
      } else {
        console.log(`⚠️ Video đã publish nhưng URL chưa sẵn sàng (video đang processing)`);
      }

      // BƯỚC 10: Đóng tab hoặc browser
      if (closeBrowser) {
        // Đóng toàn bộ browser
        await browser.close();
        console.log('🗑️  Closed browser completely');
      } else {
        // KEEP PAGE OPEN for reuse: navigate away instead of closing the tab.
        // Closing the page may cause the service to close the entire browser if it was the last tracked tab.
        try {
          await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          console.log('♻️  Kept upload tab open and navigated back to Studio for reuse');
        } catch (navErr) {
          // Fallback: just do nothing and keep the page instance alive
          console.log('⚠️ Could not navigate back to Studio, keeping tab open for reuse');
        }
      }

      result = {
        success: true,
        message: publishResult.videoUrl ? 'Upload thành công' : 'Upload thành công (URL đang processing)',
        data: {
          videoUrl,
          title,
          visibility,
          scheduleDate
        }
      };

    } catch (error) {
      console.error(`\n❌ LỖI UPLOAD: ${error.message}`);
      
      // Chụp screenshot nếu có page
      if (page) {
        try {
          const screenshotPath = path.join(__dirname, '../../uploads', `error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`📸 Đã lưu screenshot: ${screenshotPath}`);
        } catch (screenshotError) {
          console.error('Không thể chụp screenshot:', screenshotError.message);
        }
      }

      result = {
        success: false,
        message: 'Upload thất bại',
        error: error.message
      };

      // Đóng browser nếu có lỗi hoặc theo option
      if (browser && page) {
        try {
          if (closeBrowser) {
            await browser.close();
            console.log('🗑️  Closed browser after error');
          } else {
            // On error, keep the page open for reuse instead of closing it.
            try {
              await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
              console.log('♻️  Kept tab open after error for reuse');
            } catch (navErr) {
              console.log('⚠️ Could not navigate after error, leaving tab open');
            }
          }
        } catch (e) {
          console.error('Error closing browser/page:', e.message);
        }
      }
    }

    return result;
  }

  /**
   * Download video từ URL và upload lên YouTube
   * @param {string} email - Email account YouTube
   * @param {string} sourceUrl - URL video cần tải (Facebook, TikTok, etc.)
   * @param {object} videoDetails - Thông tin video
   * @returns {Promise<object>} - Kết quả
   */
  async downloadAndUpload(email, sourceUrl, videoDetails = {}) {
    const {
      title,
      description,
      visibility = 'public',
      tags = [],
      scheduleDate = null
    } = videoDetails;

    let queueRecord = null;
    let videoPath = null;
    let skipDownload = false;

    try {
      console.log('\n' + '#'.repeat(60));
      console.log('🎬 DOWNLOAD & UPLOAD FLOW');
      console.log(`📧 Account: ${email}`);
      console.log(`🔗 Source: ${sourceUrl}`);
      console.log('#'.repeat(60) + '\n');

      // Lấy thông tin account từ DB
      const account = await AccountYoutube.findOne({ where: { email } });
      if (!account) {
        throw new Error(`Không tìm thấy account: ${email}`);
      }

      // BƯỚC 0: Tạo record trong DB với status pending
      console.log('\n📝 BƯỚC 0: TẠO RECORD TRONG DB...\n');

      // Tạo hash của source URL để tránh duplicate
      const sourceUrlHash = crypto.createHash('sha256').update(sourceUrl).digest('hex');

      // Kiểm tra xem đã có record cho URL này chưa
      let existingRecord = await UploadedVideo.findOne({
        where: {
          account_youtube_id: account.id,
          source_url_hash: sourceUrlHash
        }
      });

      if (existingRecord) {
        // Nếu đã completed, skip
        if (existingRecord.status === 'completed') {
          console.log('⚠️  Video này đã được upload trước đó, skip!');
          console.log(`   YouTube URL: ${existingRecord.video_url}`);
          return {
            success: true,
            message: 'Video đã được upload trước đó',
            data: {
              videoUrl: existingRecord.video_url,
              title: existingRecord.title,
              skippedDuplicate: true
            }
          };
        }

        // Nếu failed/pending, retry
        console.log(`⚠️  Tìm thấy record cũ (status: ${existingRecord.status}), sẽ retry...`);
        queueRecord = existingRecord;
      } else {
        // Tạo record mới
        queueRecord = await UploadedVideo.create({
          account_youtube_id: account.id,
          email: email,
          source_url: sourceUrl,
          source_url_hash: sourceUrlHash,
          title: title,
          video_description: description,
          video_visibility: visibility,
          schedule_date: scheduleDate,
          status: 'pending',
          download_attempts: 0,
          upload_attempts: 0
        });
        console.log(`✅ Đã tạo queue record #${queueRecord.id}`);
      }

      // BƯỚC 1: Kiểm tra file đã tồn tại chưa
      console.log('\n📝 BƯỚC 1: KIỂM TRA FILE...\n');

      // Tạo folder download cho account nếu chưa có
      const sanitizedEmail = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const expectedFolder = path.join(
        __dirname,
        '../../downloads',
        sanitizedEmail,
        'video'
      );

      // QUAN TRỌNG: Chỉ reuse file nếu:
      // 1. DB có local_file_path (đã download cho URL này)
      // 2. File đó vẫn tồn tại
      // 3. URL hiện tại match với URL đã download (queueRecord.source_url === sourceUrl)
      
      if (queueRecord.local_file_path && fs.existsSync(queueRecord.local_file_path)) {
        const stats = fs.statSync(queueRecord.local_file_path);
        if (stats.size > 1024 * 1024) {
          videoPath = queueRecord.local_file_path;
          skipDownload = true;
          console.log(`✅ File đã tồn tại (từ DB): ${videoPath}`);
          console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`   Source URL match: ${queueRecord.source_url === sourceUrl}`);
        } else {
          console.log(`⚠️ File quá nhỏ (< 1MB), sẽ download lại`);
        }
      } else {
        console.log('ℹ️  Không tìm thấy file từ DB, sẽ download mới');
      }

      // KHÔNG scan folder tìm video ngẫu nhiên!
      // (đã xóa logic scan folder để tránh dùng nhầm video cũ)

      // BƯỚC 2: Download video (nếu chưa có)
      let actualTitle = videoDetails.title || 'Untitled';
      let actualDescription = videoDetails.description || '';

      if (!skipDownload) {
        console.log('\n📥 BƯỚC 2: TẢI VIDEO...\n');

        await queueRecord.update({
          status: 'downloading',
          download_attempts: queueRecord.download_attempts + 1
        });

        // Tạo instance mới với email để download vào folder riêng
        const emailBasedDownloadService = new VideoDownloadService(sanitizedEmail);
        const downloadResult = await emailBasedDownloadService.downloadVideo(sourceUrl);

        if (!downloadResult.success) {
          await queueRecord.update({
            status: 'failed',
            error_message: `Download failed: ${downloadResult.message}`
          });
          throw new Error(`Download failed: ${downloadResult.message}`);
        }

        videoPath = downloadResult.data.filePath;

        // Update DB với thông tin download
        actualTitle = videoDetails.title || downloadResult.data.title || 'Untitled';
        actualDescription = videoDetails.description || downloadResult.data.description || '';

        await queueRecord.update({
          local_file_path: videoPath,
          title: actualTitle,
          video_description: actualDescription,
          status: 'downloaded',
          downloaded_at: new Date()
        });

        console.log(`✅ Download thành công: ${videoPath}`);
        console.log(`📝 Title: ${actualTitle}`);
      } else {
        console.log('⏭️  Bỏ qua download, sử dụng file có sẵn');

        // Nếu skip download, lấy title/description từ DB (nếu có)
        if (queueRecord.title) {
          actualTitle = queueRecord.title;
        }
        if (queueRecord.video_description) {
          actualDescription = queueRecord.video_description;
        }
      }

      // Sử dụng actualTitle/actualDescription cho upload
      const finalTitle = actualTitle;
      const finalDescription = actualDescription;

      // Đợi 5 giây để browser từ download service đóng hoàn toàn (nếu có)
      if (!skipDownload) {
        console.log('\n⏳ Đợi 5 giây trước khi upload...\n');
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.log('\n⏳ Đợi 2 giây trước khi upload...\n');
        await new Promise(r => setTimeout(r, 2000));
      }

      // BƯỚC 3: Upload lên YouTube
      console.log('\n📤 BƯỚC 3: UPLOAD LÊN YOUTUBE...\n');

      await queueRecord.update({
        status: 'uploading',
        upload_attempts: queueRecord.upload_attempts + 1
      });

      const uploadResult = await this.uploadVideo(email, videoPath, {
        title: finalTitle,
        description: finalDescription,
        visibility: queueRecord.video_visibility,
        tags: videoDetails.tags,
        scheduleDate: queueRecord.schedule_date
      }, {
        closeBrowser: false  // Mặc định giữ browser để upload nhanh hơn cho các video tiếp theo
      });

      // BƯỚC 4: Xử lý kết quả upload
      console.log('\n✅ BƯỚC 4: XỬ LÝ KẾT QUẢ...\n');

      // Lấy video URL (có thể có hoặc không)
      const videoUrl = uploadResult.data?.videoUrl;

      if (!uploadResult.success) {
        // Upload thất bại
        await queueRecord.update({
          status: 'failed',
          error_message: `Upload failed: ${uploadResult.error || uploadResult.message}`
        });
        throw new Error(`Upload failed: ${uploadResult.error || uploadResult.message}`);
      }

      // Upload thành công - lưu kết quả
      await queueRecord.update({
        video_url: videoUrl,  // Sửa từ youtube_url thành video_url (match DB schema)
        status: 'completed',
        uploaded_at: new Date()
      });

      console.log('✅ Đã lưu video URL vào database');
      if (videoUrl && videoUrl !== 'Processing...') {
        console.log(`✅ Video URL: ${videoUrl}`);
      } else {
        console.log('⚠️ Video đang processing, URL sẽ có sau');
      }

      // BƯỚC 5: Xóa file video đã tải về (chỉ khi upload thành công)
      console.log('\n🗑️  BƯỚC 5: XÓA FILE ĐÃ TẢI...\n');
      const deleted = videoDownloadService.deleteDownloadedFile(videoPath);
      if (deleted) {
        console.log('✅ Đã xóa file video khỏi ổ cứng');
        // Update DB để xóa local_file_path (file không còn tồn tại)
        await queueRecord.update({ local_file_path: null });
      }

      return {
        success: true,
        message: 'Download và upload thành công',
        data: {
          queueId: queueRecord.id,
          videoUrl: videoUrl,
          title: finalTitle,
          skippedDownload: skipDownload
        }
      };

    } catch (error) {
      console.error(`\n❌ LỖI: ${error.message}`);

      // Kiểm tra xem video đã upload được chưa (có URL trong DB)
      let videoWasUploaded = false;
      let uploadedUrl = null;

      if (queueRecord) {
        await queueRecord.reload();
        if (queueRecord.video_url && queueRecord.video_url !== 'Processing...') {
          videoWasUploaded = true;
          uploadedUrl = queueRecord.video_url;
          console.log(`⚠️ Lỗi xảy ra NHƯNG video đã được upload thành công!`);
          console.log(`✅ Video URL: ${uploadedUrl}`);

          // Update status thành completed (video đã lên)
          await queueRecord.update({
            status: 'completed',
            error_message: `Completed with warning: ${error.message}`
          }).catch(err => console.error('Failed to update queue record:', err));

          // Xóa file nếu có
          if (videoPath && fs.existsSync(videoPath)) {
            try {
              const deleted = videoDownloadService.deleteDownloadedFile(videoPath);
              if (deleted) {
                console.log('✅ Đã xóa file video (upload đã thành công)');
                await queueRecord.update({ local_file_path: null });
              }
            } catch (deleteError) {
              console.log('⚠️ Không thể xóa file:', deleteError.message);
            }
          }

          return {
            success: true,
            message: 'Upload thành công (có warning nhỏ)',
            data: {
              queueId: queueRecord.id,
              videoUrl: uploadedUrl,
              title: queueRecord.title,
              warning: error.message
            }
          };
        }

        // Video chưa upload được - mark failed
        await queueRecord.update({
          status: 'failed',
          error_message: error.message
        }).catch(err => console.error('Failed to update queue record:', err));
      }

      return {
        success: false,
        message: 'Download và upload thất bại',
        error: error.message
      };
    }
  }
}

module.exports = new YoutubeUploadService();
