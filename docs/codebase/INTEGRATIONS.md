# External Integrations

## Core Sections (Required)

### 1) Integration Inventory

Tất cả tích hợp bên ngoài đều là **browser automation trên UI thật**, không dùng API chính thức nào của Google/YouTube/Facebook.

| System | Type | Purpose | Auth model | Criticality | Evidence |
|--------|------|---------|------------|-------------|----------|
| Google Accounts (`accounts.google.com`) | Web UI automation (Puppeteer) | Đăng nhập account, xử lý popup xác minh điện thoại, redirect sang AdSense | Email + password lấy từ bảng `account_youtubes`, TOTP sinh bằng `speakeasy` | High | `src/services/google.auth.service.js`, `src/services/authenticator.service.js` |
| YouTube / YouTube Studio | Web UI automation | Tạo kênh, upload avatar, upload video, đặt visibility/schedule, publish, xem video (normal + Shorts), like/comment/subscribe | Kế thừa session Chrome profile | High | `src/services/youtube/*`, `src/services/youtube.upload.service.js`, `src/services/watch.service.js` |
| Google Drive (`drive.google.com`, `docs.google.com`) | Web UI automation + CDP download | Tải video nguồn từ link Drive (kể cả file lớn, qua trang cảnh báo virus) | Login Google bằng profile của account; fallback lấy credential từ DB | High | `src/services/google.drive.service.js` |
| Google AdSense | Web UI automation | Kiểm tra trạng thái AdSense của account | Đăng nhập Google + redirect | Medium | `src/services/adsense.service.js`, `src/controllers/adsense.controller.js` |
| Facebook | Web UI automation + HTTP | Scrape link Reels từ Page, scrape/tải avatar, tải video Reel | Cookie lưu ở `fb-cookies.json`; login bằng `FB_EMAIL`/`FB_PASSWORD` từ `.env` | Medium | `src/services/facebook.reel.scraper.service.js`, `src/services/facebook.avatar.scraper.service.js`, `src/services/faceb.downloader.service.js` |
| URL video tuỳ ý (HTTP) | HTTP download qua `axios` | Tải video/avatar từ link trực tiếp về `downloads/{email}/video` | Không | Medium | `src/services/video.download.service.js` |
| Chrome cục bộ | Process | Trình duyệt thật được `puppeteer-extra` + stealth điều khiển | N/A | High | `src/services/browser.service.js`, env `CHROME_EXECUTABLE` |
| Git remote (`origin/main`) | Shell command | `POST /api/v1/setup/pull` chạy `git pull origin main` trong thư mục repo | Credential git của máy host | High (rủi ro) | `src/services/migrate.service.js:88-100`, `src/controllers/setup.controller.js` |
| Frontend → Backend | REST/HTTP (axios) | Toàn bộ UI gọi `/api/v1/*` | Không có auth | High | `frontend/lib/api.ts`, `frontend/lib/constants.ts` |

Bề mặt API backend (từ `src/routes/v1/*.routes.js`): `/api/v1/accounts` (11 route), `/api/v1/upload` (15), `/api/v1/campaigns` (7), `/api/v1/login` (3), `/api/v1/youtube` (3), `/api/v1/setup` (3), `/api/v1/watch` (2), `/api/v1/authenticator` (2), `/api/v1/facebook` (1). `/api/*` cũng được mount trùng lên v1 (`src/routes/index.js`).

### 2) Data Stores

| Store | Role | Access layer | Key risk | Evidence |
|-------|------|--------------|----------|----------|
| SQLite `tool_ytb.db` | Store chính: account, video đã upload, campaign watch/upload, task | Sequelize (`src/config/database.js`) + 6 model | Đường dẫn hardcode (env `DB_STORAGE` bị bỏ qua); ghi đồng thời từ cron + HTTP; lưu password plaintext | `src/config/database.js`, `src/models/*.js` |
| `browser-profiles/<slug>/` | Chrome userDataDir mỗi email — cookie, localStorage, cache, session Google | `src/services/session.service.js` | Chứa session Google sống; khoá profile khi 2 tiến trình cùng dùng | `src/services/session.service.js` |
| `downloads/{email}/video/` | Video tải về trước khi upload | `src/services/video.download.service.js` | Không có dọn rác — scan cho thấy file `.crdownload` dở dang tới 600 GB | `src/services/video.download.service.js`, scan §CODE METRICS |
| `uploads/` và `uploads/videos/{email}/` | File CSV & video do người dùng upload qua multer | `src/middlewares/upload.js`, `upload.video.js` | Tên thư mục lấy trực tiếp từ `req.body.email` (path traversal) | `src/middlewares/upload.video.js:9-12` |
| `fb-cookies.json` | Cookie phiên Facebook | `src/services/faceb.downloader.service.js` | Credential dạng plaintext trên đĩa (đã gitignore) | `src/services/faceb.downloader.service.js` |
| `comments.json` | Thư viện comment ngẫu nhiên | `src/helpers/comment.helper.js` | Được git track | `comments.json` |
| `avatars/` | Ảnh avatar dùng để upload lên kênh | `src/helpers/file.helper.js` | — | `src/helpers/file.helper.js` |

