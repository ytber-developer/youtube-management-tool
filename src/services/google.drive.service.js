const browserService = require('./browser.service');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const googleAuthService = require('./google.auth.service');
const { AccountYoutube } = require('../models');

/**
 * Lấy password + twofa của account từ DB theo email
 */
async function _getCredentials(email) {
    if (!email) return { password: null, twofa: null };
    try {
        const account = await AccountYoutube.findOne({ where: { email } });
        return {
            password: account?.password || null,
            twofa: account?.twofa || account?.code_authenticators || null
        };
    } catch (e) {
        return { password: null, twofa: null };
    }
}

class GoogleDriveService {

    /**
     * Kiểm tra xem URL có phải Google Drive không
     */
    isGoogleDriveUrl(url) {
        return url.includes('drive.google.com') || url.includes('docs.google.com');
    }

    /**
     * Tải video từ Google Drive
     *
     * Flow (luôn dùng browser):
     *  1. Mở browser với profile của profileEmail.
     *  2. Kiểm tra session Drive — login nếu cần.
     *  3. Mở link Drive và trigger download qua CDP.
     *  4. Validate file sau khi tải xong.
     */
    async downloadFromDrive(driveUrl, downloadPath, options = {}) {
        const { profileEmail = null } = options;
        let browser = null;
        let client = null;

        const closeBrowser = async () => {
            if (!browser) return;
            try { if (client) await client.detach(); } catch (_) {}
            try { await browser.close(); } catch (e) {
                try { browser.process()?.kill('SIGKILL'); } catch (_) {}
            }
            browser = null;
        };

        try {
            console.log(`\n📥 Tải video từ Google Drive`);
            console.log(`   URL: ${driveUrl}`);

            if (!profileEmail) throw new Error('Cần cung cấp profileEmail để tải từ Google Drive');
            console.log(`   👤 Profile: ${profileEmail}`);

            if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

            const fileId = this.extractFileId(driveUrl);
            if (!fileId) throw new Error('Không thể trích xuất File ID từ URL Google Drive');
            console.log(`   File ID: ${fileId}`);

            // ── Bước 1: Mở browser với profile ─────────────────────────────────
            console.log('   🌐 Mở browser với profile...');
            const browserResult = await browserService.launchBrowser(false, profileEmail, 3, true);
            browser = browserResult.browser;
            const page = browserResult.page;

            // ── Bước 2: Lấy credentials & kiểm tra / thực hiện login ────────────
            const creds = await _getCredentials(profileEmail);
            const doLogin = async () => {
                if (!creds.password) throw new Error(`Không có password trong DB cho ${profileEmail}`);
                console.log('   🔐 Đang đăng nhập Google...');
                await googleAuthService.login(page, profileEmail, creds.password, creds.twofa, 'https://drive.google.com');
                await new Promise(r => setTimeout(r, 2000));
                console.log('   ✅ Đăng nhập thành công');
            };

            console.log('   🔐 Kiểm tra session Google Drive...');
            await page.goto('https://drive.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 1500));
            const notLoggedIn = await page.evaluate(() => location.href.includes('accounts.google.com'));
            if (notLoggedIn) {
                console.log('   ⚠️ Chưa đăng nhập — thực hiện login...');
                await doLogin();
            } else {
                console.log('   ✅ Session còn hạn');
            }

            // ── Bước 3: Cấu hình CDP download ───────────────────────────────────
            client = await page.target().createCDPSession();
            await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });

            let cdpDownloadFailed = false;
            let cdpResolve;
            const cdpDonePromise = new Promise(resolve => { cdpResolve = resolve; });
            let cdpFileName = null;
            let lastPct = -1;

            client.on('Browser.downloadWillBegin', (event) => {
                cdpFileName = event.suggestedFilename;
                console.log(`   📥 CDP: Download bắt đầu — ${cdpFileName}`);
            });
            client.on('Browser.downloadProgress', (event) => {
                if (event.totalBytes > 0 && event.receivedBytes > 0) {
                    const pct = Math.round((event.receivedBytes / event.totalBytes) * 100);
                    if (pct % 10 === 0 && pct !== lastPct) {
                        lastPct = pct;
                        console.log(`   📥 ${pct}% (${(event.receivedBytes/1024/1024).toFixed(1)} / ${(event.totalBytes/1024/1024).toFixed(1)} MB)`);
                    }
                }
                if (event.state === 'completed') { cdpResolve('completed'); }
                else if (event.state === 'canceled') { cdpDownloadFailed = true; cdpResolve('canceled'); }
            });

            // ── Bước 4: Mở trang preview Drive, retry nếu gặp trang auth ────────
            const previewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`   🔗 Mở trang Drive (lần ${attempt})...`);
                await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));
                const needsAuth = await page.evaluate(() => {
                    const u = location.href;
                    return u.includes('accounts.google.com') || u.includes('confirmidentifier') || u.includes('/challenge');
                });
                if (needsAuth) {
                    if (attempt === 3) throw new Error('Drive vẫn yêu cầu xác thực sau 3 lần thử — kiểm tra lại tài khoản');
                    console.log(`   🔒 Trang auth (lần ${attempt}) — login lại...`);
                    await doLogin();
                } else {
                    break;
                }
            }

            // ── Bước 5: Trigger download ─────────────────────────────────────────
            console.log('   🖱️ Trigger download...');

            // Thử nút Download trên toolbar
            let triggered = await page.evaluate(() => {
                const btn = document.querySelector('[aria-label="Download"], [data-tooltip="Download"], div[aria-label*="ownload"]');
                if (btn) { btn.click(); return true; }
                return false;
            });

            // Thử menu "More actions"
            if (!triggered) {
                await page.evaluate(() => { const m = document.querySelector('[aria-label="More actions"]'); if (m) m.click(); });
                await new Promise(r => setTimeout(r, 1000));
                triggered = await page.evaluate(() => {
                    for (const item of document.querySelectorAll('[role="menuitem"]')) {
                        if (item.textContent.toLowerCase().includes('download')) { item.click(); return true; }
                    }
                    return false;
                });
            }

            // Fallback: điều hướng thẳng đến URL tải xuống
            if (!triggered) {
                console.log('   ⚠️ Không tìm thấy nút Download — dùng URL trực tiếp...');
                const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                try {
                    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                } catch (e) { /* ERR_ABORTED = download đã bắt đầu */ }
                triggered = true;
            }

            // Xử lý trang xác nhận file lớn ("Download anyway")
            const handleConfirmPage = async (pg) => {
                try {
                    const url = pg.url();
                    if (!url.includes('drive.usercontent.google.com') && !url.includes('export=download')) return;
                    console.log('   🔔 Trang xác nhận file lớn — click Download anyway...');
                    try {
                        const nc = await pg.target().createCDPSession();
                        await nc.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
                    } catch (_) {}
                    try { await pg.waitForSelector('#uc-download-link, input[type="submit"]', { timeout: 8000, visible: true }); } catch (_) {}
                    await pg.evaluate(() => {
                        const byId = document.querySelector('#uc-download-link');
                        if (byId) return byId.click();
                        for (const inp of document.querySelectorAll('input[type="submit"]')) {
                            if ((inp.value || '').toLowerCase().includes('download')) return inp.click();
                        }
                        const btn = [...document.querySelectorAll('a,button')].find(el => (el.textContent || '').toLowerCase().includes('download anyway'));
                        if (btn) return btn.click();
                        const form = document.querySelector('form');
                        if (form) form.submit();
                    });
                } catch (_) {}
            };

            await handleConfirmPage(page);

            const tabWaitPromise = new Promise(resolve => {
                const handler = async (target) => {
                    try { const np = await target.page(); if (np) { await new Promise(r => setTimeout(r, 1500)); await handleConfirmPage(np); } } catch (_) {}
                    browser.off('targetcreated', handler); resolve();
                };
                browser.on('targetcreated', handler);
                setTimeout(() => { browser.off('targetcreated', handler); resolve(); }, 10000);
            });

            // ── Bước 6: Chờ download hoàn tất ───────────────────────────────────
            const MAX_WAIT_MS = 600000; // 10 phút
            await Promise.race([
                cdpDonePromise,
                new Promise((_, rej) => setTimeout(() => rej(new Error('Download timeout 10 phút')), MAX_WAIT_MS))
            ]);
            await tabWaitPromise;

            if (cdpDownloadFailed) throw new Error('Download bị hủy bởi CDP');

            // ── Bước 7: Lấy file & validate ─────────────────────────────────────
            const downloadedFile = await this._getCompletedFile(downloadPath, 30000);
            if (!downloadedFile) throw new Error('Không tìm thấy file hoàn tất sau download');

            if (!this._isValidVideoFile(downloadedFile.filePath)) {
                fs.unlinkSync(downloadedFile.filePath);
                throw new Error('File tải về không hợp lệ (không phải video) — có thể là trang lỗi HTML');
            }

            console.log(`   ✅ Tải thành công: ${downloadedFile.fileName} (${downloadedFile.sizeMB.toFixed(1)} MB)`);
            await closeBrowser();

            const finalName = cdpFileName || downloadedFile.fileName;
            const title = finalName.replace(/\.[^/.]+$/, '');
            return {
                success: true,
                message: 'Tải video từ Google Drive thành công',
                data: { originalUrl: driveUrl, title, description: title, filePath: downloadedFile.filePath, fileName: downloadedFile.fileName }
            };

        } catch (error) {
            console.error(`❌ Lỗi download Google Drive: ${error.message}`);
            await closeBrowser();
            return { success: false, message: error.message };
        }
    }

    /**
     * HTTP download trực tiếp (public file).
     * Tự xử lý virus-scan confirm token.
     * Returns { fileName, filePath } nếu thành công, null nếu fail.
     * @private
     */
    async _httpDownload(fileId, downloadPath) {
        const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        try {
            // Lần 1: gửi request, KHÔNG follow redirect để bắt Location header
            const resp1 = await axios.get(baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
                },
                maxRedirects: 0,
                validateStatus: s => s < 500,
                responseType: 'arraybuffer'
            });

            // Google redirect trực tiếp về file (public nhỏ)
            if (resp1.status === 302 || resp1.status === 301) {
                const location = resp1.headers['location'];
                if (location && !location.includes('accounts.google.com') && !location.includes('/signin')) {
                    console.log('   🔗 HTTP: redirect trực tiếp → tải file...');
                    const cookies = (resp1.headers['set-cookie'] || []).join('; ');
                    const resp2 = await axios.get(location, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            ...(cookies ? { Cookie: cookies } : {})
                        },
                        maxRedirects: 5,
                        responseType: 'stream',
                        validateStatus: s => s < 500
                    });
                    const ct2 = (resp2.headers['content-type'] || '').toLowerCase();
                    if (ct2.includes('text/html')) return null;
                    return await this._saveStream(resp2, fileId, downloadPath);
                }
                // Redirect về trang login → file private
                console.log('   ⚠️ HTTP: redirect về trang login → cần browser');
                return null;
            }

            const ct1 = (resp1.headers['content-type'] || '').toLowerCase();

            // Google trả về file trực tiếp (public nhỏ, không cần confirm)
            if (!ct1.includes('text/html')) {
                const fileName = this.getFileNameFromResponseHeaders(resp1.headers) || `video_${fileId}.mp4`;
                const filePath = path.join(downloadPath, fileName);
                fs.writeFileSync(filePath, Buffer.from(resp1.data));
                if (!this._isValidVideoFile(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('   ⚠️ HTTP: file trực tiếp không hợp lệ → fallback');
                    return null;
                }
                console.log(`   ✅ HTTP: lưu file trực tiếp ${fileName}`);
                return { fileName, filePath };
            }

            // Google trả về HTML (virus-scan confirm page cho file lớn)
            const html = Buffer.from(resp1.data).toString('utf8');
            const cookies = (resp1.headers['set-cookie'] || []).join('; ');

            // Format mới: drive.usercontent.google.com/download?id=...&confirm=...&uuid=...
            const usercontent = html.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/);
            if (usercontent) {
                const confirmUrl = usercontent[1].replace(/&amp;/g, '&');
                console.log('   🔑 HTTP: tìm thấy usercontent URL, tải file...');
                const resp2 = await axios.get(confirmUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0', Referer: baseUrl, ...(cookies ? { Cookie: cookies } : {}) },
                    maxRedirects: 5,
                    responseType: 'stream',
                    validateStatus: s => s < 500
                });
                const ct2 = (resp2.headers['content-type'] || '').toLowerCase();
                if (ct2.includes('text/html')) {
                    console.log('   ⚠️ HTTP: vẫn nhận HTML sau confirm → private file');
                    return null;
                }
                return await this._saveStream(resp2, fileId, downloadPath);
            }

            // Format cũ: ?confirm=TOKEN trong URL
            const tokenMatch = html.match(/[?&]confirm=([0-9A-Za-z_\-]+)/);
            const uuidMatch = html.match(/[?&]uuid=([0-9A-Za-z_\-]+)/);
            if (tokenMatch) {
                const confirm = tokenMatch[1];
                const uuid = uuidMatch ? uuidMatch[1] : '';
                const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirm}${uuid ? `&uuid=${uuid}` : ''}`;
                console.log('   🔑 HTTP: confirm token (format cũ), tải file...');
                const resp2 = await axios.get(confirmUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0', Referer: baseUrl, ...(cookies ? { Cookie: cookies } : {}) },
                    maxRedirects: 5,
                    responseType: 'stream',
                    validateStatus: s => s < 500
                });
                const ct2 = (resp2.headers['content-type'] || '').toLowerCase();
                if (ct2.includes('text/html')) return null;
                return await this._saveStream(resp2, fileId, downloadPath);
            }

            console.log('   ⚠️ HTTP: không tìm thấy confirm URL trong HTML → cần browser');
            return null;

        } catch (e) {
            console.log(`   ⚠️ HTTP download lỗi: ${e.message}`);
            return null;
        }
    }

    /** Kiểm tra file có phải video hợp lệ không (dùng magic bytes) @private */
    _isValidVideoFile(filePath) {
        try {
            const buf = Buffer.alloc(12);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buf, 0, 12, 0);
            fs.closeSync(fd);

            // MP4: ftyp tại offset 4 (isom, mp42, avc1, dash, ...)
            const ftyp = buf.slice(4, 8).toString('ascii');
            if (ftyp === 'ftyp') return true;

            // MKV: starts with 0x1A 0x45 0xDF 0xA3
            if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;

            // WebM: cũng dùng MKV container
            // RIFF/AVI: starts with RIFF
            if (buf.slice(0, 4).toString('ascii') === 'RIFF') return true;

            // HTML: starts with <!DO or <htm or \n<!
            const start = buf.slice(0, 5).toString('ascii').toLowerCase();
            if (start.includes('<!do') || start.includes('<html') || start.includes('<?xml')) return false;

            // Nếu file đủ lớn (>100KB) thì có thể chấp nhận
            const stats = fs.statSync(filePath);
            return stats.size > 100 * 1024;
        } catch (e) {
            return false;
        }
    }

    /** Lưu stream vào disk, trả về { fileName, filePath } @private */
    async _saveStream(response, fileId, downloadPath) {
        const fileName = this.getFileNameFromResponseHeaders(response.headers) || `video_${fileId}.mp4`;
        const filePath = path.join(downloadPath, fileName);
        const writer = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        // Validate: nếu file không phải video hợp lệ → xóa và báo lỗi
        if (!this._isValidVideoFile(filePath)) {
            fs.unlinkSync(filePath);
            console.log('   ⚠️ HTTP: file tải về không phải video hợp lệ (có thể là HTML/error page)');
            return null;
        }
        return { fileName, filePath };
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
