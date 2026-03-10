const browserService = require('./browser.service');
const path = require('path');
const fs = require('fs');

class GoogleDriveService {

    /**
     * Kiểm tra xem URL có phải Google Drive không
     */
    isGoogleDriveUrl(url) {
        return url.includes('drive.google.com') || url.includes('docs.google.com');
    }

    /**
     * Tải video từ Google Drive
     * @param {string} driveUrl - URL Google Drive
     * @param {string} downloadPath - Thư mục lưu file
     * @returns {Promise<object>} - Kết quả download
     */
    async downloadFromDrive(driveUrl, downloadPath) {
        let browser = null;
        let page = null;
        let browserResult = null;

        try {
            console.log(`\n📥 Tải video từ Google Drive`);
            console.log(`   URL: ${driveUrl}`);

            // Tạo thư mục nếu chưa tồn tại
            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }

            browserResult = await browserService.launchBrowser(false, null, 3, false);
            browser = browserResult.browser;
            page = browserResult.page;

            // Cấu hình download behavior với CDP
            const client = await page.target().createCDPSession();
            await client.send('Browser.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath,
                eventsEnabled: true
            });

            // Track download progress qua CDP events
            let downloadInProgress = false;

            client.on('Browser.downloadWillBegin', (event) => {
                console.log(`   📥 CDP: Download bắt đầu: ${event.suggestedFilename}`);
                downloadInProgress = true;
            });

            client.on('Browser.downloadProgress', (event) => {
                if (event.state === 'completed') {
                    console.log(`   ✅ Download hoàn tất qua CDP!`);
                    downloadInProgress = false;
                } else if (event.state === 'canceled') {
                    console.log(`   ❌ Download bị hủy!`);
                    downloadInProgress = false;
                } else if (event.totalBytes > 0) {
                    const percent = Math.round((event.receivedBytes / event.totalBytes) * 100);
                    if (percent % 10 === 0) { // Log mỗi 10%
                        console.log(`   📥 Download: ${percent}% (${(event.receivedBytes / 1024 / 1024).toFixed(2)} MB)`);
                    }
                }
            });

            // Lấy file ID từ URL
            const fileId = this.extractFileId(driveUrl);
            if (!fileId) {
                throw new Error('Không thể trích xuất File ID từ URL Google Drive');
            }
            console.log(`   File ID: ${fileId}`);

            // Truy cập trang preview để lấy tên file
            const previewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            // Lấy tên file từ trang preview
            const fileName = await this.extractFileName(page, fileId);
            console.log(`   Tên file: ${fileName}`);

            // Click nút download trên trang preview
            console.log('   Đang tìm nút download...');

            let downloadStarted = false;

            // Cách 1: Click nút download trực tiếp
            downloadStarted = await page.evaluate(() => {
                const downloadBtn = document.querySelector('[aria-label="Download"]') ||
                    document.querySelector('[data-tooltip="Download"]') ||
                    document.querySelector('div[aria-label*="ownload"]');

                if (downloadBtn) {
                    downloadBtn.click();
                    return true;
                }
                return false;
            });

            if (!downloadStarted) {
                // Cách 2: Mở menu và tìm download
                console.log('   Thử mở menu...');
                await page.evaluate(() => {
                    const menuBtn = document.querySelector('[aria-label="More actions"]') ||
                        document.querySelector('[data-tooltip="More actions"]');
                    if (menuBtn) menuBtn.click();
                });

                await new Promise(r => setTimeout(r, 1000));

                downloadStarted = await page.evaluate(() => {
                    const items = document.querySelectorAll('[role="menuitem"], [role="option"]');
                    for (const item of items) {
                        if (item.textContent.toLowerCase().includes('download')) {
                            item.click();
                            return true;
                        }
                    }
                    return false;
                });
            }

