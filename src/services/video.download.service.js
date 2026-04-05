const browserService = require('./browser.service');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class VideoDownloadService {

  constructor(email = null) {
    this.baseDownloadDir = path.join(process.cwd(), 'downloads');
    this.email = email;

    // Nếu có email, tạo folder riêng: downloads/{email}/video
    this.downloadDir = email
      ? path.join(this.baseDownloadDir, email, 'video')
      : this.baseDownloadDir;

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
      console.log(`📁 Tạo folder: ${this.downloadDir}`);
    }
  }

  /**
   * Tải video từ URL (Facebook, Google Drive, etc.)
   */
  async downloadVideo(videoUrl, options = {}) {
    const { quality = 'hd', outputFileName = null } = options;

    // Kiểm tra nếu là Google Drive URL
    const googleDriveService = require('./google.drive.service');
    if (googleDriveService.isGoogleDriveUrl(videoUrl)) {
      console.log(`\n📥 Phát hiện Google Drive URL`);
      return await googleDriveService.downloadFromDrive(videoUrl, this.downloadDir);
    }

    // Nếu không phải Google Drive, tải từ Facebook
    let browser = null;
    let page = null;
    let result = null; // Track if browser is new or reused
    let profileEmail = null;

    try {
      console.log(`\n📥 Tải video từ Facebook`);
      console.log(`   URL: ${videoUrl}`);
      console.log(`   Quality: ${quality}`);
      if (this.email) {
        console.log(`   Account: ${this.email} (may use profile if available)`);
      }

      // Decide which profile to use (allow override via options.profileEmail)
      profileEmail = options.profileEmail ? options.profileEmail : (this.email ? this.email.replace(/-\d+$/, '') : null);

      if (profileEmail) {
        console.log(`   ⚙️ Using browser profile: [${profileEmail}]`);
      } else {
        console.log(`   🆕 Using clean browser (no profile)`);
      }

      // Launch browser WITH profile (reuse if open) or clean browser
      // reuseIfOpen=true to mirror openBrowserWithProfile behaviour
      result = await browserService.launchBrowser(false, profileEmail, 3, true);
      browser = result.browser;
      page = result.page;

      if (result.isNewBrowser) {
        console.log(`   🆕 Launched new browser${profileEmail ? ` with profile [${profileEmail}]` : ' (clean)'}`);
      } else {
        console.log(`   🔄 Reused existing browser for [${profileEmail}]`);
      }

      // Cấu hình download behavior
      const client = await page.target().createCDPSession();
      await client.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadDir,
        eventsEnabled: true
      });

      // BƯỚC 1: Truy cập Facebook trước để lấy title gốc
      console.log('   Đang lấy thông tin video từ Facebook...');
      const videoInfo = await this.extractFacebookInfo(page, videoUrl);
      console.log(`   Tiêu đề: ${videoInfo.title}`);

      // BƯỚC 2: Truy cập fbdown.to để download
      await page.goto('https://fbdown.to/vi', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('#s_input', { visible: true, timeout: 10000 });

      await page.evaluate((url) => {
        const input = document.querySelector('#s_input');
        if (input) {
          input.value = url;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, videoUrl);

      // Click nút tìm video
      await this.clickSearchButton(page);

      // Intercept network responses to catch video stream URLs before they load
      let capturedVideoUrl = null;
      page.on('response', async (response) => {
        const url = response.url();
        try {
          const ct = response.headers()['content-type'] || '';
          if (!capturedVideoUrl && (
            (url.includes('fbcdn.net') && (url.includes('.mp4') || ct.startsWith('video/'))) ||
            ct.startsWith('video/mp4')
          )) {
            capturedVideoUrl = url;
            console.log(`   🎯 Network: captured video URL: ${url.substring(0, 120)}`);
          }
        } catch (e) { /* ignore */ }
      });

      // Đợi kết quả
      await this.waitForResult(page);

      // Chụp screenshot để debug layout hiện tại của fbdown.to
      try {
        await page.screenshot({ path: 'debug-fbdown-result.png', fullPage: true });
        console.log('   📸 Screenshot saved: debug-fbdown-result.png');
      } catch (e) { /* ignore */ }

      // Log tất cả links tìm được để debug
      const allLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 80),
          className: a.className
        })).filter(a => a.href && a.href.startsWith('http'));
      });
      console.log(`   🔗 Links found on page (${allLinks.length}):`);
      allLinks.forEach(l => console.log(`      [${l.className}] ${l.text} → ${l.href.substring(0, 120)}`));

      // Also log buttons for debug
      const allButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent.trim().substring(0, 80),
          className: b.className,
          onclick: (b.getAttribute('onclick') || '').substring(0, 80)
        }));
      });
      console.log(`   🔘 Buttons found on page (${allButtons.length}):`);
      allButtons.forEach(b => console.log(`      [${b.className}] "${b.text}" onclick="${b.onclick}"`));

      let downloadedFile = null;

      // Strategy 1: Check if direct link already visible in DOM
      let directUrl = await this.extractDirectLink(page);
      if (directUrl) {
        console.log(`   ✅ Found direct link in DOM: ${directUrl.substring(0, 100)}`);
        try {
          downloadedFile = await this.downloadWithAxios(directUrl, outputFileName, page);
        } catch (err) {
          console.warn('   ⚠️ Axios download failed:', err.message);
          downloadedFile = null;
        }
      }

      // Strategy 2: Click HD download/render button, then wait for link to appear
      if (!downloadedFile) {
        console.log('   ℹ️ Clicking HD download button to generate link...');
        try {
          await this.clickDownloadButton(page, quality);
          // After clicking, wait for a direct link to appear (Render may take time)
          directUrl = await this.waitForDirectLink(page, 20000);
          if (directUrl) {
            console.log(`   ✅ Direct link appeared after button click: ${directUrl.substring(0, 100)}`);
            downloadedFile = await this.downloadWithAxios(directUrl, outputFileName, page);
          }
        } catch (err) {
          console.warn('   ⚠️ Click+wait for link failed:', err.message);
        }
      }

      // Strategy 3: Use captured network URL from response interception
      if (!downloadedFile && capturedVideoUrl) {
        console.log(`   ℹ️ Using captured network URL: ${capturedVideoUrl.substring(0, 100)}`);
        try {
          downloadedFile = await this.downloadWithAxios(capturedVideoUrl, outputFileName, page);
        } catch (err) {
          console.warn('   ⚠️ Axios download from network URL failed:', err.message);
          downloadedFile = null;
        }
      }

      // Strategy 4: Fallback — wait for Chrome browser to download the file
      if (!downloadedFile) {
        console.log('   ℹ️ Falling back to browser download...');
        downloadedFile = await this.waitForDownload(outputFileName);
      }

      if (!downloadedFile) {
        throw new Error('Download timeout - no video file received');
      }

      console.log(`✅ Tải thành công: ${downloadedFile.fileName} (${downloadedFile.sizeMB} MB)`);

      // Chỉ đóng clean browser; profile browser giữ lại để reuse
      if (!profileEmail) {
        try { await browser.close(); } catch (e) { /* ignore */ }
        console.log('   ✅ Closed clean browser');
      } else {
        console.log('   ℹ️ Profile browser left open for reuse');
      }

      return {
        success: true,
        message: 'Tải video thành công',
        data: {
          originalUrl: videoUrl,
          title: videoInfo.title,
          description: videoInfo.description || videoInfo.title,
          filePath: downloadedFile.filePath,
          fileName: downloadedFile.fileName
        }
      };

    } catch (error) {
      console.error(`❌ Lỗi: ${error.message}`);

      // Chỉ đóng clean browser khi lỗi
      if (browser) {
        try {
          if (!profileEmail) await browser.close();
        } catch (e) { /* ignore close errors */ }
      }

      return { success: false, message: error.message };
    }
  }

  /**
   * Click nút tìm kiếm video
   */
  async clickSearchButton(page) {
    const clicked = await page.evaluate(() => {
      // Case 1: Button với onclick="ksearchvideo" hoặc class="btn-red"
      const ksearchBtn = document.querySelector('button[onclick*="ksearchvideo"], button.btn-red');
      if (ksearchBtn) {
        ksearchBtn.click();
        return true;
      }

      // Case 2: Button có text "Tải xuống" hoặc "Download"
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
      const btn = buttons.find(b => {
        const text = (b.textContent || b.value || '').toLowerCase();
        return text.includes('tải xuống') || text.includes('download') || text === 'tải';
      });
      if (btn) {
        btn.click();
        return true;
      }

      // Case 3: Submit button trong form
      const form = document.querySelector('form');
      if (form) {
        const submitBtn = form.querySelector('button, input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.toLowerCase().includes('tải')) {
          await btn.click();
          break;
        }
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  /**
   * Đợi kết quả từ fbdown.to
   */
  async waitForResult(page) {
    const maxWait = 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const hasResult = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const hasFbcdn = links.some(a => a.href && (a.href.includes('fbcdn.net') || a.href.includes('.mp4')));
          const hasQuality = document.body.innerText.toLowerCase().includes('720p') ||
            document.body.innerText.toLowerCase().includes('hd');
          return hasFbcdn || hasQuality;
        });

        if (hasResult) {
          await new Promise(r => setTimeout(r, 1000));
          return true;
        }
      } catch (e) {
        if (e.message.includes('Execution context was destroyed')) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('Timeout: Không nhận được kết quả');
  }

  /**
   * Truy cập Facebook và lấy title/description gốc
   */
  async extractFacebookInfo(page, facebookUrl) {
    try {
      // Truy cập trang Facebook video
      await page.goto(facebookUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));

      const info = await page.evaluate(() => {
        // Lấy description từ og:description
        const ogDesc = document.querySelector('meta[property="og:description"]');
        let description = ogDesc ? ogDesc.getAttribute('content') : null;
        let title = ogDesc ? ogDesc.getAttribute('content') : null;

        // Fallback: lấy từ title tag
        if (!title) {
          const titleTag = document.querySelector('title');
          if (titleTag) {
            title = titleTag.textContent.replace(/\s*\|\s*Facebook.*$/i, '').trim();
          }
        }

        // Fallback: tìm trong các element phổ biến của Facebook
        if (!title) {
          // Tìm trong các selector phổ biến của Facebook video
          const selectors = [
            '[data-ad-preview="message"]',
            'span[dir="auto"]',
            '.x193iq5w span',
            'h2 span',
            '[role="main"] span'
          ];

          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent && el.textContent.length > 10 && el.textContent.length < 500) {
              title = el.textContent.trim();
              break;
            }
          }
        }

        // Nếu description trống, dùng title
        if (!description || description.length < 5) {
          description = title;
        }

        // Clean up title - loại bỏ các phần không cần thiết
        if (title) {
          title = title
            .replace(/^Watch\s*/i, '')
            .replace(/\s*\|\s*Facebook.*$/i, '')
            .replace(/\s*-\s*Facebook.*$/i, '')
            .trim();
        }

        return {
          title: title || 'Facebook Video',
          description: description || title || 'Facebook Video'
        };
      });

      return info;
    } catch (error) {
      console.log(`   ⚠️ Không lấy được title từ Facebook: ${error.message}`);
      return {
        title: 'Facebook Video',
        description: 'Facebook Video'
      };
    }
  }

  /**
   * Extract a direct video download URL from the current page DOM
   */
  async extractDirectLink(page) {
    return page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a'));

      // Priority: fbcdn.net (Facebook CDN), known CDN domains, .mp4 extension
      const priority = all.find(a => a.href && (
        a.href.includes('fbcdn.net') ||
        a.href.includes('snapcdn') ||
        a.href.includes('dl.snapinsta') ||
        a.href.match(/\.(mp4|webm|mov)(\?|$)/i)
      ));
      if (priority) return priority.href;

      // Fallback: download text
      const byText = all.find(a => {
        const t = (a.textContent || '').toLowerCase().trim();
        return a.href && a.href.startsWith('http') && (
          t === 'download' || t.includes('hd') || t.includes('720') ||
          t.includes('download video') || t.includes('save video')
        );
      });
      return byText ? byText.href : null;
    });
  }

  /**
   * Poll for a direct video link to appear in the DOM (after clicking Render/Download button)
   */
  async waitForDirectLink(page, maxWaitMs = 20000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const url = await this.extractDirectLink(page).catch(() => null);
      if (url) return url;
      await new Promise(r => setTimeout(r, 1500));
    }
    return null;
  }

  /**
   * Click nút download theo quality
   * Đợi nút xuất hiện trước khi click (fbdown.to load chậm)
   */
  async clickDownloadButton(page, quality) {
    console.log(`   Đang đợi nút download xuất hiện...`);

    const maxWait = 30000; // Đợi tối đa 30 giây
    const startTime = Date.now();
    let clicked = false;

    while (Date.now() - startTime < maxWait && !clicked) {
      clicked = await page.evaluate((q) => {
        // PRIORITY 1: Tìm trong table rows - hỗ trợ cả <a> và <button>
        const rows = document.querySelectorAll('tr');
        for (const row of rows) {
          const rowText = row.textContent.toLowerCase();
          const isMatch = q === 'hd'
            ? (rowText.includes('720p') || rowText.includes('hd') || rowText.includes('1080p'))
            : (rowText.includes('360p') || rowText.includes('sd') || rowText.includes('480p'));

          if (isMatch) {
            // Ưu tiên tìm link "Tải xuống" trực tiếp
            const downloadLink = row.querySelector('a.download-link-fb, a[href*="download"]');
            if (downloadLink && downloadLink.textContent.toLowerCase().includes('tải xuống')) {
              console.log('✅ Tìm thấy link "Tải xuống" trong row:', rowText.substring(0, 50));
              downloadLink.click();
              return true;
            }

            // Nếu không có link "Tải xuống", tìm button "Render"
            const buttons = row.querySelectorAll('button');
            for (const btn of buttons) {
              const btnText = btn.textContent.trim().toLowerCase();
              // Check for "Render" button or button with convertFile onclick
              if (btnText === 'render' || btn.onclick?.toString().includes('convertFile')) {
                console.log('✅ Tìm thấy button "Render" trong row:', rowText.substring(0, 50));
                btn.click();
                return true;
              }
            }

            // Fallback: any link with "Tải xuống"
            const anyLink = row.querySelector('a');
            if (anyLink && anyLink.textContent.toLowerCase().includes('tải xuống')) {
              console.log('✅ Tìm thấy link trong row (fallback):', rowText.substring(0, 50));
              anyLink.click();
              return true;
            }
          }
        }

        // PRIORITY 2: Fallback - tìm bất kỳ link download nào
        const allLinks = Array.from(document.querySelectorAll('a.download-link-fb, a[href*="download"]'));
        const downloadLink = allLinks.find(a => a.textContent.toLowerCase().includes('tải xuống'));
        if (downloadLink) {
          console.log('✅ Tìm thấy link "Tải xuống" (fallback toàn trang)');
          downloadLink.click();
          return true;
        }

        return false;
      }, quality);

      if (clicked) {
        console.log(`   ✅ Đã click nút download`);
        break;
      }

      // Chưa tìm thấy, đợi thêm
      await new Promise(r => setTimeout(r, 2000));
      console.log(`   ⏳ Đang đợi nút download... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
    }

    if (!clicked) {
      // Chụp screenshot để debug
      await page.screenshot({ path: 'debug-no-download-button.png' });
      throw new Error('Không tìm thấy nút download sau 30 giây. Xem debug-no-download-button.png');
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  /**
   * Đợi file download hoàn tất
   */
  async waitForDownload(outputFileName) {
    const maxWait = 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const currentFiles = fs.readdirSync(this.downloadDir);
      const videoFiles = currentFiles.filter(f =>
        (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov')) &&
        !f.endsWith('.crdownload') && !f.endsWith('.part')
      );

      const now = Date.now();
      for (const fileName of videoFiles) {
        const filePath = path.join(this.downloadDir, fileName);
        const stats = fs.statSync(filePath);
        const modifiedAgo = now - stats.mtimeMs;

        if (modifiedAgo < 30000 && stats.size > 100000) {
          await new Promise(r => setTimeout(r, 1000));
          const stats2 = fs.statSync(filePath);

          if (stats.size === stats2.size) {
            let finalPath = filePath;
            let finalName = fileName;

            if (outputFileName) {
              finalPath = path.join(this.downloadDir, outputFileName);
              fs.renameSync(filePath, finalPath);
              finalName = outputFileName;
            }

            return {
              filePath: finalPath,
              fileName: finalName,
              sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
            };
          }
        }
      }

      // Log tiến độ download
      const downloading = currentFiles.filter(f => f.endsWith('.crdownload') || f.endsWith('.part'));
      if (downloading.length > 0) {
        try {
          const dlPath = path.join(this.downloadDir, downloading[0]);
          const dlStats = fs.statSync(dlPath);
          console.log(`   Đang download: ${(dlStats.size / (1024 * 1024)).toFixed(2)} MB`);
        } catch { /* ignore */ }
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    return null;
  }

  /**
   * Lấy danh sách file đã download
   */
  getDownloadedFiles() {
    if (!fs.existsSync(this.downloadDir)) return [];

    return fs.readdirSync(this.downloadDir)
      .filter(file => file.endsWith('.mp4'))
      .map(file => ({
        fileName: file,
        filePath: path.join(this.downloadDir, file),
        size: fs.statSync(path.join(this.downloadDir, file)).size
      }));
  }

  /**
   * Xóa file video đã download
   * @param {string} filePath - Đường dẫn file cần xóa
   * @returns {boolean} - true nếu xóa thành công, false nếu thất bại
   */
  deleteDownloadedFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Đã xóa file: ${path.basename(filePath)}`);
        return true;
      } else {
        console.log(`⚠️  File không tồn tại: ${filePath}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Lỗi khi xóa file ${filePath}: ${error.message}`);
      return false;
    }
  }

  // Download helper: axios stream download, uses page cookies + userAgent
  async downloadWithAxios(fileUrl, outputFileName = null, page = null) {
    const parsedName = (outputFileName) ? outputFileName : path.basename(new URL(fileUrl).pathname.split('?')[0]) || `fb_video_${Date.now()}.mp4`;
    const destPath = path.join(this.downloadDir, parsedName);

    // Build headers: User-Agent, Referer, Cookies
    let headers = {
      'User-Agent': await (page ? page.evaluate(() => navigator.userAgent) : Promise.resolve('Mozilla/5.0')),
      'Referer': 'https://fbdown.to/'
    };

    if (page) {
      try {
        const cookies = await page.cookies();
        if (cookies && cookies.length > 0) {
          headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }
      } catch (e) {
        // ignore cookie errors
      }
    }

    console.log(`   ⬇️  Starting axios download → ${destPath}`);

    const writer = fs.createWriteStream(destPath);

    const response = await axios.get(fileUrl, {
      responseType: 'stream',
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 0
    });

    const total = parseInt(response.headers['content-length'] || '0', 10);
    if (total > 0) console.log(`   ℹ️ Expected size: ${(total / (1024 * 1024)).toFixed(2)} MB`);

    let downloaded = 0;
    let lastLog = Date.now();
    const logIntervalMs = 2500;

    const progressInterval = setInterval(() => {
      const mb = (downloaded / 1024 / 1024).toFixed(2);
      if (total > 0) {
        const pct = ((downloaded / total) * 100).toFixed(1);
        console.log(`   ⬇️  ${mb} MB (${pct}%)`);
      } else {
        console.log(`   ⬇️  ${mb} MB`);
      }
    }, logIntervalMs);

    await new Promise((resolve, reject) => {
      response.data.on('data', chunk => {
        downloaded += chunk.length;
        const now = Date.now();
        // occasional log if data bursts
        if (now - lastLog > logIntervalMs) {
          const mb = (downloaded / 1024 / 1024).toFixed(2);
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            console.log(`   ⬇️  ${mb} MB (${pct}%)`);
          } else {
            console.log(`   ⬇️  ${mb} MB`);
          }
          lastLog = now;
        }
      });

      response.data.pipe(writer);

      let finished = false;
      writer.on('finish', () => {
        finished = true;
        clearInterval(progressInterval);
        resolve();
      });
      writer.on('error', err => {
        clearInterval(progressInterval);
        reject(err);
      });
      response.data.on('error', err => {
        clearInterval(progressInterval);
        reject(err);
      });

      // Safety: if stream ends without 'finish'
      setTimeout(() => {
        if (!finished && downloaded > 0 && total > 0 && downloaded >= total) {
          // best-effort resolve
          clearInterval(progressInterval);
          resolve();
        }
      }, 1000 * 60 * 5); // 5 minutes
    });

    const stats = fs.statSync(destPath);
    console.log(`   ✅ Axios download complete: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    return {
      filePath: destPath,
      fileName: parsedName,
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
    };
  }
}

module.exports = VideoDownloadService;
