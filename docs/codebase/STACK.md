# Technology Stack

## Core Sections (Required)

### 1) Runtime Summary

| Area | Value | Evidence |
|------|-------|----------|
| Primary language | JavaScript (CommonJS) cho backend; TypeScript + React cho frontend | `src/server.js`, `frontend/app/page.tsx`, scan: 103 JS / 13 TSX / 3 TS files |
| Runtime + version | Node.js — README yêu cầu "Node.js 18+", CONTRIBUTING nói "Node.js 14+"; không có `engines` trong `package.json` → [TODO] xác nhận version chuẩn | `README.md` (Prerequisites), `CONTRIBUTING.md` (Prerequisites), `package.json` |
| Package manager | npm (có `package-lock.json` v3, npm workspaces) | `package-lock.json`, `package.json` field `workspaces: ["frontend"]` |
| Module/build system | Backend: CommonJS `require`, không có bước build. Frontend: Next.js 14 App Router, `output: 'standalone'` | `src/server.js:15`, `frontend/next.config.js` |

Monorepo: 1 workspace duy nhất (`frontend`). Backend nằm ngay ở root (`src/`).

### 2) Production Frameworks and Dependencies

Backend (`package.json` → `dependencies`):

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| express | ^4.19.2 | HTTP REST API server | `src/server.js:15,20`, `src/routes/index.js` |
| sequelize | ^6.37.5 | ORM cho toàn bộ model + migration runner | `src/config/database.js`, `src/models/*.js` |
| sqlite3 | ^5.1.7 | Driver DB thực tế (SQLite file `tool_ytb.db`) | `src/config/database.js` (`dialect: 'sqlite'`) |
| puppeteer / puppeteer-extra / puppeteer-extra-plugin-stealth | ^24.37.5 / ^3.3.6 / ^2.11.2 | Lớp automation chính: điều khiển Chrome, stealth chống phát hiện bot | `src/services/browser.service.js:1-30` |
| node-cron | ^3.0.3 | 2 cron loop: watch campaign & upload queue | `src/services/campaign.service.js:22`, `src/services/upload.queue.service.js:23` |
| axios | ^1.13.4 | Tải file HTTP (video, avatar) | `src/services/video.download.service.js`, `src/services/google.drive.service.js` |
| multer | ^1.4.5-lts.1 | Upload CSV & video file lên server | `src/middlewares/upload.js`, `src/middlewares/upload.video.js` |
| speakeasy | ^2.0.0 | Sinh mã TOTP cho luồng 2FA Google | `src/services/authenticator.service.js` |
| cors, morgan, dotenv | ^2.8.5 / ^1.10.0 / ^16.4.5 | CORS mở, HTTP log `dev`, nạp `.env` | `src/server.js:1,25-26` |
| adm-zip, cheerio, qrcode | ^0.5.16 / ^1.2.0 / ^1.5.4 | Khai báo trong `dependencies` nhưng **không có `require` nào trong `src/`, `scripts/`, `setup.js`, `server.js`** | grep toàn repo (ngoài `node_modules`) |
| playwright | *(không khai báo)* | `src/services/browser-playwright.service.js:1` `require('playwright')` nhưng package không có trong `dependencies` | `src/services/browser-playwright.service.js`, `package.json` |

Frontend (`frontend/package.json` → `dependencies`):

| Dependency | Version | Role in system | Evidence |
|------------|---------|----------------|----------|
| next | 14.1.0 | Framework UI (App Router) | `frontend/app/layout.tsx`, `frontend/next.config.js` |
| react / react-dom | ^18.2.0 | UI runtime | `frontend/package.json` |
| axios | ^1.6.5 | HTTP client gọi backend | `frontend/lib/api.ts` |
| lucide-react | ^0.312.0 | Icon set | `frontend/package.json` |
| clsx, tailwind-merge, class-variance-authority, tailwindcss-animate | — | Tiện ích class CSS | `frontend/package.json` |
| date-fns | ^3.3.1 | Format ngày giờ | `frontend/package.json` |