Migration: 17 file trong `src/database/migrations/`, chạy tuần tự qua bảng `migrations` do `migrate.service.js` tự tạo (`ensureMigrationsTable`). `sequelize.sync()` đã bị gỡ có chủ đích (`src/server.js:55-56`).

### 3) Secrets and Credentials Handling

- Nguồn credential: `.env` (gitignored) cho `FB_EMAIL`/`FB_PASSWORD`; **password và secret TOTP của account YouTube nằm trong SQLite dưới dạng plaintext** (`src/models/AccountYoutube.js` cột `password`, `code_authenticators`; đọc ở `src/services/google.drive.service.js:11-22`).
- Kiểm tra hardcode: không tìm thấy secret nào bị commit — `git ls-files` chỉ có `.env.example` và `frontend/.env.example`; `.gitignore` che `.env`, `*.db`, `fb-cookies.json`, `browser-profiles/`, `downloads/`, `uploads/`.
- Credential được nhập hàng loạt qua CSV (`src/services/csv.service.js`, route upload CSV ở `accounts.routes.js` và `verify.routes.js`) — file CSV chứa password nằm lại trong `uploads/`.
- Rotation/lifecycle: **[TODO]** — không có cơ chế xoay vòng hay mã hoá at-rest nào trong code.
- `[ASK USER]` Password/TOTP secret có bắt buộc phải đọc lại được dạng plaintext (để tự động login) không, hay có thể mã hoá bằng key ngoài? — xem `CONCERNS.md` §6.

### 4) Reliability and Failure Behavior

- Retry: có ở mức nghiệp vụ chứ không phải mức HTTP — `browser.service.launchBrowser(headless, email, retries = 3)`; `CHANNEL_CREATION.MAX_RETRY_ATTEMPTS = 4` với đổi tên qua `retry.service` + `name.generator`; `UploadedVideo` theo dõi `download_attempts` / `upload_attempts` (`src/models/UploadedVideo.js`).
- Backoff: không có exponential backoff; dùng delay cố định/ngẫu nhiên từ `src/helpers/timing.helper.js` (`sleep`, `randomDelay`) và các hằng `WAIT_AFTER_*` trong `src/config/constants.js`.
- Timeout: đặt rải rác tại chỗ gọi (ví dụ `adsense.service._checkAccount(account, timeoutMs = 60000)`), không có chính sách timeout tập trung; `axios` gọi không cấu hình timeout ở `video.download.service.js`.
- Circuit breaker: không có.
- Recovery: khi khởi động, `recoverStuckTasks()` và `recoverStuckUploads()` reset bản ghi kẹt `running`/`downloading`/`uploading` (`src/server.js:59-72`). Cron dùng cờ `isProcessing` và kiểm tra task đang chạy để không tick chồng.
- Chế độ hỏng nổi bật: `unhandledRejection` ở tầng process làm `process.exit(1)` (`src/server.js:11-13`) — một promise lỗi trong automation có thể giết cả server, trừ các `TargetCloseError` đã được lọc riêng.

### 5) Observability for Integrations

- Logging quanh external call: có, nhưng chỉ là `console.log`/`console.error` với emoji — 1.067 lời gọi trong `src/`. Ví dụ cron tick in `🕒 [UploadQueue] cron tick - VN now: ...`.
- Metrics/tracing: **không có** — không có Prometheus, OpenTelemetry, Sentry hay APM nào trong `dependencies`.
- Health check: `GET /health` trả `{ status: 'OK' }` tĩnh, **không** kiểm tra DB hay cron (`src/server.js:32-34`).
- Trạng thái campaign quan sát được qua DB/API: `GET /api/v1/campaigns`, `GET /api/v1/upload/campaigns`, `GET /api/v1/setup/status` (kết nối DB + số migration pending).
- Khoảng trống: không log ra file (không rotate), không có request id, không đo tỉ lệ thành công của automation theo thời gian, không cảnh báo khi campaign fail liên tục, không giám sát dung lượng `downloads/`.

### 6) Evidence

- `src/services/google.auth.service.js`, `src/services/authenticator.service.js`, `src/services/google.drive.service.js`
- `src/services/facebook.*.service.js`, `src/services/faceb.downloader.service.js`, `src/services/video.download.service.js`
- `src/services/migrate.service.js`, `src/controllers/setup.controller.js`
- `src/config/database.js`, `src/models/`, `src/database/migrations/`
- `src/server.js` (health, morgan, error middleware), `.env.example`, `.gitignore`
- `frontend/lib/constants.ts` (bảng endpoint đầy đủ phía client)
