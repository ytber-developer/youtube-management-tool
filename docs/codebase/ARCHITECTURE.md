# Architecture

> Lưu ý: file `ARCHITECTURE.md` ở thư mục gốc repo mô tả kiến trúc **Playwright + Firefox**. Code thực tế chạy trên **Puppeteer + Chrome**. Tài liệu này mô tả trạng thái thực tế trong `src/`.

## Core Sections (Required)

### 1) Architectural Style

- Primary style: **Layered monolith** (routes → controllers → services → models) kèm **2 background job queue** chạy bằng cron trong cùng tiến trình.
- Why this classification: cây thư mục `src/` chia đúng theo lớp (`routes/`, `controllers/`, `services/`, `models/`, `helpers/`, `middlewares/`, `config/`); `src/routes/v1/index.js` mount 9 nhóm route; `src/server.js:52-75` khởi động `startCron()` (watch) và `startUploadCron()` (upload) ngay trong tiến trình HTTP.
- Primary constraints:
  1. **Toàn bộ "business logic" là điều khiển UI trình duyệt thật.** Không có API chính thức của Google/YouTube/Facebook — mọi thao tác đi qua Puppeteer + selector DOM (`src/config/constants.js` `YOUTUBE_SELECTORS`).
  2. **Đơn tiến trình, tài nguyên độc quyền.** Mỗi email gắn với một Chrome profile trên đĩa (`browser-profiles/<slug>`), nên cả hai cron đều ép **tối đa 1 campaign chạy tại một thời điểm** để tránh khoá profile (`src/services/campaign.service.js` header, `src/services/upload.queue.service.js:11-20`).
  3. **Trạng thái nằm trên filesystem cục bộ.** SQLite file, profile Chrome, thư mục `downloads/`, `uploads/` → không thể scale ngang hay chạy nhiều instance.

### 2) System Flow

```text
Next.js page -> frontend/lib/api.ts (axios) -> Express /api/v1/* -> controller
   -> service (Puppeteer/Chrome) -> Google/YouTube/Drive/Facebook UI
   -> Sequelize model -> tool_ytb.db (SQLite) -> JSON response (response.helper)
```

Luồng đồng bộ (ví dụ tạo kênh):
1. `POST /api/v1/youtube/create-channel` khớp ở `src/routes/v1/youtube.routes.js:6`.
2. `youtube.controller.createChannels` đọc account từ `AccountYoutube`.
3. `browser.service.launchBrowser(headless, email)` mở/tái dùng Chrome với profile riêng của email (`src/services/browser.service.js:74-90`).
4. `google.auth.service.login(page, email, password, twofaSecret)` đăng nhập, `authenticator.service` sinh TOTP bằng `speakeasy` khi Google hỏi mã.
5. `services/youtube/channel.service` thao tác DOM tạo kênh; `retry.service` đổi tên và thử lại khi tên bị từ chối (`CHANNEL_CREATION.MAX_RETRY_ATTEMPTS = 4`).
6. Kết quả ghi ngược vào `AccountYoutube` (`is_create_channel`, `channel_link`) và trả về qua `successResponse`.

Luồng bất đồng bộ (campaign):
1. Client `POST /api/v1/campaigns` hoặc `POST /api/v1/upload/campaigns*` → tạo bản ghi `WatchCampaign`/`UploadCampaign` trạng thái `new`.
2. Cron 5 phút tick: bỏ qua nếu đang có task `running`; nếu không, promote campaign `new` cũ nhất → `running`.
3. Xử lý từng batch (`batch_size`, mặc định 5) với watch, hoặc **từng video một** với upload.
4. Cập nhật trạng thái task/video; khi hết pending → campaign `done`.
5. Khi server khởi động lại, `recoverStuckTasks()` / `recoverStuckUploads()` reset các bản ghi kẹt ở `running`/`downloading`/`uploading`.

### 3) Layer/Module Responsibilities

| Layer or module | Owns | Must not own | Evidence |
|-----------------|------|--------------|----------|
| `src/routes/` | Định tuyến, versioning `/api/v1` + fallback `/api`, gắn multer | Business logic | `src/routes/index.js`, `src/routes/v1/index.js` |
| `src/controllers/` | Validate input, orchestrate service, format response | Điều khiển Puppeteer chi tiết (bị vi phạm: `upload.controller.js` 1.279 dòng, `verify.authenticator.controller.js` 1.125 dòng) | `src/controllers/*.js` |
| `src/services/*.service.js` | Automation trình duyệt, tải file, login, cron queue | `req`/`res` | `src/services/browser.service.js`, `campaign.service.js` |
| `src/services/youtube/` | Từng bước con của luồng YouTube (form, UI, visibility, publish, watch normal/short) | Facebook/Drive | `src/services/youtube/index.js` |
| `src/models/` | Schema Sequelize + 5 association | Business rule | `src/models/index.js` |
| `src/helpers/` | Hàm thuần: `sleep`/`randomDelay`, response, file, tên kênh, anti-detection, metadata video | State toàn cục | `src/helpers/*.js` |
| `src/config/constants.js` | Selector YouTube, timeout, thông điệp lỗi, từ vựng đặt tên kênh | Logic | `src/config/constants.js` |
| `frontend/lib/` | Bảng endpoint + axios client + type | Logic nghiệp vụ backend | `frontend/lib/constants.ts`, `frontend/lib/api.ts` |

