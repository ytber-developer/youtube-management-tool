const browserService = require('./browser.service');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const googleAuthService = require('./google.auth.service');

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

            // ALWAYS open browser/profile first so we can check Google Drive login and perform browser-based
            // download reliably (supports private/long files and ensures session is valid).
            const browserResult = await browserService.launchBrowser(false, profileEmail, 3, !!profileEmail);
            browser = browserResult.browser;
            const page = browserResult.page;

            // Kiểm tra trạng thái đăng nhập Drive cho cả trường hợp có hoặc không có profileEmail.
            try {
                console.log(`   🔐 Kiểm tra trạng thái đăng nhập Google Drive (mở profile)...`);
                await page.goto('https://drive.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(r => setTimeout(r, 1500));

                const needsLogin = await page.evaluate(() => {
                    if (document.querySelector('input[type="email"]')) return true;
                    if (document.querySelector('a[href*="ServiceLogin"], a[href*="accounts.google.com"]')) return true;
                    if (Array.from(document.querySelectorAll('button, a')).some(el => (el.textContent || '').toLowerCase().includes('sign in'))) return true;
                    return false;
                });

                if (needsLogin) {
                    console.log('   🔐 Chưa đăng nhập Drive — thực hiện login (sử dụng stored account nếu có)');
                    try {
                        await googleAuthService.login(page, profileEmail);
                        await new Promise(r => setTimeout(r, 1500));
                        console.log('   ✅ Đã đăng nhập Drive (hoặc chọn account)');
                    } catch (loginErr) {
                        console.log(`   ⚠️ Lỗi khi đăng nhập Drive: ${loginErr.message}`);
                        // Nếu login thất bại, chúng ta vẫn cố gắng tiếp tục — public HTTP fallback sẽ được thử sau khi browser flow thất bại.
                    }
                } else {
                    console.log('   ✅ Đã đăng nhập Google Drive (session ok)');
                }
            } catch (e) {
                console.log(`   ⚠️ Không thể kiểm tra/đăng nhập Drive: ${e.message}`);
            }

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

            // Try to open preview, but handle cases where Drive returns an accounts/verify page
            let previewAttempts = 0;
            let fileName = null;
            while (previewAttempts < 3) {
                previewAttempts++;
                await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));

                // Detect if Google responded with a login/verify flow instead of the preview
                const needsAuth = await page.evaluate(() => {
                    const url = location.href || '';
                    if (url.includes('accounts.google.com') || url.includes('/signin') || url.includes('/confirmidentifier') || url.includes('/challenge')) return true;
                    if (document.querySelector('input[type="email"]')) return true;
                    // Common verify headings
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3, div')).map(n => (n.textContent || '').toLowerCase());
                    if (headings.some(t => t.includes("verify it's you") || t.includes('verify your identity') || t.includes('xác minh'))) return true;
                    return false;
                });

                if (needsAuth) {
                    console.log(`   🔒 Preview opened but Google requires authentication/verification (attempt ${previewAttempts})`);
                    if (profileEmail) {
                        try {
                            console.log(`   🔐 Thực hiện login cho ${profileEmail} để hoàn tất xác thực...`);
                            await googleAuthService.login(page, profileEmail);
                            await new Promise(r => setTimeout(r, 1500));
                            console.log('   ✅ Đã cố gắng xác thực, thử lại preview...');
                            continue; // retry preview
                        } catch (loginErr) {
                            console.log(`   ⚠️ Login/verify failed: ${loginErr.message}`);
                            // If login failed, break and let normal flow handle error
                            break;
                        }
                    } else {
                        throw new Error('Google yêu cầu đăng nhập/xác thực nhưng không có profileEmail để thực hiện login');
                    }
                }

                // If we reach here, preview looks like a normal Drive preview — extract filename
                try {
                    fileName = await this.extractFileName(page, fileId);
                } catch (e) {
                    // ignore and let outer handler throw if needed
                }

                if (fileName) break;
            }

            if (!fileName) {
                // Final attempt to get title even if preview needed extra navigation
                try { fileName = await this.extractFileName(page, fileId); } catch (e) { /* ignore */ }
            }

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
                        if (navErr.message && navErr.message.includes('ERR_ABORTED')) {
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

            // Additionally: listen for same-tab navigations/responses that may show the "Download anyway" confirm page
            // Some Drive flows reuse the same tab instead of opening a new target — detect those and handle them.
            const sameTabHandler = async (frame) => {
                try {
                    const url = (typeof frame === 'string') ? frame : (frame && frame.url ? frame.url() : null);
                    const pageUrl = (page && page.url) ? page.url() : null;
                    if ((pageUrl && (pageUrl.includes('drive.usercontent.google.com') || pageUrl.includes('export=download'))) ||
                        (url && (url.includes('drive.usercontent.google.com') || url.includes('export=download')))) {
                        await handleConfirmPage(page);
                    }
                } catch (e) { /* ignore */ }
            };

            const respHandler = async (resp) => {
                try {
                    const rurl = resp.url();
                    const headers = resp.headers ? resp.headers() : {};
                    if (!rurl) return;
                    if (rurl.includes('drive.usercontent.google.com') || rurl.includes('export=download') ||
                        (headers && Object.keys(headers).some(h => h.toLowerCase() === 'content-disposition'))) {
                        await handleConfirmPage(page);
                    }
                } catch (e) { /* ignore */ }
            };

            page.on('framenavigated', sameTabHandler);
            page.on('response', respHandler);

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

            // Đợi download hoàn tất qua CDP, tối đa 10 phút
            const MAX_WAIT_MS = 600000;

            await Promise.race([
                cdpDonePromise,
                new Promise((_, rej) => setTimeout(() => rej(new Error('Download timeout 10 phút')), MAX_WAIT_MS))
            ]);

            await tabWaitPromise;

            // Remove same-tab listeners
            try { page.off('framenavigated', sameTabHandler); } catch (e) { /* ignore */ }
            try { page.off('response', respHandler); } catch (e) { /* ignore */ }

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
    _waitForFileOnDisk(downloadPath, maxWaitMs = 600000, abort = {}) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = 1000;

            const check = () => {
                if (abort.stopped) return; // dừng polling nếu đã abort

                const files = fs.readdirSync(downloadPath);
                const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'));
                const crdownloadFile = files.find(f => f.endsWith('.crdownload'));

                if (videoFile) {
                    const filePath = path.join(downloadPath, videoFile);
                    const stats = fs.statSync(filePath);
                    const fileSizeMB = stats.size / (1024 * 1024);
                    resolve({ filePath, fileName: videoFile, sizeMB: fileSizeMB });
                    return;
                } else if (crdownloadFile) {
                    console.log(`   ⏳ Phát hiện file tạm thời: ${crdownloadFile} - có thể đang tải`);
                } else {
                    console.log('   ⏳ Đang chờ file xuất hiện trên đĩa...');
                }

                if (Date.now() - startTime > maxWaitMs) {
                    reject(new Error('Hết thời gian chờ phát hiện file trên đĩa'));
                } else {
                    setTimeout(check, checkInterval);
                }
            };

            check();
        });
    }

    /**
     * Lấy thông tin file đã tải xong (không còn .crdownload)
     * @private
     */
    async _getCompletedFile(downloadPath, maxWaitMs = 600000) {
        const startTime = Date.now();
        const checkInterval = 1000;

        const check = () => {
            const files = fs.readdirSync(downloadPath);
            const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm'));

            if (videoFile) {
                const filePath = path.join(downloadPath, videoFile);
                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                return { filePath, fileName: videoFile, sizeMB: fileSizeMB };
            }

            if (Date.now() - startTime > maxWaitMs) {
                throw new Error('Không tìm thấy file hoàn tất sau khi download');
            }

            return null;
        };

        // Kiểm tra ngay lần đầu
        let result = check();
        if (result) return result;

        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                try {
                    const res = check();
                    if (res) {
                        clearInterval(interval);
                        resolve(res);
                    }
                } catch (e) {
                    clearInterval(interval);
                    reject(e);
                }
            }, checkInterval);
        });
    }

    /**
     * Trích xuất File ID từ URL Google Drive
     * - Hỗ trợ nhiều định dạng URL khác nhau
     * - Ví dụ: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
     */
    extractFileId(driveUrl) {
        const regex = /[\/]d\/([a-zA-Z0-9_-]+)/;
        const match = driveUrl.match(regex);
        return (match && match.length > 1) ? match[1] : null;
    }

    /**
     * Tải file từ Google Drive bằng HTTP (cho public link)
     * - Sử dụng confirm-token flow nếu cần
     */
    async downloadPublicDriveFile(fileId, downloadPath) {
        try {
            // Bước 1: Gửi yêu cầu lần đầu để lấy confirm token (nếu cần)
            const initialResponse = await axios.get(`https://drive.google.com/uc?export=download&id=${fileId}`, {
                maxRedirects: 0, // Không tự động chuyển hướng
                validateStatus: (status) => status === 302 || status === 403 // Chỉ chấp nhận 302 (Found) hoặc 403 (Forbidden)
            });

            // Kiểm tra xem có cần xác nhận không (302 Found với location là trang xác nhận)
            if (initialResponse.status === 302 && initialResponse.headers.location && initialResponse.headers.location.includes('confirm=')) {
                const confirmToken = initialResponse.headers.location.split('confirm=')[1].split('&')[0];
                console.log(`   🔑 Phát hiện confirm token: ${confirmToken}`);

                // Bước 2: Gửi yêu cầu lần hai với confirm token
                const fileResponse = await axios.get(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`, {
                    responseType: 'stream'
                });

                // Lưu file về đĩa
                const fileName = this.getFileNameFromResponseHeaders(fileResponse.headers) || `video_${fileId}.mp4`;
                const filePath = path.join(downloadPath, fileName);
                const writer = fs.createWriteStream(filePath);

                fileResponse.data.pipe(writer);

                return new Promise((resolve, reject) => {
                    writer.on('finish', () => {
                        console.log(`   ✅ Tải xong: ${fileName}`);
                        resolve({ success: true, fileName, filePath });
                    });
                    writer.on('error', (err) => {
                        console.error(`   ❌ Lỗi khi lưu file: ${err.message}`);
                        reject({ success: false, message: err.message });
                    });
                });
            } else if (initialResponse.status === 403) {
                // Nếu nhận được 403 Forbidden, có thể là do link không công khai
                throw new Error('Không thể tải file: Link Google Drive không công khai hoặc yêu cầu xác thực');
            } else {
                throw new Error(`Lỗi không xác định khi tải file: ${initialResponse.statusText}`);
            }
        } catch (error) {
            console.error(`❌ Lỗi tải file từ Google Drive: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    /**
     * Lấy tên file từ response headers (nếu có)
     */
    getFileNameFromResponseHeaders(headers) {
        const disposition = headers['content-disposition'] || headers['Content-Disposition'];
        if (disposition) {
            // Try RFC5987 / UTF-8'' style first
            const rfc5987 = disposition.match(/filename\*=(?:UTF-8'')?([^;\n]+)/i);
            if (rfc5987 && rfc5987[1]) {
                let fname = rfc5987[1].trim();
                fname = fname.replace(/^"|"$/g, '');
                try { return decodeURIComponent(fname); } catch (e) { return fname; }
            }

            // Fallback to basic filename="..." or filename=...
            const basic = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
            if (basic && basic[1]) {
                let fname = basic[1].trim();
                // remove optional surrounding quotes
                if ((fname.startsWith('"') && fname.endsWith('"')) || (fname.startsWith("'") && fname.endsWith("'"))) {
                    fname = fname.slice(1, -1);
                }
                try { return decodeURIComponent(fname); } catch (e) { return fname; }
            }
        }
        return null;
    }

    /**
     * Lấy tiêu đề video từ trang preview của Google Drive
     * - Thử nhiều cách để lấy tiêu đề chính xác
     */
    async extractFileName(page, fileId) {
        // Các selector tiềm năng cho tên file
        const selectors = [
            'h1.title', // Tiêu đề chính (trang preview)
            'div.uc-title', // Tiêu đề phụ (nếu có)
            'div#doc-entity:has(iframe)' // Tiêu đề trong iframe (nếu có)
        ];

        // Thử lấy tên file từ các selector
        for (const selector of selectors) {
            try {
                const titleElement = await page.$(selector);
                if (titleElement) {
                    let fileName = await page.evaluate(el => el.textContent.trim(), titleElement);
                    fileName = fileName.replace(/\.[^/.]+$/, ''); // Xóa phần mở rộng nếu có
                    return fileName;
                }
            } catch (e) {
                // ignore
            }
        }

        // Nếu không tìm thấy, thử lấy từ URL của trang
        try {
            const urlFileName = fileId; // Mặc định là fileId
            return urlFileName;
        } catch (e) {
            // ignore
        }

        return 'unknown_file';
    }
}

module.exports = new GoogleDriveService();