            if (!downloadStarted) {
                // Cách 3: Truy cập trực tiếp URL download
                // LƯU Ý: page.goto() sẽ gây ERR_ABORTED vì Chrome trigger download thay vì load page
                // Nên dùng page.evaluate() để tạo link và click
                console.log('   Thử download trực tiếp...');
                const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

                try {
                    // Tạo link ẩn và click để trigger download
                    await page.evaluate((url) => {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = '';
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, directUrl);

                    downloadStarted = true;
                    console.log('   ✅ Đã trigger download qua link click');
                } catch (e) {
                    console.log('   ⚠️ Link click failed, thử navigate...');
                    // Fallback: navigate nhưng ignore ERR_ABORTED
                    try {
                        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    } catch (navError) {
                        // ERR_ABORTED là expected khi download bắt đầu
                        if (navError.message.includes('ERR_ABORTED')) {
                            console.log('   ✅ Download đã được trigger (ERR_ABORTED expected)');
                            downloadStarted = true;
                        } else {
                            console.log('   ⚠️ Navigate error:', navError.message);
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 2000));
            }

            // Kiểm tra nếu có trang xác nhận "Download anyway" (file lớn)
            console.log('   Kiểm tra trang xác nhận file lớn...');
            const hasConfirmPage = await page.evaluate(() => {
                const pageText = document.body.innerText;
                return pageText.includes("can't scan this file") ||
                       pageText.includes('Download anyway') ||
                       pageText.includes('too large');
            });

            if (hasConfirmPage) {
                console.log('   File lớn - đang click "Download anyway"...');

                // Tìm và click nút "Download anyway"
                const downloadClicked = await page.evaluate(() => {
                    // Tìm nút bằng nhiều cách
                    const buttons = document.querySelectorAll('a, button, form');
                    for (const btn of buttons) {
                        const text = btn.textContent || btn.innerText || '';
                        if (text.toLowerCase().includes('download anyway')) {
                            btn.click();
                            return true;
                        }
                    }

                    // Tìm form submit
                    const form = document.querySelector('form[action*="download"]');
                    if (form) {
                        form.submit();
                        return true;
                    }

                    // Tìm link có chứa confirm
                    const confirmLink = document.querySelector('a[href*="confirm="]') ||
                                       document.querySelector('a[href*="download"]');
                    if (confirmLink) {
                        confirmLink.click();
                        return true;
                    }

                    return false;
                });

                if (!downloadClicked) {
                    // Fallback: tìm link trong href và click trực tiếp
                    const confirmUrl = await page.evaluate(() => {
                        const link = document.querySelector('a[href*="confirm="]') ||
                                    document.querySelector('a[href*="export=download"]');
                        return link ? link.href : null;
                    });

                    if (confirmUrl) {
                        console.log('   Đang download từ confirm URL...');
                        // Click link thay vì navigate để tránh ERR_ABORTED
                        try {
                            await page.evaluate((url) => {
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = '';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }, confirmUrl);
                            console.log('   ✅ Đã trigger download từ confirm URL');
                        } catch (e) {
                            // Fallback navigate, ignore ERR_ABORTED
                            try {
                                await page.goto(confirmUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                            } catch (navErr) {
                                if (navErr.message.includes('ERR_ABORTED')) {
                                    console.log('   ✅ Download triggered (ERR_ABORTED expected)');
                                }
                            }
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 3000));
            }

            console.log('   🔄 Đang khởi tạo download...');

            // Đợi download bắt đầu (CDP event hoặc file .crdownload xuất hiện)
            console.log('   ⏳ Đang đợi download bắt đầu...');

            const maxWaitStart = 30000; // 30 giây để bắt đầu
            const startWaitTime = Date.now();

            while (!downloadInProgress && (Date.now() - startWaitTime < maxWaitStart)) {
                // Kiểm tra cả file .crdownload
                const files = fs.readdirSync(downloadPath);
                const downloadingFile = files.find(f => f.endsWith('.crdownload') || f.endsWith('.part'));
                if (downloadingFile) {
                    downloadInProgress = true;
                    console.log(`   ✅ Download bắt đầu (detected .crdownload): ${downloadingFile}`);
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!downloadInProgress) {
                console.log('   ⚠️ Không phát hiện download bắt đầu qua CDP, kiểm tra file thủ công...');
            }

            console.log('   ⏳ Đang tải file (giữ browser mở)...');

            // Đợi download hoàn tất - dựa vào file system check
            const downloadedFile = await this.waitForDownloadWithCDP(downloadPath);

            if (!downloadedFile) {
                throw new Error('Download timeout - không tìm thấy file sau khi đợi');
            }

            console.log(`✅ Tải thành công: ${downloadedFile.fileName} (${downloadedFile.sizeMB} MB)`);

            // QUAN TRỌNG: Đợi cho đến khi KHÔNG CÒN file .crdownload nào
            console.log('   ⏳ Đang đợi tất cả downloads hoàn tất...');

            const maxWaitForComplete = 60000; // 60 giây
            const waitStart = Date.now();

            while (Date.now() - waitStart < maxWaitForComplete) {
                const remainingDownloads = fs.readdirSync(downloadPath).filter(f =>
                    f.endsWith('.crdownload') || f.endsWith('.part')
                );

                if (remainingDownloads.length === 0) {
                    console.log('   ✅ Không còn file đang download');
                    break;
                }

                console.log(`   ⏳ Vẫn còn ${remainingDownloads.length} file đang download, đợi thêm...`);
                await new Promise(r => setTimeout(r, 3000));
            }

            // Đợi thêm 5 giây để Chrome hoàn toàn release file
            console.log('   ⏳ Đợi Chrome release file (5 giây)...');
            await new Promise(r => setTimeout(r, 5000));

            // Kiểm tra lần cuối
            const finalCheck = fs.readdirSync(downloadPath).filter(f =>
                f.endsWith('.crdownload') || f.endsWith('.part')
            );

            if (finalCheck.length > 0) {
                console.log('   ⚠️ CẢNH BÁO: Vẫn còn file đang download sau 60 giây!');
                console.log('   📋 Files:', finalCheck);
                // Đợi thêm 10 giây nữa
                await new Promise(r => setTimeout(r, 10000));
            }

            // Bây giờ mới close browser - dùng try-catch để bắt lỗi
            console.log('   🔒 Đóng browser...');
            try {
                // Disconnect CDP session trước
                await client.detach();
            } catch (e) {
                // Ignore
            }

            try {
                await browser.close();
                console.log('   ✅ Browser đã đóng thành công');
            } catch (closeError) {
                console.log('   ⚠️ Lỗi khi đóng browser:', closeError.message);
                // Force kill browser process nếu cần
                try {
                    const browserProcess = browser.process();
                    if (browserProcess) {
                        browserProcess.kill('SIGKILL');
                        console.log('   ✅ Force killed browser process');
                    }
                } catch (killError) {
                    // Ignore
                }
            }

            // Tạo title từ filename (bỏ extension)
            const title = fileName.replace(/\.[^/.]+$/, '');

            return {
                success: true,
                message: 'Tải video từ Google Drive thành công',
                data: {
                    originalUrl: driveUrl,
                    title: title,
                    description: title,
                    filePath: downloadedFile.filePath,
                    fileName: downloadedFile.fileName
                }
            };

        } catch (error) {
            console.error(`❌ Lỗi: ${error.message}`);
            if (browser) await browser.close();
            return { success: false, message: error.message };
        }
    }

    /**
     * Trích xuất File ID từ Google Drive URL
     */
    extractFileId(url) {
        // https://drive.google.com/file/d/FILE_ID/view
        // https://drive.google.com/open?id=FILE_ID
        // https://docs.google.com/file/d/FILE_ID

        let match = url.match(/\/file\/d\/([^\/]+)/);
        if (match) return match[1];

        match = url.match(/[?&]id=([^&]+)/);
        if (match) return match[1];

        match = url.match(/\/d\/([^\/]+)/);
        if (match) return match[1];

        return null;
    }

    /**
     * Lấy tên file từ trang Google Drive
     */
    async extractFileName(page, fileId) {
        const fileName = await page.evaluate(() => {
            // Thử lấy từ title
            const titleEl = document.querySelector('title');
            if (titleEl) {
                const title = titleEl.textContent;
                // Title thường có dạng "filename.mp4 - Google Drive"
                const match = title.match(/^(.+?)\s*-\s*Google Drive/);
                if (match) return match[1].trim();
            }

            // Thử lấy từ meta tag
            const metaTitle = document.querySelector('meta[property="og:title"]');
            if (metaTitle) {
                return metaTitle.getAttribute('content');
            }

            return null;
        });

        return fileName || `google-drive-${fileId}.mp4`;
    }

    /**
     * Đợi file download hoàn tất
     * @param {string} downloadPath - Thư mục download
     */
    async waitForDownloadWithCDP(downloadPath) {
        const maxWait = 600000; // 10 phút cho file lớn
        const startTime = Date.now();
        let lastLogTime = 0;
        let downloadStarted = false;
        let crdownloadFileName = null; // Track tên file .crdownload để biết khi nào nó thành file thật

        // Ghi nhận các file đã có sẵn trước khi download (CHỈ file không phải .crdownload/.part)
        const existingFiles = new Set(
            fs.readdirSync(downloadPath).filter(f =>
                !f.endsWith('.crdownload') && !f.endsWith('.part')
            )
        );

        console.log(`   📁 Existing files in download folder: ${existingFiles.size}`);

        while (Date.now() - startTime < maxWait) {
            const currentFiles = fs.readdirSync(downloadPath);
            const now = Date.now();

            // Kiểm tra file đang download (.crdownload hoặc .part)
            const downloadingFiles = currentFiles.filter(f =>
                f.endsWith('.crdownload') || f.endsWith('.part')
            );

            // Đánh dấu download đã bắt đầu nếu thấy file .crdownload
            if (downloadingFiles.length > 0 && !downloadStarted) {
                downloadStarted = true;
                crdownloadFileName = downloadingFiles[0];
                console.log(`   ✅ Phát hiện download bắt đầu: ${crdownloadFileName}`);
            }

            // Log tiến độ download mỗi 5 giây
            if (downloadingFiles.length > 0 && (now - lastLogTime > 5000)) {
                try {
                    const dlPath = path.join(downloadPath, downloadingFiles[0]);
                    const dlStats = fs.statSync(dlPath);
                    const elapsedSec = Math.round((now - startTime) / 1000);
                    console.log(`   📥 Đang download: ${(dlStats.size / (1024 * 1024)).toFixed(2)} MB (${elapsedSec}s)`);
                    lastLogTime = now;
                } catch { /* ignore */ }
            }

            // CÁCH 1: Tìm file video mới (không có trong existingFiles ban đầu)
            const videoExtensions = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv'];
            const videoFiles = currentFiles.filter(f => {
                const hasVideoExt = videoExtensions.some(ext => f.toLowerCase().endsWith(ext));
                const isNotDownloading = !f.endsWith('.crdownload') && !f.endsWith('.part');
                const isNew = !existingFiles.has(f);
                return hasVideoExt && isNotDownloading && isNew;
            });

            // CÁCH 2: Nếu biết tên file .crdownload, kiểm tra xem file thật đã xuất hiện chưa
            // VD: "video.mp4.crdownload" -> "video.mp4"
            let expectedFileName = null;
            if (crdownloadFileName) {
                expectedFileName = crdownloadFileName
                    .replace('.crdownload', '')
                    .replace('.part', '');
            }

            // Kiểm tra download hoàn tất
            if (downloadingFiles.length === 0) {
                // Ưu tiên 1: Kiểm tra file từ .crdownload đã rename
                if (expectedFileName && currentFiles.includes(expectedFileName)) {
                    const filePath = path.join(downloadPath, expectedFileName);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.size > 100000) {
                            // Đợi 1 giây để đảm bảo file ổn định
                            await new Promise(r => setTimeout(r, 1000));
                            const stats2 = fs.statSync(filePath);

                            if (stats.size === stats2.size) {
                                console.log(`   ✅ File đã download hoàn tất (từ .crdownload): ${expectedFileName}`);
                                return {
                                    filePath: filePath,
                                    fileName: expectedFileName,
                                    sizeMB: (stats2.size / (1024 * 1024)).toFixed(2)
                                };
                            }
                        }
                    } catch { /* ignore */ }
                }

                // Ưu tiên 2: Kiểm tra file video mới
                if (videoFiles.length > 0) {
                    const fileName = videoFiles[0];
                    const filePath = path.join(downloadPath, fileName);

                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.size > 100000) {
                            await new Promise(r => setTimeout(r, 1000));
                            const stats2 = fs.statSync(filePath);

                            if (stats.size === stats2.size) {
                                console.log(`   ✅ File đã download hoàn tất (video mới): ${fileName}`);
                                return {
                                    filePath: filePath,
                                    fileName: fileName,
                                    sizeMB: (stats2.size / (1024 * 1024)).toFixed(2)
                                };
                            }
                        }
                    } catch { /* ignore */ }
                }

                // Ưu tiên 3: Nếu downloadStarted và không còn .crdownload, tìm bất kỳ file mới nào
                if (downloadStarted) {
                    const newFiles = currentFiles.filter(f =>
                        !existingFiles.has(f) &&
                        !f.endsWith('.crdownload') &&
                        !f.endsWith('.part')
                    );

                    if (newFiles.length > 0) {
                        const fileName = newFiles[0];
                        const filePath = path.join(downloadPath, fileName);

                        try {
                            const stats = fs.statSync(filePath);
                            if (stats.size > 100000) {
                                await new Promise(r => setTimeout(r, 1000));
                                const stats2 = fs.statSync(filePath);

                                if (stats.size === stats2.size) {
                                    console.log(`   ✅ File đã download hoàn tất (file mới): ${fileName}`);
                                    return {
                                        filePath: filePath,
                                        fileName: fileName,
                                        sizeMB: (stats2.size / (1024 * 1024)).toFixed(2)
                                    };
                                }
                            }
                        } catch { /* ignore */ }
                    }
                }
            }

            await new Promise(r => setTimeout(r, 1000)); // Giảm từ 2s xuống 1s để detect nhanh hơn
        }

