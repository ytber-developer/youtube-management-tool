# Coding Conventions

## Core Sections (Required)

### 1) Naming Rules

| Item | Rule | Example | Evidence |
|------|------|---------|----------|
| File (backend) | `dot.case`, hậu tố lớp: `<domain>.<layer>.js` | `google.auth.service.js`, `accounts.controller.js`, `anti-detection.helper.js` | `src/services/`, `src/controllers/`, `src/helpers/` |
| File (frontend) | Route folder kebab-case + `page.tsx` cố định; component PascalCase | `app/boost-views/page.tsx`, `components/StatsCard.tsx` | `frontend/app/`, `frontend/components/` |
| Migration | `YYYYMMDD[seq]` + mô tả — **repo trộn 2 kiểu** dấu `-` và `_` | `20240101000001-create-account-youtubes.js` vs `20260202_add_recovery_email.js` | `src/database/migrations/` |
| Class / service | PascalCase, hậu tố `Service`, export instance singleton | `class GoogleAuthService` → `module.exports = new GoogleAuthService()` | `src/services/google.auth.service.js:634` |
| Function / method | camelCase, động từ dẫn đầu | `launchBrowser`, `recoverStuckTasks`, `isGoogleDriveUrl` | `src/services/browser.service.js`, `campaign.service.js` |
| Types/interfaces (TS) | PascalCase, hậu tố `Request`/`Response` cho payload API | `WatchVideoRequest`, `AccountsResponse` | `frontend/lib/api.ts:4,17,40` |
| Cột DB / thuộc tính model | `snake_case` (`underscored: true`) | `account_youtube_id`, `is_create_channel`, `scheduled_start_at` | `src/config/database.js`, `src/models/*.js` |
| JSON API trả về client | camelCase | `channelName`, `isAuthenticator`, `avatarUrl` | `frontend/lib/api.ts` interface `Account` |
| Env vars | SCREAMING_SNAKE_CASE; frontend bắt buộc tiền tố `NEXT_PUBLIC_` | `CHROME_EXECUTABLE`, `NEXT_PUBLIC_API_URL` | `.env.example`, `frontend/.env.example` |
| Constants | SCREAMING_SNAKE object gom theo nhóm | `CHANNEL_CREATION`, `YOUTUBE_SELECTORS`, `AVATAR_SETTINGS` | `src/config/constants.js` |

### 2) Formatting and Linting

- Formatter: **không có**. Không có `.prettierrc`, `.editorconfig` ở bất kỳ đâu (scan: "No linting or formatting config files found in project root").
- Linter (backend): **không có** — `npm run lint` chỉ in `"Linting not configured yet"` (`package.json`).
- Linter (frontend): ESLint 8 với `eslint-config-next@14.1.0`, chạy qua `next lint`; không có file `.eslintrc` riêng trong `frontend/` → dùng cấu hình mặc định của Next.
- Quy ước thực tế quan sát được trong code: 2-space indent, dấu `;` cuối câu, nháy đơn cho chuỗi, `const`/`let` (không `var`), `async/await` xuyên suốt (CONTRIBUTING quy định rõ: dùng async/await thay `.then()`).
- Run commands:

```bash
npm run lint            # backend: no-op
npm run lint -w frontend  # next lint
npx tsc --noEmit -p frontend/tsconfig.json  # type-check frontend
```

### 3) Import and Module Conventions

- Backend: CommonJS `require`, **chỉ đường dẫn tương đối**, không có alias. Thứ tự thường gặp: package ngoài → module nội bộ → hằng số (`src/services/upload.queue.service.js:23-28`).
- Lazy require ngay trong hàm để phá vòng phụ thuộc — mẫu này lặp lại: `src/server.js:60,68` (`require('./services/campaign.service')` bên trong `startServer`), `src/services/video.download.service.js:30` (`require('./google.drive.service')` bên trong `downloadVideo`).
- Barrel/public export: `src/models/index.js` (kèm khai báo association), `src/helpers/index.js`, `src/services/youtube/index.js`. Tuy nhiên nhiều file vẫn require thẳng file con thay vì qua barrel (ví dụ `campaign.service.js:24-25` require cả `../models/WatchCampaign` lẫn `../models`).
- Export style: service dùng `module.exports = new XService()`; controller/helper dùng `exports.<fn> =`; module cron dùng `module.exports = { fn1, fn2 }`.
- Frontend: ESM `import`, alias `@/*` khả dụng qua `frontend/tsconfig.json`; toàn bộ endpoint tập trung ở `frontend/lib/constants.ts` và chỉ được gọi qua `frontend/lib/api.ts`.

### 4) Error and Logging Conventions

- Controller: bọc `try/catch`, trả `res.status(500).json(errorResponse(msg, err))` — `errorResponse` chỉ đính kèm `error.message` + `stack` khi `NODE_ENV === 'development'` (`src/helpers/response.helper.js`).
- Service: `try/catch` cục bộ, log rồi ném lại hoặc trả object `{ success, message }`; toàn repo có 306 lần xuất hiện `catch` trong `src/`.
- Global: error middleware cuối `src/server.js:38-49`; `uncaughtException` và `unhandledRejection` đều `process.exit(1)` (`src/server.js:4-13`). Riêng `browser.service.js:9-23` đăng ký thêm một handler `unhandledRejection` để **nuốt** `TargetCloseError` của stealth plugin.
- Logging: `morgan('dev')` cho HTTP + `console.log`/`console.error` thủ công, dùng emoji làm mức độ (`🔐` login, `✅` thành công, `❌` lỗi, `⏳`/`⏭️` trạng thái cron, `📁` filesystem). Có **1.067** lời gọi `console.log` trong `src/`. Không có logger có cấu trúc, không có correlation id, không ghi log ra file.
- Redaction: **không có quy tắc nào**. Email account xuất hiện trực tiếp trong log (`[${email}]`), password lưu plaintext trong DB (`src/models/AccountYoutube.js:18`).
- Ngôn ngữ: comment và thông điệp log trộn Anh–Việt; 17 file backend có comment/log tiếng Việt (ví dụ `src/middlewares/upload.video.js`, `src/services/google.drive.service.js`).

### 5) Testing Conventions

- Test file naming/location: **[TODO]** — không tồn tại file test nào trong repo (xem `TESTING.md`).
- Mocking strategy: **[TODO]** — không có.
- Coverage expectation: **[TODO]** — không có công cụ coverage. `CONTRIBUTING.md` có mục "Testing" nhưng không quy định framework.
- `[ASK USER]` Có chuẩn test nào team muốn áp dụng khi bắt đầu viết test không (Jest hay node:test)? — xem `CONCERNS.md` §6.

### 6) Evidence

- `package.json` (scripts `lint`, `test`), `frontend/package.json` (eslint-config-next)
- `src/helpers/response.helper.js`, `src/server.js` (error middleware, process handlers)
- `src/services/browser.service.js`, `src/services/upload.queue.service.js` (log & import style)
- `src/config/constants.js`, `src/config/database.js` (naming), `frontend/lib/api.ts` (TS naming)
- `CONTRIBUTING.md` (quy tắc async/await, separation of concerns)
- `docs/codebase/.codebase-scan.txt` (LINTING AND FORMATTING CONFIG: none)