### 4) Reused Patterns

| Pattern | Where found | Why it exists |
|---------|-------------|---------------|
| Singleton export (`module.exports = new XService()`) | Hầu hết service: `browser.service.js:719`, `google.auth.service.js:634`, `youtube.upload.service.js:543`… | Giữ state chung (ví dụ `activeBrowsers` Map) xuyên suốt tiến trình |
| Module-function export (không class) | `campaign.service.js:323`, `upload.queue.service.js:327`, `migrate.service.js:103` | Các module cron chỉ cần vài hàm + biến `cronJob`/`isProcessing` module-scope |
| Barrel index | `src/models/index.js`, `src/helpers/index.js`, `src/services/youtube/index.js` | Gom import, đặt association ở một chỗ |
| Response envelope | `src/helpers/response.helper.js` (`successResponse`, `successListResponse`, `errorResponse`) | Chuẩn hoá `{ success, message, data, pagination }` cho frontend |
| Cron + lock cờ (`isProcessing`) + recovery on boot | `campaign.service.js`, `upload.queue.service.js` | Ngăn tick chồng nhau; dọn trạng thái kẹt sau crash |
| Profile per account (userDataDir) | `src/services/session.service.js` | Giữ cookie/localStorage để không phải login lại và giảm nghi ngờ từ Google |
| Router-by-content-type | `src/services/watch.service.js` (Shorts vs video thường), `video.download.service.js` (Drive vs URL trực tiếp) | Chọn service con theo dạng URL |
| Retry với biến thể tên | `src/services/youtube/retry.service.js` + `src/helpers/name.generator.js` | YouTube từ chối một số tên kênh; thử lại tên khác |
| Selector fallback list | `YOUTUBE_SELECTORS.NAME_INPUT` là mảng nhiều selector | UI YouTube thay đổi thường xuyên |

### 5) Known Architectural Risks

- **Không có auth trên API.** `src/server.js` chỉ dùng `cors()` mở toàn bộ, không middleware xác thực; các endpoint có thể mở trình duyệt, đọc/xoá account, chạy `git pull` (`POST /api/v1/setup/pull` → `migrate.service.pullSource`). Nếu port bị expose ra ngoài localhost, đây là RCE-adjacent.
- **Cron nằm trong tiến trình web.** Một job automation nặng (mở Chrome, tải video GB) chiếm cùng event loop với HTTP API; `process.exit(1)` trên `unhandledRejection` (`src/server.js:11-13`) khiến toàn hệ thống chết theo một lỗi async đơn lẻ.
- **Không thể chạy nhiều instance.** SQLite file + profile Chrome + thư mục download cục bộ + giới hạn "1 campaign at a time" là ràng buộc kiến trúc, không phải cấu hình.
- **Phụ thuộc DOM bên thứ ba.** Mọi luồng chính vỡ khi YouTube/Google đổi UI; không có test nào bắt được điều này (không có test suite).
- **Hai lớp browser song song chưa hoàn tất.** `browser-playwright.service.js` và `google.auth.playwright.service.js` require `playwright` — package không nằm trong `dependencies`, nạp sẽ ném lỗi nếu có route nào chạm tới.
- **Controller phình to.** `upload.controller.js` (1.279 dòng) và `verify.authenticator.controller.js` (1.125 dòng) chứa orchestration lẽ ra thuộc service, làm ranh giới lớp mờ đi.

### 6) Evidence

- Entry & bootstrap: `src/server.js`
- Routing: `src/routes/index.js`, `src/routes/v1/index.js`, `src/routes/v1/*.routes.js`
- Job layer: `src/services/campaign.service.js`, `src/services/upload.queue.service.js`
- Automation layer: `src/services/browser.service.js`, `src/services/session.service.js`, `src/services/google.auth.service.js`, `src/services/youtube/*`
- Data layer: `src/config/database.js`, `src/models/index.js`, `src/database/migrations/`
- Client: `frontend/lib/api.ts`, `frontend/lib/constants.ts`
