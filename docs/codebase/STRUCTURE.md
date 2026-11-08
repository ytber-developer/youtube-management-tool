# Codebase Structure

## Core Sections (Required)

### 1) Top-Level Map

| Path | Purpose | Evidence |
|------|---------|----------|
| `src/` | Toàn bộ backend Node/Express (17.737 dòng JS) | `find src -name '*.js' \| xargs wc -l` |
| `frontend/` | Next.js 14 App Router UI (npm workspace) | `frontend/package.json`, `package.json` `workspaces` |
| `browser-extension/` | Chrome extension MV3 độc lập "Facebook Reels Scraper" | `browser-extension/manifest.json` |
| `scripts/` | Script phụ trợ một lần: 5 file Python export profile, 2 file JS (`auto-login-google.js`, `import-mysql-data.js`) | `ls scripts` |
| `docs/codebase/` | Tài liệu này + output scan | thư mục hiện tại |
| `setup.js` | Web wizard cài đặt chạy ở cổng 4321 (copy `.env`, install, migrate) | `setup.js:1-20` |
| `server.js` (root) | **Đã deprecate**, chỉ in cảnh báo và export `{}` | `server.js:1-9` |
| `start-dev.sh` | Script khởi động dev backend+frontend | `start-dev.sh` |
| `comments.json` | Thư viện comment ngẫu nhiên cho automation | `src/helpers/comment.helper.js` |
| `tool_ytb.db`, `tool_ytb copy.db` | File SQLite runtime (gitignored qua `*.db`) | `src/config/database.js`, `.gitignore` |
| `browser-profiles/`, `downloads/`, `uploads/`, `avatars/`, `videos-upload/`, `debug/` | Thư mục dữ liệu runtime, đều gitignored (trừ `videos-upload/`, `debug/` — xem CONCERNS) | `.gitignore`, `src/services/session.service.js`, `src/services/video.download.service.js` |
| `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `frontend/API_REFERENCE.md` | Tài liệu có sẵn — một phần đã lệch thực tế (xem CONCERNS §2) | các file tương ứng |

Repo có 153 file được git track; phần còn lại trong cây thư mục là dữ liệu runtime bị ignore (`git ls-files \| wc -l`).

### 2) Entry Points

- Main runtime entry: `src/server.js` (`package.json` `main` + script `start`).
- Secondary entry points:
  - `src/database/migrate.js` — CLI migration (`npm run migrate`).
  - `setup.js` — HTTP wizard cổng 4321, chạy thủ công `node setup.js`.
  - `frontend/` — `next dev` / `next start`.
  - `scripts/*.py`, `scripts/*.js` — tiện ích chạy tay, không nằm trong luồng server.
  - `browser-extension/` — load unpacked vào Chrome, độc lập hoàn toàn với backend.
- Cách chọn entry: qua npm scripts trong `package.json`; `nodemon.json` cố định `exec: "node src/server.js"`.
- Bên trong `src/server.js`, khởi động theo thứ tự: `sequelize.authenticate()` → `recoverStuckTasks()` → `startCron()` → `recoverStuckUploads()` → `startUploadCron()` → `app.listen(PORT)` (`src/server.js:52-75`).

### 3) Module Boundaries

| Boundary | What belongs here | What must not be here |
|----------|-------------------|------------------------|
| `src/routes/` | Khai báo path + gắn middleware upload + trỏ tới controller | Business logic, truy vấn DB |
| `src/controllers/` | Parse/validate request, gọi service, format response | Thao tác Puppeteer trực tiếp (thực tế bị vi phạm — xem CONCERNS) |
| `src/services/` | Automation trình duyệt, tải/upload video, cron queue, truy vấn model | Xử lý `req`/`res` của Express |
| `src/services/youtube/` | Các bước con của luồng YouTube (channel, avatar, upload form/UI/visibility/publish, watch) | Logic Facebook/Drive |
| `src/models/` | Định nghĩa Sequelize model + association (`src/models/index.js`) | Business rule |
| `src/database/migrations/` | Thay đổi schema, chạy qua `migrate.service.js` | Seed dữ liệu nghiệp vụ |
| `src/helpers/` | Hàm thuần tái sử dụng: timing, response, file, name, anti-detection, metadata | Trạng thái toàn cục, kết nối DB |
| `src/config/` | `constants.js` (selector YouTube, timeout, tên kênh), `database.js` (Sequelize instance) | Logic runtime |
| `src/middlewares/` | Cấu hình multer (CSV, video) | Auth (hiện chưa có auth) |
| `frontend/lib/` | `constants.ts` (bảng endpoint), `api.ts` (client + type) | Logic backend |

### 4) Naming and Organization Rules

- Backend file: `dot.case` phân lớp — `<domain>.<layer>.js`, ví dụ `accounts.controller.js`, `google.auth.service.js`, `anti-detection.helper.js`, `video.metadata.helper.js`.
- Tổ chức: **theo lớp (layer-first)** ở cấp `src/`, có một cụm con theo domain là `src/services/youtube/`.
- Migration: `YYYYMMDD[seq]-mô-tả.js` — repo trộn 2 kiểu: `20240101000001-create-account-youtubes.js` (có dấu gạch) và `20260202_add_recovery_email.js` (dấu gạch dưới).
- Frontend: route folder kebab-case (`boost-views/`, `check-adsense/`, `upload-video/`), file page cố định `page.tsx`; component PascalCase (`Sidebar.tsx`, `StatsCard.tsx`).
- Import: backend dùng relative CommonJS (`require('../models')`), không có alias. Frontend `tsconfig.json` có alias `@/*` → root frontend; barrel file: `src/helpers/index.js`, `src/services/youtube/index.js`, `src/models/index.js`.
- Cột DB: `snake_case` với `define: { underscored: true }` (`src/config/database.js`); JSON trả về frontend là camelCase (`frontend/lib/api.ts` interface `Account`).

### 5) Evidence

- `docs/codebase/.codebase-scan.txt` (DIRECTORY TREE, ENTRY POINTS, MONOREPO SIGNALS)
- `src/server.js`, `src/routes/index.js`, `src/routes/v1/index.js`
- `src/models/index.js`, `src/helpers/index.js`, `src/services/youtube/index.js`
- `package.json`, `nodemon.json`, `.gitignore`, `server.js`
