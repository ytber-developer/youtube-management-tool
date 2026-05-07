const browserService = require('./browser.service');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class GoogleDriveService {

    /**
     * Kiểm tra xem URL có phải Google Drive không
     */
    isGoogleDriveUrl(url) {
        return url.includes('drive.google.com') || url.includes('docs.google.com');
    }

    /**
     * Tải video từ Google Drive
     * - Với public link (không có profileEmail): thử HTTP confirm-token flow trước, nếu fail mới mở browser
     * - Với private link (có profileEmail): dùng browser với profile đã đăng nhập
     * - Dùng CDP event để biết chính xác khi nào download hoàn tất, không cần polling dư thừa
     */
    async downloadFromDrive(driveUrl, downloadPath, options = {}) {
        const { profileEmail = null } = options;
        let browser = null;
        let client = null;

        const closeBrowser = async () => {
            if (!browser) return;
            if (profileEmail) {
                console.log('   ♻️ Giữ browser profile mở để tái sử dụng phiên đăng nhập');
                return;
            }
            try { if (client) await client.detach(); } catch (e) { /* ignore */ }
            try {
                await browser.close();
                console.log('   ✅ Browser đã đóng');
            } catch (e) {
                try { browser.process()?.kill('SIGKILL'); } catch (_) { /* ignore */ }
            }
        };

        try {
            console.log(`\n📥 Tải video từ Google Drive`);
            console.log(`   URL: ${driveUrl}`);
            if (profileEmail) console.log(`   👤 Profile: ${profileEmail}`);

            if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

            const fileId = this.extractFileId(driveUrl);
            if (!fileId) throw new Error('Không thể trích xuất File ID từ URL Google Drive');
            console.log(`   File ID: ${fileId}`);

            // ── Bước 1: Thử HTTP flow (chỉ khi không dùng profile) ────────────
            if (!profileEmail) {
                console.log('   ⚡ Thử download qua HTTP trước khi mở browser...');
                try {
                    const httpResult = await this.downloadPublicDriveFile(fileId, downloadPath);
                    if (httpResult && httpResult.success) {
                        console.log(`   ✅ HTTP download thành công: ${httpResult.fileName}`);
                        return {
                            success: true,
                            message: 'Tải video từ Google Drive thành công (via HTTP)',
                            data: {
                                originalUrl: driveUrl,
                                title: httpResult.fileName.replace(/\.[^/.]+$/, ''),
                                description: httpResult.fileName.replace(/\.[^/.]+$/, ''),
                                filePath: httpResult.filePath,
                                fileName: httpResult.fileName
                            }
                        };
                    }
                } catch (httpErr) {
                    console.log('   ⚠️ HTTP download thất bại, fallback sang browser:', httpErr.message);
                }
            }

            // ── Bước 2: Mở browser ────────────────────────────────────────────
            const browserResult = await browserService.launchBrowser(false, profileEmail, 3, !!profileEmail);
            browser = browserResult.browser;
            const page = browserResult.page;

            // Cấu hình CDP download
            client = await page.target().createCDPSession();
            await client.send('Browser.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: downloadPath,
                eventsEnabled: true
            });

            // Track trạng thái download qua CDP — dùng Promise để resolve ngay khi xong
            let cdpDownloadDone = false;
            let cdpDownloadFailed = false;
            let cdpResolve = null;
            const cdpDonePromise = new Promise(resolve => { cdpResolve = resolve; });

            client.on('Browser.downloadWillBegin', (event) => {
                console.log(`   📥 CDP: Download bắt đầu — ${event.suggestedFilename}`);
            });

            client.on('Browser.downloadProgress', (event) => {
                if (event.totalBytes > 0) {
                    const pct = Math.round((event.receivedBytes / event.totalBytes) * 100);
                    if (pct % 25 === 0) {
                        console.log(`   📥 ${pct}% (${(event.receivedBytes / 1024 / 1024).toFixed(1)} / ${(event.totalBytes / 1024 / 1024).toFixed(1)} MB)`);
                    }
                }
                if (event.state === 'completed') {
                    console.log('   ✅ CDP: Download hoàn tất!');
                    cdpDownloadDone = true;
                    cdpResolve && cdpResolve('completed');
                } else if (event.state === 'canceled') {
                    console.log('   ❌ CDP: Download bị hủy!');
                    cdpDownloadFailed = true;
                    cdpResolve && cdpResolve('canceled');
                }
            });

            // ── Bước 3: Lấy tên file từ trang preview ────────────────────────
            const previewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
            const fileName = await this.extractFileName(page, fileId);
            console.log(`   Tên file: ${fileName}`);

            // ── Bước 4: Trigger download (3 cách, dừng khi thành công) ────────
            console.log('   Đang trigger download...');
            let triggered = false;

            // Cách 1: nút Download trực tiếp
            triggered = await page.evaluate(() => {
                const btn = document.querySelector('[aria-label="Download"], [data-tooltip="Download"], div[aria-label*="ownload"]');
                if (btn) { btn.click(); return true; }
                return false;
            });
            if (triggered) console.log('   ✅ Trigger: nút Download trực tiếp');

            // Cách 2: menu More actions → Download
            if (!triggered) {
                await page.evaluate(() => {
                    const menu = document.querySelector('[aria-label="More actions"], [data-tooltip="More actions"]');
                    if (menu) menu.click();
                });
                await new Promise(r => setTimeout(r, 1000));
                triggered = await page.evaluate(() => {
                    for (const item of document.querySelectorAll('[role="menuitem"], [role="option"]')) {
                        if (item.textContent.toLowerCase().includes('download')) { item.click(); return true; }
                    }
                    return false;
                });
                if (triggered) console.log('   ✅ Trigger: menu → Download');
            }

            // Cách 3: inject link click vào trang
            if (!triggered) {
                const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                try {
                    await page.evaluate((url) => {
                        const a = document.createElement('a');
                        a.href = url; a.download = ''; a.style.display = 'none';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    }, directUrl);
                    triggered = true;
                    console.log('   ✅ Trigger: inject link click');
                } catch (e) {
                    try {
                        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        triggered = true;
                    } catch (navErr) {
                        if (navErr.message.includes('ERR_ABORTED')) {
                            triggered = true; // ERR_ABORTED = download đang bắt đầu
                        }
                    }
                    if (triggered) console.log('   ✅ Trigger: navigate direct URL');
                }
            }

            if (!triggered) throw new Error('Không thể trigger download — không tìm thấy nút download nào');

            // ── Bước 5: Xử lý trang xác nhận file lớn (nếu có) ─────────────
            // Google Drive có thể mở tab mới với trang "Download anyway"
            const handleConfirmPage = async (pg) => {
                try {
                    const url = pg.url();
                    if (!url.includes('drive.usercontent.google.com') && !url.includes('export=download')) return false;
                    console.log(`   🔔 Trang xác nhận file lớn: ${url.substring(0, 80)}...`);
                    // Cũng set download behavior cho tab mới
                    try {
                        const nc = await pg.target().createCDPSession();
                        await nc.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
                    } catch (e) { /* ignore */ }
                    try { await pg.waitForSelector('#uc-download-link, input[type="submit"]', { timeout: 8000, visible: true }); } catch (e) { /* ignore */ }
                    const clicked = await pg.evaluate(() => {
                        const byId = document.querySelector('#uc-download-link');
                        if (byId) { byId.click(); return 'by-id'; }
                        for (const inp of document.querySelectorAll('input[type="submit"]')) {
                            if ((inp.value || '').toLowerCase().includes('download')) { inp.click(); return 'by-input'; }
                        }
                        const btn = [...document.querySelectorAll('a, button')].find(el => (el.textContent || '').toLowerCase().includes('download anyway'));
                        if (btn) { btn.click(); return 'by-text'; }
                        const form = document.querySelector('form');
                        if (form) { form.submit(); return 'by-form'; }
                        return null;
                    });
                    if (clicked) { console.log(`   ✅ Click "Download anyway" (${clicked})`); return true; }
                    return false;
                } catch (e) {
                    console.log(`   ⚠️ handleConfirmPage error: ${e.message}`);
                    return false;
                }
            };

            // Kiểm tra tab hiện tại trước
            await handleConfirmPage(page);

            // Lắng nghe tab mới (tối đa 10s)
            const tabWaitPromise = new Promise(resolve => {
                const handler = async (target) => {
                    try {
                        const np = await target.page();
                        if (!np) return;
                        await new Promise(r => setTimeout(r, 1500));
                        await handleConfirmPage(np);
                    } catch (e) { /* ignore */ }
                    browser.off('targetcreated', handler);
                    resolve();
                };
                browser.on('targetcreated', handler);
                setTimeout(() => { browser.off('targetcreated', handler); resolve(); }, 10000);
            });

            // Đợi download hoàn tất (CDP) hoặc phát hiện file trên filesystem, tối đa 10 phút
            const MAX_WAIT_MS = 600000;
            const fsDetectPromise = this._waitForFileOnDisk(downloadPath, MAX_WAIT_MS);

            // Chạy song song: lắng nghe tab mới + đợi download xong
            await Promise.race([
                cdpDonePromise,
                fsDetectPromise,
                new Promise((_, rej) => setTimeout(() => rej(new Error('Download timeout 10 phút')), MAX_WAIT_MS))
            ]);

            // Đợi tabWait và đảm bảo không còn .crdownload
            await tabWaitPromise;

            if (cdpDownloadFailed) throw new Error('Download bị hủy bởi CDP');

            // Lấy file đã tải xong
            const downloadedFile = await this._getCompletedFile(downloadPath, MAX_WAIT_MS);
            if (!downloadedFile) throw new Error('Không tìm thấy file hoàn tất sau khi download');

            console.log(`✅ Tải thành công: ${downloadedFile.fileName} (${downloadedFile.sizeMB} MB)`);

            await closeBrowser();

            const title = fileName.replace(/\.[^/.]+$/, '');
            return {
                success: true,
                message: 'Tải video từ Google Drive thành công',
                data: {
                    originalUrl: driveUrl,
                    title,
                    description: title,
                    filePath: downloadedFile.filePath,
                    fileName: downloadedFile.fileName
                }
            };

        } catch (error) {
            console.error(`❌ Lỗi download Google Drive: ${error.message}`);
            await closeBrowser();
            return { success: false, message: error.message };
        }
    }

    /**
     * Polling filesystem để phát hiện file download bắt đầu xuất hiện (.crdownload / video mới)
     * @private
     */
    _waitForFileOnDisk(downloadPath, maxWaitMs = 600000) {
        const videoExts = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv'];
        const existingFiles = new Set(
            fs.readdirSync(downloadPath).filter(f => !f.endsWith('.crdownload') && !f.endsWith('.part'))
        );
        const startTime = Date.now();

        return new Promise((resolve) => {
            const check = () => {
                if (Date.now() - startTime > maxWaitMs) { resolve(null); return; }
                try {
                    const files = fs.readdirSync(downloadPath);
                    const cr = files.find(f => f.endsWith('.crdownload') || f.endsWith('.part'));
                    const newVideo = files.find(f =>
                        videoExts.some(ext => f.toLowerCase().endsWith(ext)) &&
                        !f.endsWith('.crdownload') && !f.endsWith('.part') &&
                        !existingFiles.has(f)
                    );
                    if (cr || newVideo) { resolve(cr || newVideo); return; }
                } catch (e) { /* ignore */ }
                setTimeout(check, 1000);
            };
            check();
        });
    }

    /**
     * Đợi file hoàn tất (không còn .crdownload) và trả về thông tin file
     * @private
     */
    async _getCompletedFile(downloadPath, maxWaitMs = 120000) {
        const videoExts = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.flv', '.wmv'];
        const existingBefore = new Set(
            // snapshot thời điểm gọi (có thể đã có file từ trước)
        );
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            const files = fs.readdirSync(downloadPath);
            const inProgress = files.filter(f => f.endsWith('.crdownload') || f.endsWith('.part'));

            if (inProgress.length > 0) {
                const dlPath = path.join(downloadPath, inProgress[0]);
                try {
                    const sz = fs.statSync(dlPath).size;
                    if (Date.now() - startTime > 3000) {
                        console.log(`   📥 Đang tải: ${(sz / 1024 / 1024).toFixed(1)} MB (${inProgress[0]})`);
                    }
                } catch (e) { /* ignore */ }
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            // Không còn .crdownload — tìm file video mới
            const candidates = files.filter(f =>
                videoExts.some(ext => f.toLowerCase().endsWith(ext)) &&
                !f.endsWith('.crdownload') && !f.endsWith('.part')
            );

            if (candidates.length > 0) {
                // Lấy file có mtime mới nhất
                const newest = candidates
                    .map(f => ({ name: f, mtime: fs.statSync(path.join(downloadPath, f)).mtimeMs }))
                    .sort((a, b) => b.mtime - a.mtime)[0];

                const filePath = path.join(downloadPath, newest.name);
                const stats = fs.statSync(filePath);

                if (stats.size < 10000) { await new Promise(r => setTimeout(r, 1000)); continue; }

                // Đợi 1s để chắc chắn file ổn định
                await new Promise(r => setTimeout(r, 1000));
                const stats2 = fs.statSync(filePath);
                if (stats.size === stats2.size) {
                    return { filePath, fileName: newest.name, sizeMB: (stats2.size / 1024 / 1024).toFixed(2) };
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        return null;
    }

    /**
     * Download public/shared Google Drive file via HTTP (confirm-token flow).
     * Returns { success, filePath, fileName }
     */
    async downloadPublicDriveFile(fileId, downloadPath) {
        const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const client = axios.create({ timeout: 120000, maxRedirects: 5, validateStatus: null });

        const streamToString = (stream, maxBytes = 1024 * 1024) => new Promise((resolve, reject) => {
            let data = '';
            let received = 0;
            stream.on('data', chunk => {
                received += chunk.length;
                if (received <= maxBytes) data += chunk.toString('utf8');
            });
            stream.on('end', () => resolve(data));
            stream.on('error', reject);
        });

        const getFileNameFromHeaders = (headers) => {
            const cd = headers && (headers['content-disposition'] || headers['Content-Disposition']);
            if (!cd) return null;
            const m = cd.match(/filename\*?=([^;]+)/i);
            if (m && m[1]) {
                let fname = m[1].trim();
                // Remove UTF-8'' prefix
                fname = fname.replace(/^UTF-8''/, '').replace(/^"|"$/g, '');
                try { return decodeURIComponent(fname); } catch (e) { return fname; }
            }
            return null;
        };

        try {
            // Initial request - try stream
            const initial = await client.get(baseUrl, { responseType: 'stream' });

            const contentType = (initial.headers['content-type'] || '').toLowerCase();

            // If response is not HTML -> treat as file stream
            if (!contentType.includes('text/html')) {
                const filename = getFileNameFromHeaders(initial.headers) || `${fileId}`;
                const destPath = path.join(downloadPath, filename);
                const writer = fs.createWriteStream(destPath);
                initial.data.pipe(writer);
                await new Promise((resolve, reject) => writer.on('finish', resolve).on('error', reject));
                return { success: true, filePath: destPath, fileName: filename };
            }

            // Otherwise parse HTML to find confirm token or download link
            const html = await streamToString(initial.data, 1024 * 1024); // read up to 1MB

            // Try common patterns for confirm token or direct href
            let confirmToken = null;
            let directHref = null;

            // Pattern: confirm=TOKEN
            const mConfirm = html.match(/confirm=([0-9A-Za-z_-]+)/);
            if (mConfirm) confirmToken = mConfirm[1];

            // Pattern: name="confirm" value="TOKEN"
            if (!confirmToken) {
                const mInput = html.match(/name="confirm" value="([^"]+)"/);
                if (mInput) confirmToken = mInput[1];
            }

            // Pattern: uc-download-link href
            if (!confirmToken) {
                const mHref = html.match(/id="uc-download-link"[^>]*href="([^"]+)"/);
                if (mHref) directHref = mHref[1];
            }

            // Build final download URL
            let finalUrl = baseUrl;
            if (directHref) {
                if (directHref.startsWith('/')) finalUrl = `https://drive.google.com${directHref}`;
                else finalUrl = directHref;
            } else if (confirmToken) {
                finalUrl = `${baseUrl}&confirm=${confirmToken}`;
            }

            // Try to include cookies from initial response if any
            const setCookie = initial.headers['set-cookie'];
            const headers = {};
            if (setCookie && Array.isArray(setCookie) && setCookie.length > 0) {
                headers['Cookie'] = setCookie.map(c => c.split(';')[0]).join('; ');
            }

            // Final stream
            const finalResp = await client.get(finalUrl, { responseType: 'stream', headers });
            const filename = getFileNameFromHeaders(finalResp.headers) || (html && (html.match(/<title>([^<]+)<\/title>/) || [])[1]) || `${fileId}`;
            const sanitized = String(filename).replace(/[\/:\\?%*|"<>]/g, '_');
            const destPath = path.join(downloadPath, sanitized);

            const writer2 = fs.createWriteStream(destPath);
            finalResp.data.pipe(writer2);
            await new Promise((resolve, reject) => writer2.on('finish', resolve).on('error', reject));

            return { success: true, filePath: destPath, fileName: sanitized };

        } catch (err) {
            return { success: false, message: err.message || String(err) };
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

    /**
     * Trích xuất confirm-token từ nội dung phản hồi
     */
    extractConfirmToken(responseData) {
        const html = responseData.toString();
        const match = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    /**
     * Lấy tên file từ response headers
     */
    getFileNameFromResponseHeaders(headers, fileId) {
        // Kiểm tra header Content-Disposition để lấy tên file
        const contentDisposition = headers['content-disposition'];
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (fileNameMatch) {
                return fileNameMatch[1].replace(/['"]/g, '').trim();
            }
        }

        // Nếu không có tên file trong header, dùng fileId làm tên tạm
        return `downloaded-file-${fileId}.bin`;
    }
}

module.exports = new GoogleDriveService();