        return null;
    }

    /**
     * Đợi file download hoàn tất (fallback method)
     */
    async waitForDownload(downloadPath) {
        const maxWait = 600000; // 10 phút cho file lớn
        const startTime = Date.now();
        let lastLogTime = 0;
        let downloadStarted = false;

        // Ghi nhận các file đã có sẵn trước khi download
        const existingFiles = new Set(fs.readdirSync(downloadPath));

        console.log('   ⏳ Đang đợi download bắt đầu...');

        while (Date.now() - startTime < maxWait) {
            const currentFiles = fs.readdirSync(downloadPath);
            const now = Date.now();

            // Kiểm tra file đang download (.crdownload hoặc .part)
            const downloadingFiles = currentFiles.filter(f =>
                f.endsWith('.crdownload') || f.endsWith('.part')
            );

            if (downloadingFiles.length > 0 && !downloadStarted) {
                downloadStarted = true;
                console.log('   ✅ Download đã bắt đầu!');
            }

            // Log tiến độ download mỗi 5 giây
            if (downloadingFiles.length > 0 && (now - lastLogTime > 5000)) {
                try {
                    const dlPath = path.join(downloadPath, downloadingFiles[0]);
                    const dlStats = fs.statSync(dlPath);
                    const elapsedSec = Math.round((now - startTime) / 1000);
                    console.log(`   📥 Đang download: ${(dlStats.size / (1024 * 1024)).toFixed(2)} MB (${elapsedSec}s)`);
                    lastLogTime = now;
                } catch { /* ignore */ }
            }

            // Tìm file video mới (không phải file đang download)
            const videoFiles = currentFiles.filter(f =>
                (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov') || f.endsWith('.mkv') || f.endsWith('.avi')) &&
                !f.endsWith('.crdownload') && !f.endsWith('.part') &&
                !existingFiles.has(f) // Chỉ xét file mới
            );

            for (const fileName of videoFiles) {
                const filePath = path.join(downloadPath, fileName);

                try {
                    const stats = fs.statSync(filePath);

                    // File phải có kích thước tối thiểu
                    if (stats.size < 100000) continue;

                    // Đợi 3 giây để chắc chắn file đã download xong
                    console.log(`   🔍 Đang kiểm tra file: ${fileName} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
                    await new Promise(r => setTimeout(r, 3000));

                    const stats2 = fs.statSync(filePath);

                    // Nếu size không đổi sau 3 giây = download xong
                    if (stats.size === stats2.size) {
                        // Đợi thêm 2 giây để chắc chắn file đã được ghi hoàn toàn
                        await new Promise(r => setTimeout(r, 2000));

                        const finalStats = fs.statSync(filePath);
                        if (stats2.size === finalStats.size) {
                            console.log(`   ✅ File đã download hoàn tất!`);
                            return {
                                filePath: filePath,
                                fileName: fileName,
                                sizeMB: (finalStats.size / (1024 * 1024)).toFixed(2)
                            };
                        }
                    }
                } catch (err) {
                    // File có thể đang bị lock, tiếp tục đợi
                }
            }

            // Nếu đã có file .crdownload nhưng giờ không còn, và có file video mới
            // => download hoàn tất
            if (downloadStarted && downloadingFiles.length === 0 && videoFiles.length > 0) {
                const fileName = videoFiles[0];
                const filePath = path.join(downloadPath, fileName);
                const stats = fs.statSync(filePath);

                if (stats.size > 100000) {
                    // Đợi 2 giây để chắc chắn
                    await new Promise(r => setTimeout(r, 2000));
                    const finalStats = fs.statSync(filePath);

                    if (stats.size === finalStats.size) {
                        console.log(`   ✅ File đã download hoàn tất (from .crdownload)!`);
                        return {
                            filePath: filePath,
                            fileName: fileName,
                            sizeMB: (finalStats.size / (1024 * 1024)).toFixed(2)
                        };
                    }
                }
            }

            await new Promise(r => setTimeout(r, 2000));
        }

        return null;
    }
}

module.exports = new GoogleDriveService();