### 3) Development Toolchain

| Tool | Purpose | Evidence |
|------|---------|----------|
| nodemon ^3.0.2 | Auto-reload backend, watch `src/`, bỏ qua `src/database/migrations/*` | `nodemon.json`, `package.json` script `dev:backend` |
| concurrently ^8.2.2 | Chạy song song backend + frontend (`dev:all`) | `package.json` |
| eslint ^8.56.0 + eslint-config-next | Lint **chỉ cho frontend** (`next lint`) | `frontend/package.json` |
| typescript ^5.3.3 | Type-check frontend | `frontend/tsconfig.json` |
| tailwindcss ^3.4.1 + postcss + autoprefixer | Styling frontend | `frontend/tailwind.config.js`, `frontend/postcss.config.js` |
| `setup.js` | Server wizard cổng 4321 (copy `.env`, npm install, migrate) — chỉ dùng Node built-in | `setup.js:1-20` |
| Test framework | Không có. `npm test` = `echo "Error: no test specified" && exit 1` | `package.json` |

### 4) Key Commands

```bash
# install (root + workspace frontend)
npm install

# dev
npm run dev           # ./start-dev.sh — nodemon backend + next dev
npm run dev:backend   # nodemon src/server.js
npm run dev:frontend  # npm run dev -w frontend
npm run dev:all       # concurrently backend + frontend

# database
npm run migrate         # node src/database/migrate.js
npm run migrate:undo
npm run migrate:fresh

# production
npm start               # node src/server.js
npm run build:frontend  # next build
npm run start:frontend  # next start

# build  -> ./build-prod.sh  [BROKEN: file không tồn tại trong repo]
# test   -> chưa cấu hình (exit 1)
# lint   -> echo "Linting not configured yet" (backend); frontend: npm run lint -w frontend
```

### 5) Environment and Config

- Config sources: `.env` (root, gitignored), `.env.example`, `frontend/.env` / `frontend/.env.example`, `nodemon.json`, `src/config/constants.js`, `src/config/database.js`.
- Biến môi trường thực sự được đọc trong code (grep `process.env.*`): `PORT`, `NODE_ENV`, `CONCURRENT_TABS`, `HEADLESS`, `HEADLESS_AUTHENTICATOR`, `CHROME_EXECUTABLE`, `CHROME_USER_DATA_DIR`, `CHROME_USE_TEMP_PROFILE`, `KEEP_SANDBOX_FLAGS`, `FB_EMAIL`, `FB_PASSWORD`, `HOME`, `USERPROFILE`, `LOCALAPPDATA`.
- Biến khai báo nhưng **không được đọc ở đâu**: `DB_STORAGE` (`.env.example`) — `src/config/database.js` hardcode `path.join(__dirname, '../../tool_ytb.db')`. `BROWSER_TYPE` (`.env`) cũng không xuất hiện trong `src/`.
- Frontend: `NEXT_PUBLIC_API_URL`; default fallback trong code là `http://localhost:3006` (`frontend/lib/constants.ts:1`, `frontend/next.config.js`) nhưng `.env.example` frontend đặt `http://localhost:9000` và backend default `PORT` là `3000` (`src/server.js:22`).
- Ràng buộc runtime: cần Chrome cài sẵn trên máy (`CHROME_EXECUTABLE`), chạy có GUI khi không headless; `.env.example` chứa đường dẫn Chrome theo Windows, `.env` local theo macOS.

### 6) Evidence

- `package.json`, `package-lock.json`, `frontend/package.json`
- `src/config/database.js`, `src/config/constants.js`, `nodemon.json`
- `.env.example`, `frontend/.env.example`, `frontend/next.config.js`
- `docs/codebase/.codebase-scan.txt` (STACK DETECTION, CODE METRICS)
