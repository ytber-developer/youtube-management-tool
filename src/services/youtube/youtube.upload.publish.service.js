/**
 * Service xử lý publish/schedule video và lấy video URL
 */
class YoutubeUploadPublishService {
  /**
   * Schedule video và lấy URL (thay vì publish ngay)
   */
  async scheduleVideo(page) {
    // Đợi video processing
    console.log('⏳ Đang đợi video processing...');

    const maxWaitProcessing = 600000; // 10 phút
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitProcessing) {
      const status = await page.evaluate(() => {
        const processingText = document.body.innerText || '';

        // Kiểm tra lỗi
        const errorMessages = [];
        if (processingText.includes('Processing abandoned')) errorMessages.push('Processing abandoned');
        if (processingText.includes('Video is too long')) errorMessages.push('Video is too long');
        if (processingText.includes('Copyright claim')) errorMessages.push('Copyright claim');
        if (processingText.includes('Upload failed')) errorMessages.push('Upload failed');

        const doneBtn = document.querySelector('#done-button');
        const isDoneEnabled = doneBtn && !doneBtn.hasAttribute('disabled');

        // Detect copyright (English + Vietnamese)
        const lc = processingText.toLowerCase();
        const copyrightDetected = lc.includes('copyright') || lc.includes('copyright-protected') || lc.includes('bản quyền') || lc.includes('nội dung có bản quyền') || lc.includes('phát hiện nội dung');

        return {
          hasError: errorMessages.length > 0,
          errorMessages,
          isDoneEnabled,
          copyrightDetected
        };
      });

      if (status.hasError) {
        const errorMsg = status.errorMessages.join(', ');
        console.error(`❌ YouTube Error: ${errorMsg}`);
        throw new Error(`YouTube upload error: ${errorMsg}`);
      }

      if (status.copyrightDetected) {
        console.error('❌ Copyright-related issue detected during scheduling. Aborting upload.');
        throw new Error('YouTube upload aborted: copyright-related issue detected');
      }

      if (status.isDoneEnabled) {
        console.log('✅ Video sẵn sàng để schedule!');
        break;
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    await new Promise(r => setTimeout(r, 2000));

    // Click nút Schedule (thay vì Publish)
    const scheduleClicked = await page.evaluate(() => {
      const doneBtn = document.querySelector('#done-button');
      if (doneBtn && !doneBtn.hasAttribute('disabled')) {
        doneBtn.click();
        return true;
      }
      return false;
    });

    if (!scheduleClicked) {
      console.log('⚠️ Nút Schedule bị disabled, thử đợi thêm...');
      await new Promise(r => setTimeout(r, 10000));

      await page.evaluate(() => {
        const doneBtn = document.querySelector('#done-button');
        if (doneBtn) doneBtn.click();
      });
    }

    console.log('✅ Đã click Schedule');

    // Đợi dialog xác nhận schedule
    console.log('⏳ Đang đợi xác nhận schedule...');

    const maxWaitSchedule = 60000;
    const scheduleStartTime = Date.now();
    let isScheduled = false;

    while (Date.now() - scheduleStartTime < maxWaitSchedule && !isScheduled) {
      isScheduled = await page.evaluate(() => {
        const pageText = document.body.innerText;
        return pageText.includes('Video scheduled') ||
          pageText.includes('Scheduled') ||
          pageText.includes('will be published') ||
          document.querySelector('ytcp-video-share-dialog') !== null;
      });

      if (!isScheduled) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (isScheduled) {
      console.log('✅ Video đã được schedule!');
    } else {
      console.log('⚠️ Không xác nhận được trạng thái schedule');
    }

    await new Promise(r => setTimeout(r, 3000));

    // Lấy video URL
    console.log('⏳ Đang lấy video URL...');
    const videoUrl = await this.getVideoUrl(page);

    if (videoUrl) {
      console.log(`✅ Đã lấy được video URL: ${videoUrl}`);
      return {
        success: true,
        videoUrl: videoUrl
      };
    } else {
      console.log('⚠️ Không lấy được video URL');
      return {
        success: true,
        videoUrl: null,
        message: 'Video scheduled (URL not immediately available)'
      };
    }
  }

  /**
   * Publish video và lấy URL
   */
  async publishVideo(page) {
    // ─────────────────────────────────────────────────────────────
    // Chờ nút Publish xuất hiện và không bị disabled (tối đa 30 phút)
    // - Video ngắn: upload nhanh, không có %, nút Publish enable ngay
    // - Video dài:  có "Uploading X%", sau đó YouTube xử lý SD rồi mới enable
    // ─────────────────────────────────────────────────────────────
    console.log('⏳ Đang chờ nút Publish sẵn sàng...');
    const maxWait = 30 * 60 * 1000; // 30 phút
    const waitStart = Date.now();

    while (Date.now() - waitStart < maxWait) {
      const status = await page.evaluate(() => {
        const txt = document.body.innerText || '';

        // Kiểm tra lỗi
        const errorMessages = [];
        if (txt.includes('Processing abandoned')) errorMessages.push('Processing abandoned');
        if (txt.includes('Video is too long')) errorMessages.push('Video is too long');
        if (txt.includes('Copyright claim')) errorMessages.push('Copyright claim');
        if (txt.includes('Upload failed')) errorMessages.push('Upload failed');
        if (txt.includes('Video rejected')) errorMessages.push('Video rejected');
        try {
          if (/Checks complete[\s\S]*Copyright-protected content found/i.test(txt))
            errorMessages.push('Copyright-protected content found');
        } catch (e) { /* ignore */ }
        if (txt.includes('Đã tìm thấy nội dung được bảo vệ bản quyền') ||
            txt.includes('Đã phát hiện nội dung được bảo vệ bản quyền') ||
            (txt.includes('Kiểm tra') && txt.includes('bản quyền')))
          errorMessages.push('Copyright-protected content found (vi)');

        // Nút Publish: tìm theo aria-label="Publish" và aria-disabled="false"
        const publishBtn =
          document.querySelector('button[aria-label="Publish"][aria-disabled="false"]') ||
          document.querySelector('#done-button:not([disabled])') ||
          (() => {
            const btn = document.querySelector('#done-button');
            return btn && !btn.hasAttribute('disabled') ? btn : null;
          })();

        const isPublishEnabled = !!publishBtn;

        // Trạng thái đang làm gì
        const isUploading = /Uploading\s+\d+%/i.test(txt) || /Đang tải lên\s+\d+%/i.test(txt);
        const isProcessingSD = txt.includes('standard definition') ||
                               txt.includes('SD version') ||
                               txt.includes('Video processing') ||
                               txt.includes('Đang xử lý');

        const pctMatch = txt.match(/(?:Uploading|Đang tải lên)\s+(\d+%[^\n]*)/i);
        const progressText = pctMatch ? pctMatch[0].trim() : null;

        return { errorMessages, isPublishEnabled, isUploading, isProcessingSD, progressText };
      });

      // Lỗi → throw ngay
      if (status.errorMessages.length > 0) {
        const errorMsg = status.errorMessages.join(', ');
        console.error(`❌ YouTube Error: ${errorMsg}`);
        throw new Error(`YouTube upload error: ${errorMsg}`);
      }

      // Nút Publish xuất hiện → thoát vòng lặp
      if (status.isPublishEnabled) {
        console.log('✅ Nút Publish đã sẵn sàng!');
        break;
      }

      // Log trạng thái hiện tại
      const elapsed = Math.floor((Date.now() - waitStart) / 1000);
      if (status.isUploading) {
        console.log(`📤 ${status.progressText || 'Uploading...'} (${elapsed}s elapsed)`);
      } else if (status.isProcessingSD) {
        console.log(`⚙️  YouTube đang xử lý SD... (${elapsed}s elapsed)`);
      } else {
        console.log(`⏳ Chờ nút Publish... (${elapsed}s elapsed)`);
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    await new Promise(r => setTimeout(r, 1000));

    // Click nút Publish
    console.log('🚀 Đang click nút Publish...');
    const publishClicked = await page.evaluate(() => {
      const btn =
        document.querySelector('button[aria-label="Publish"][aria-disabled="false"]') ||
        document.querySelector('#done-button:not([disabled])') ||
        (() => {
          const b = document.querySelector('#done-button');
          return b && !b.hasAttribute('disabled') ? b : null;
        })();
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!publishClicked) {
      console.log('⚠️ Không click được nút Publish, thử lại sau 5s...');
      await new Promise(r => setTimeout(r, 5000));
      await page.evaluate(() => {
        const btn = document.querySelector('#done-button');
        if (btn) btn.click();
      });
    }

    console.log('✅ Đã click Publish');

    // Post-publish: chờ cho đến khi thấy "Upload complete" hoặc "up to SD" thì click Close
    // - Đang upload:  "Uploading 76% ... 18 seconds left"  → chờ tiếp
    // - Upload xong:  "Upload complete ... Processing will begin shortly" → có thể đóng
    // - Đang SD:      "Processing up to SD ... 3 minutes left" → có thể đóng
    // Tối đa 600s
    console.log('⏳ Chờ sau khi Publish: đợi "Upload complete" hoặc "up to SD" trước khi đóng...');
    const maxCloseWait = 600000; // 600 seconds
    const closeStart = Date.now();
    let closeClicked = false;

    while (Date.now() - closeStart < maxCloseWait) {
      const status = await page.evaluate(() => {
        const txt = (document.body && document.body.innerText) ? document.body.innerText : '';

        // Đang uploading: có "Uploading X%" hoặc "Đang tải lên X%"
        const isUploading = /Uploading\s+\d+\s*%/i.test(txt) || /Đang tải lên\s+\d+\s*%/i.test(txt);

        // Upload xong: "Upload complete"
        const isUploadComplete = /Upload complete/i.test(txt) || /Tải lên hoàn tất/i.test(txt);

        // Đang processing SD: "Processing up to SD" hoặc "up to SD"
        const isProcessingSD = /Processing up to SD/i.test(txt) || /up to SD/i.test(txt) || /Đang xử lý.*SD/i.test(txt);

        // Processing bị delay: "Processing delayed up to a few hours"
        const isProcessingDelayed = /Processing delayed/i.test(txt) || /delayed up to/i.test(txt) || /Xử lý bị trì hoãn/i.test(txt);

        // Có thể đóng khi: upload xong HOẶC đang SD HOẶC processing delayed (không còn % uploading)
        const canClose = !isUploading && (isUploadComplete || isProcessingSD || isProcessingDelayed);

        const pctMatch = txt.match(/Uploading\s+(\d+)\s*%/i) || txt.match(/Đang tải lên\s+(\d+)\s*%/i);
        const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;

        return { isUploading, isUploadComplete, isProcessingSD, isProcessingDelayed, canClose, pct };
      });

      const elapsed = Math.floor((Date.now() - closeStart) / 1000);
      console.log(`   post-publish [${elapsed}s]: uploading=${status.isUploading}(${status.pct ?? '-'}%), uploadComplete=${status.isUploadComplete}, processingSD=${status.isProcessingSD}, processingDelayed=${status.isProcessingDelayed}, canClose=${status.canClose}`);

      if (status.canClose) {
        // Thử click Close
        closeClicked = await page.evaluate(() => {
          const trySelectors = [
            'button[aria-label="Close"]',
            'button[aria-label="Đóng"]',
            'button[title="Close"]',
            'button[title="Đóng"]',
            '#close-button'
          ];
          for (const sel of trySelectors) {
            try {
              const btn = document.querySelector(sel);
              if (btn && !btn.hasAttribute('disabled') && btn.offsetParent !== null) { btn.click(); return true; }
            } catch (e) { /* ignore */ }
          }
          // Fallback: tìm theo text
          const btns = Array.from(document.querySelectorAll('button'));
          for (const b of btns) {
            const t = (b.innerText || '').trim().toLowerCase();
            if ((t === 'close' || t === 'đóng') && !b.hasAttribute('disabled') && b.offsetParent !== null) {
              b.click(); return true;
            }
          }
          return false;
        });

        if (closeClicked) {
          console.log('✅ Clicked Close sau khi upload/processing sẵn sàng');
          break;
        }
        // Nếu chưa tìm thấy nút Close, chờ 3s rồi thử lại
        console.log('   Close button not found yet, retrying in 3s...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      if (status.isUploading) {
        console.log(`   Vẫn đang uploading (${status.pct ?? '?'}%) — chờ 10s...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        // Không rõ trạng thái — chờ ngắn
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!closeClicked) {
      console.log('⚠️ Timeout 600s hoặc không tìm được nút Close — tiếp tục lấy URL');
    }

    // Chờ thêm 1s để UI ổn định trước khi lấy URL
    await new Promise(r => setTimeout(r, 1000));

    // Lấy video URL
    console.log('⏳ Đang lấy video URL...');
    const videoUrl = await this.getVideoUrl(page, { maxAttempts: 10, waitBetweenAttempts: 1500 });

    if (videoUrl) {
      console.log(`✅ Đã lấy được video URL: ${videoUrl}`);
      return {
        success: true,
        videoUrl: videoUrl
      };
    } else {
      console.log('⚠️ Không lấy được video URL - nhưng video có thể đã được publish');
      return {
        success: true,
        videoUrl: null,
        message: 'Video published but URL not immediately available'
      };
    }
  }

  /**
   * Lấy video URL từ trang sau khi publish/schedule
   * @param {object} page - Puppeteer page
   * @param {object} options - { maxAttempts, waitBetweenAttempts }
   */
  async getVideoUrl(page, options = {}) {
    const { maxAttempts = 15, waitBetweenAttempts = 2000 } = options; // Tăng attempts và thời gian chờ
    const maxWaitUrl = maxAttempts * waitBetweenAttempts;
    const urlStartTime = Date.now();
    let videoUrl = null;
    let attempt = 0;

    console.log(`🔍 Bắt đầu tìm video URL (max ${maxAttempts} attempts, ${waitBetweenAttempts}ms between)...`);

    while (Date.now() - urlStartTime < maxWaitUrl && !videoUrl) {
      attempt++;
      
      videoUrl = await page.evaluate(() => {
        // PHƯƠNG PHÁP 1: Tìm <a id="share-url"> - ƯU TIÊN CAO NHẤT
        const shareUrlLink = document.querySelector('#share-url') || 
                            document.querySelector('a#share-url');
        if (shareUrlLink && shareUrlLink.href) {
          // Extract clean YouTube URL
          const href = shareUrlLink.href;
          if (href.includes('youtube.com/watch') || href.includes('youtube.com/shorts')) {
            // Remove feature=share parameter nếu có
            return href.split('?feature=')[0].split('&feature=')[0];
          }
        }

        // PHƯƠNG PHÁP 2: Tìm trong share dialog
        const shareDialog = document.querySelector('ytcp-video-share-dialog');
        if (shareDialog) {
          // Tìm <a> tag với href chứa youtube.com
          const linkEls = shareDialog.querySelectorAll('a[href*="youtube.com"]');
          for (const link of linkEls) {
            if (link.href && (link.href.includes('/watch') || link.href.includes('/shorts'))) {
              return link.href.split('?feature=')[0].split('&feature=')[0];
            }
          }

          // Tìm input chứa URL
          const linkInput = shareDialog.querySelector('input[type="text"]') ||
            shareDialog.querySelector('input[readonly]') ||
            shareDialog.querySelector('tp-yt-paper-input input');

          if (linkInput && linkInput.value && linkInput.value.includes('youtube.com')) {
            return linkInput.value.split('?feature=')[0].split('&feature=')[0];
          }
        }

        // PHƯƠNG PHÁP 3: Tìm trong URL bar (window.location)
        if (window.location.href.includes('youtube.com/watch?v=')) {
          return window.location.href.split('?feature=')[0].split('&feature=')[0];
        }

        // PHƯƠNG PHÁP 4: Tìm video ID trong ytInitialData
        if (window.ytInitialData) {
          try {
            const data = JSON.stringify(window.ytInitialData);
            const videoIdMatch = data.match(/"videoId":"([\w-]{11})"/);
            if (videoIdMatch && videoIdMatch[1]) {
              return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          } catch (e) {
            // Ignore
          }
        }

        // PHƯƠNG PHÁP 5: Tìm trong script tags
        const scriptTags = document.querySelectorAll('script');
        for (const script of scriptTags) {
          const content = script.textContent || '';
          const videoIdMatch = content.match(/"videoId":"([\w-]{11})"/);
          if (videoIdMatch && videoIdMatch[1]) {
            return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
          }
        }

        // PHƯƠNG PHÁP 6: Tìm tất cả links chứa youtube.com/watch
        const allLinks = document.querySelectorAll('a[href*="youtube.com/watch"], a[href*="youtube.com/shorts"]');
        for (const link of allLinks) {
          if (link.href && link.href.match(/youtube\.com\/(watch|shorts)/)) {
            return link.href.split('?feature=')[0].split('&feature=')[0];
          }
        }

        // PHƯƠNG PHÁP 7: Tìm trong toàn bộ page inputs
        const allInputs = document.querySelectorAll('input[readonly], input[type="text"]');
        for (const input of allInputs) {
          if (input.value && input.value.includes('youtube.com/watch')) {
            return input.value.split('?feature=')[0].split('&feature=')[0];
          }
        }

        // PHƯƠNG PHÁP 8: Tìm trong ytcfg
        if (window.ytcfg) {
          try {
            const data = JSON.stringify(window.ytcfg.data_ || {});
            const videoIdMatch = data.match(/"videoId":"([\w-]{11})"/);
            if (videoIdMatch && videoIdMatch[1]) {
              return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          } catch (e) {
            // Ignore
          }
        }

        return null;
      });

      if (!videoUrl) {
        if (attempt % 3 === 0) { // Log mỗi 3 attempts
          console.log(`   🔍 Attempt ${attempt}/${maxAttempts}: Still looking for video URL...`);
        }
        await new Promise(r => setTimeout(r, waitBetweenAttempts));
      } else {
        console.log(`   ✅ Found video URL at attempt ${attempt}: ${videoUrl}`);
        break; // Tìm được rồi thì thoát ngay
      }
    }

    // Fallback 1: Click vào Copy link button để force show URL
    if (!videoUrl) {
      console.log('⚠️ Thử click Copy link button để show URL...');
      try {
        await page.evaluate(() => {
          const copyButton = document.querySelector('button[aria-label*="Copy"]') ||
                            document.querySelector('button[title*="Copy"]') ||
                            Array.from(document.querySelectorAll('button')).find(btn => 
                              btn.textContent.includes('Copy') || btn.textContent.includes('copy')
                            );
          if (copyButton) {
            copyButton.click();
          }
        });
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Try to get URL from clipboard or input again
        videoUrl = await page.evaluate(() => {
          const shareUrlLink = document.querySelector('#share-url');
          if (shareUrlLink && shareUrlLink.href) {
            return shareUrlLink.href.split('?feature=')[0].split('&feature=')[0];
          }
          
          const linkInput = document.querySelector('input[readonly]') ||
                           document.querySelector('input[type="text"]');
          if (linkInput && linkInput.value && linkInput.value.includes('youtube.com')) {
            return linkInput.value.split('?feature=')[0].split('&feature=')[0];
          }
          
          return null;
        });
        
        if (videoUrl) {
          console.log('✅ Lấy được URL sau khi click Copy button');
        }
      } catch (e) {
        console.log('⚠️ Không thể click Copy button:', e.message);
      }
    }

    // Fallback 2: Navigate về Content page để lấy URL
    if (!videoUrl) {
      console.log('⚠️ Thử navigate về Content page để lấy URL...');
      try {
        await page.goto('https://studio.youtube.com/channel/UC/videos', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(r => setTimeout(r, 3000));

        // Tìm video mới nhất (vừa upload)
        videoUrl = await page.evaluate(() => {
          // Tìm video đầu tiên trong list
          const videoLink = document.querySelector('a[href*="/video/"][href*="/edit"]');
          if (videoLink) {
            const href = videoLink.href;
            const videoIdMatch = href.match(/\/video\/([\w-]{11})\//);
            if (videoIdMatch && videoIdMatch[1]) {
              return `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          }
          return null;
        });

        if (videoUrl) {
          console.log('✅ Lấy được URL từ Content page:', videoUrl);
        }
      } catch (e) {
        console.log('⚠️ Không thể navigate về Content page:', e.message);
      }
    }

    return videoUrl;
  }
}

module.exports = new YoutubeUploadPublishService();
