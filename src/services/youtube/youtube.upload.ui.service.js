const path = require('path');

/**
 * Service xử lý các tương tác UI trong quá trình upload YouTube
 * - Dismiss popups
 * - Click Create button
 * - Select video file
 * - Wait for video processing
 */
class YoutubeUploadUiService {
  /**
   * Dismiss permissions popup if it appears
   */
  async dismissPermissionsPopup(page) {
    try {
      await new Promise(r => setTimeout(r, 2000));

      // Try to find and close the permissions dialog
      const closed = await page.evaluate(() => {
        // Look for the Settings dialog with Permissions tab
        const settingsDialog = document.querySelector('ytcp-dialog') || 
                              document.querySelector('tp-yt-paper-dialog[aria-labelledby="dialog-title"]');
        
        if (settingsDialog) {
          // Check if it's the Permissions dialog
          const dialogTitle = settingsDialog.querySelector('#dialog-title');
          const permissionsText = settingsDialog.textContent || '';
          
          if (permissionsText.includes('Permissions') || 
              permissionsText.includes('Settings') ||
              permissionsText.includes('Invite')) {
            
            console.log('Found Permissions/Settings dialog, closing...');
            
            // Try to find close button
            const closeButtons = settingsDialog.querySelectorAll('button, ytcp-button');
            for (const btn of closeButtons) {
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const text = btn.textContent || '';
              
              // Look for close/cancel/dismiss buttons
              if (ariaLabel.toLowerCase().includes('close') ||
                  ariaLabel.toLowerCase().includes('cancel') ||
                  ariaLabel.toLowerCase().includes('dismiss') ||
                  text.toLowerCase().includes('close') ||
                  text.toLowerCase().includes('cancel')) {
                btn.click();
                console.log('Clicked close button on Permissions dialog');
                return true;
              }
            }
            
            // If no close button found, try pressing ESC
            const escEvent = new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true
            });
            document.dispatchEvent(escEvent);
            console.log('Pressed ESC to close dialog');
            return true;
          }
        }
        
        return false;
      });

      if (closed) {
        console.log('✅ Đã đóng popup Permissions');
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log('ℹ️  Không có popup Permissions');
      }
    } catch (error) {
      console.log('⚠️  Lỗi khi đóng popup Permissions:', error.message);
      // Continue anyway, không throw error
    }
  }

  /**
   * Click nút Create để mở dialog upload
   * Thay đổi: ưu tiên navigate trực tiếp tới /upload để bỏ qua UI menu và reuse tab.
   */
  async clickCreateButton(page) {
    console.log('🔍 Ensuring upload UI is open (prefer direct /upload)...');

    // If already on upload page, return early
    try {
      const current = page.url();
      if (current && current.includes('/upload')) {
        console.log('ℹ️ Already on /upload page');
        await page.waitForSelector('input[type="file"]', { timeout: 5000 }).catch(() => {});
        return;
      }
    } catch (e) {
      // ignore
    }

    // Try navigating to Studio root (not /upload) and then open upload via UI
    try {
      await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2', timeout: 15000 });
      // Give UI a moment to stabilize
      await page.waitForTimeout(2000);

      // If the file input is already present on the Studio page, return early
      const fileInputHandle = await page.$('input[type="file"]');
      if (fileInputHandle) {
        console.log('✅ Studio page loaded and file input is present');
        return;
      }

      // Otherwise continue to click flow below to open the upload dialog
    } catch (err) {
      console.log('⚠️ Navigation to Studio root failed, falling back to click flow:', err.message);
      // fallthrough to original click flow
    }

    console.log('🔍 Đang tìm nút Create/Upload (fallback click flow)...');

    // Đợi trang load hoàn toàn
    await new Promise(r => setTimeout(r, 3000));

    // Phương pháp 1: Tìm nút Create bằng nhiều selector
    const createButtonSelectors = [
      '#create-icon',
      'ytcp-button#create-icon',
      '#upload-icon',
      'ytcp-icon-button#create-icon',
      '[aria-label="Create"]',
      '[aria-label="Tạo"]',
      '[aria-label="Upload videos"]',
      '[aria-label="Tải video lên"]',
      'button[aria-label="Create a new video or post"]'
    ];

    let clicked = false;

    // Thử click bằng selector
    for (const selector of createButtonSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`   Tìm thấy nút với selector: ${selector}`);
          await element.click();
          clicked = true;
          console.log('✅ Đã click nút Create');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Phương pháp 2: Tìm bằng evaluate
    if (!clicked) {
      console.log('   Thử tìm bằng evaluate...');
      clicked = await page.evaluate(() => {
        // Tìm nút có icon upload hoặc create
        const buttons = document.querySelectorAll('button, ytcp-button, ytcp-icon-button');
        for (const btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const id = btn.id || '';
          if (ariaLabel.toLowerCase().includes('create') ||
            ariaLabel.toLowerCase().includes('upload') ||
            ariaLabel.toLowerCase().includes('tạo') ||
            ariaLabel.toLowerCase().includes('tải') ||
            id.includes('create') ||
            id.includes('upload')) {
            console.log('Found button:', ariaLabel, id);
            btn.click();
            return true;
          }
        }
        return false;
      });
    }

    if (!clicked) {
      throw new Error('Không tìm thấy nút Create');
    }

    // Đợi để xem YouTube mở gì (dialog hoặc menu)
    await new Promise(r => setTimeout(r, 2000));

    console.log('🔍 Kiểm tra xem dialog upload đã mở chưa...');

    // Kiểm tra xem dialog upload đã mở chưa
    const uploadDialogOpened = await page.evaluate(() => {
      // Tìm dialog upload
      const uploadDialog = document.querySelector('ytcp-uploads-dialog') ||
        document.querySelector('[aria-label="Upload videos"]') ||
        document.querySelector('tp-yt-paper-dialog[aria-label*="Upload"]');

      // Tìm nút "Select files" hoặc input file
      const selectFilesBtn = document.querySelector('ytcp-button#select-files-button') ||
        document.querySelector('input[type="file"]');

      return !!(uploadDialog || selectFilesBtn);
    });

    if (uploadDialogOpened) {
      console.log('✅ Dialog upload đã mở (UI mới - không cần click menu)');
      await new Promise(r => setTimeout(r, 1000));
      return; // Xong, không cần làm gì thêm
    }

    // Nếu dialog chưa mở, có thể là UI cũ có menu dropdown
    console.log('🔍 Dialog chưa mở, đang tìm menu dropdown...');

    let uploadClicked = false;

    // Đợi menu xuất hiện
    await new Promise(r => setTimeout(r, 1000));

    // Thử nhiều cách để click Upload video trong menu
    const uploadSelectors = [
      '#text-item-0',
      'tp-yt-paper-item:first-child',
      'ytcp-text-menu tp-yt-paper-item',
      '[test-id="upload-icon"]',
      'tp-yt-paper-item-body'
    ];

    for (const selector of uploadSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.textContent, element);
          console.log(`   Tìm thấy menu item: "${(text || '').trim()}"`);
          await element.click();
          uploadClicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Thử bằng evaluate nếu chưa click được
    if (!uploadClicked) {
      uploadClicked = await page.evaluate(() => {
        // Tìm trong paper-item
        const items = Array.from(document.querySelectorAll('tp-yt-paper-item, ytcp-ve, [role="menuitem"]'));
        for (const item of items) {
          const text = (item.textContent || '').toLowerCase();
          if (text.includes('upload video') ||
            text.includes('tải video lên') ||
            text.includes('upload') && text.includes('video')) {
            console.log('Found upload item:', text);
            item.click();
            return true;
          }
        }

        // Fallback: click item đầu tiên trong menu
        const firstItem = document.querySelector('tp-yt-paper-item') ||
          document.querySelector('#text-item-0');
        if (firstItem) {
          firstItem.click();
          return true;
        }

        return false;
      });
    }

    if (!uploadClicked) {
      throw new Error('Không tìm thấy menu Upload video và dialog upload cũng chưa mở');
    }

    console.log('✅ Đã click menu Upload video');
    await new Promise(r => setTimeout(r, 3000));
  }

  /**
   * Chọn file video để upload
   */
  async selectVideoFile(page, videoPath) {
    // Tìm input file
    const fileInputSelector = 'input[type="file"]';

    await page.waitForSelector(fileInputSelector, { timeout: 10000 });

    const inputElement = await page.$(fileInputSelector);
    if (!inputElement) {
      throw new Error('Không tìm thấy input file');
    }

    // Upload file
    await inputElement.uploadFile(videoPath);
    console.log('✅ Đã chọn file video');

    await new Promise(r => setTimeout(r, 3000));
  }

  /**
   * Đợi video được xử lý (upload hoàn tất)
   * Cần đợi cả upload VÀ processing hoàn tất
   */
  async waitForVideoProcessing(page) {
    const maxWait = 600000; // 10 phút (tăng lên vì cần đợi processing)
    const startTime = Date.now();

    console.log('⏳ Đang đợi upload và xử lý video...');

    // Giai đoạn 1: Đợi upload hoàn tất (hiển thị form nhập details)
    let uploadComplete = false;
    while (Date.now() - startTime < maxWait && !uploadComplete) {
      const status = await page.evaluate(() => {
        // Kiểm tra đã có form nhập title chưa
        const titleInput = document.querySelector('#title-textarea #textbox') ||
          document.querySelector('#title-textarea') ||
          document.querySelector('[aria-label="Add a title that describes your video"]');
        if (titleInput) {
          return { stage: 'form_ready' };
        }

        // Tìm progress upload
        const progressEl = document.querySelector('.progress-label') ||
          document.querySelector('[class*="progress"]') ||
          document.querySelector('ytcp-video-upload-progress');
        if (progressEl) {
          return { stage: 'uploading', text: progressEl.textContent.trim() };
        }

        return { stage: 'waiting' };
      });

      console.log(`   Upload status: ${status.stage} ${status.text || ''}`);

      if (status.stage === 'form_ready') {
        uploadComplete = true;
        console.log('✅ Upload file hoàn tất, form đã sẵn sàng');
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    if (!uploadComplete) {
      throw new Error('Timeout: Upload video quá lâu');
    }

    // Giai đoạn 2: Đợi thêm một chút để form ổn định
    // YouTube cho phép nhập thông tin ngay khi upload xong, không cần đợi processing hoàn tất
    console.log('⏳ Đợi form ổn định...');
    await new Promise(r => setTimeout(r, 3000));

    console.log('✅ Sẵn sàng nhập thông tin video');
  }

  // New method: sau khi click Publish, chờ cho đến khi không còn chữ "Uploading" hoặc thấy trạng thái "complete" rồi mới click Close
  async clickCloseWhenReady(page, { maxWait = 120000 } = {}) {
    const start = Date.now();
    console.log('⏳ Waiting for post-publish uploading to finish before clicking Close...');
    let attempt = 0;

    while (Date.now() - start < maxWait) {
      attempt++;
      const elapsedSec = Math.floor((Date.now() - start) / 1000);

      const status = await page.evaluate(() => {
        const bodyText = (document.body && document.body.innerText) ? document.body.innerText.toLowerCase() : '';

        const uploading = bodyText.includes('uploading');
        const checksComplete = bodyText.includes('checks complete') || bodyText.includes('checks are complete');

        // Detect common complete/finished indicators
        const uploadComplete = bodyText.includes('upload complete') || bodyText.includes('processing complete') || bodyText.includes('uploaded') || checksComplete || bodyText.includes('upload finished');

        // Detect SD processing (YouTube sometimes shows "up to SD" or "up to sd")
        const processingSD = bodyText.includes('up to sd') || bodyText.includes('up to standard') || bodyText.includes('up to sd quality');

        // Detect processing messages that indicate processing will take longer
        const processingDelayed = bodyText.includes('processing may take') || bodyText.includes('processing could take') || bodyText.includes('may take up to') || bodyText.includes('processing is taking longer') || bodyText.includes('processing might take');

        // Detect fast-publish indicator
        const videoPublished = bodyText.includes('video published') || bodyText.includes('published') && bodyText.includes('video');

        // Percentage match
        const pctMatch = bodyText.match(/(\d{1,3})\s*%/);
        const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;

        return { uploading, uploadComplete, processingSD, processingDelayed, videoPublished, pct };
      });

      const canClose = !!(status.uploadComplete || status.processingSD || status.videoPublished || (status.pct !== null && status.pct >= 99));

      console.log(`   post-publish [${elapsedSec}s]: uploading=${status.uploading}(${status.pct !== null ? status.pct + '%' : '-%'}), uploadComplete=${status.uploadComplete}, processingSD=${status.processingSD}, processingDelayed=${status.processingDelayed}, videoPublished=${status.videoPublished}, canClose=${canClose}`);

      if (status.uploading) {
        // Still uploading; wait a bit but poll faster to catch quick transitions like "Video published"
        await page.waitForTimeout(5000);
        continue;
      }

      if (status.videoPublished || status.uploadComplete || status.processingSD || (status.pct !== null && status.pct >= 99)) {
        // Thử click Close nếu có
        const clicked = await page.evaluate(() => {
          try {
            const candidates = Array.from(document.querySelectorAll('ytcp-button, button, paper-button, ytcp-dialog, ytcp-ui, ytcp-uploads-dialog'));
            for (const btn of candidates) {
              const aria = (btn.getAttribute && (btn.getAttribute('aria-label') || '') || '').toLowerCase();
              const text = (btn.textContent || '').toLowerCase();

              if (aria.includes('close') || text.includes('close') || text.includes('done') || aria.includes('done') || text.includes('ok') || aria.includes('ok')) {
                btn.click();
                return true;
              }
            }

            // Try dialog specific close buttons
            const dialog = document.querySelector('ytcp-dialog') || document.querySelector('tp-yt-paper-dialog') || document.querySelector('ytcp-uploads-dialog');
            if (dialog) {
              // Query multiple possible close selectors
              const closeBtn = dialog.querySelector('button[aria-label*="close"], button[aria-label*="Close"], ytcp-button[aria-label*="Close"], ytcp-button:contains("Done")');
              if (closeBtn) { closeBtn.click(); return true; }

              // Fallback: try any button inside dialog that looks like Done/Close
              const dlgButtons = Array.from(dialog.querySelectorAll('button, ytcp-button'));
              for (const b of dlgButtons) {
                const t = (b.textContent || '').toLowerCase();
                const a = (b.getAttribute && (b.getAttribute('aria-label') || '') || '').toLowerCase();
                if (t.includes('done') || t.includes('close') || a.includes('close') || t.includes('publish') || a.includes('publish')) {
                  b.click();
                  return true;
                }
              }
            }
          } catch (e) {
            // ignore
          }
          return false;
        });

        if (clicked) {
          console.log('✅ Clicked Close after upload/publish state');
          await page.waitForTimeout(1000);
          return true;
        }

        // If video was published but Close button not found, return true to allow flow to proceed (some flows don't require closing)
        if (status.videoPublished) {
          console.log('ℹ️ Video published detected but Close button not found yet; returning success to continue flow');
          return true;
        }

        console.log('⚠️ Close button not found yet despite publish/complete state, waiting 3s and retrying...');
        await page.waitForTimeout(3000);
        continue;
      }

      // If none of the clear states detected, wait a short while and retry
      await page.waitForTimeout(3000);
    }

    console.log('⚠️ Timeout waiting for post-publish upload to finish');
    return false;
  }
}

module.exports = new YoutubeUploadUiService();
