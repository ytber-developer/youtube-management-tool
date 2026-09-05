# Codebase Concerns

Ngày lập: 2026-09-05. Nhánh: `fix/download_file_large`. Commit gần nhất: `01e8944` (2026-06-13).

## Core Sections (Required)

### 1) Top Risks (Prioritized)

| Severity | Concern | Evidence | Impact | Suggested action |
|----------|---------|----------|--------|------------------|
| High | API hoàn toàn không có xác thực, CORS mở toàn bộ | `src/server.js:25` (`app.use(cors())`), không có middleware auth trong `src/routes/` | Bất kỳ ai chạm được cổng đều đọc/xoá được toàn bộ account, mở browser với session Google, chạy campaign | Bind chỉ `127.0.0.1`, hoặc thêm API key/token middleware trước `app.use('/api', routes)` |
| High | `POST /api/v1/setup/pull` chạy `git pull origin main` qua `child_process.exec` từ HTTP request không xác thực | `src/services/migrate.service.js:88-100`, `src/controllers/setup.controller.js` | Cho phép cập nhật mã nguồn từ xa → thực thi code tuỳ ý ở lần chạy kế tiếp | Bỏ endpoint hoặc đặt sau auth + confirm rõ ràng |
| High | Password và secret TOTP lưu plaintext trong SQLite | `src/models/AccountYoutube.js` (`password`, `code_authenticators`), đọc ở `src/services/google.drive.service.js:11-22` | Một file `tool_ytb.db` bị lộ = mất toàn bộ account Google | Mã hoá at-rest bằng key ngoài; tối thiểu hạn chế quyền file và tài liệu hoá rủi ro |
| High | `unhandledRejection` → `process.exit(1)` ở tầng process | `src/server.js:11-13` | Một promise lỗi trong automation làm chết cả server và mọi campaign đang chạy | Log + tiếp tục, hoặc chỉ thoát với lỗi thật sự không khôi phục được |
| High | `require('playwright')` nhưng package không có trong `dependencies` | `src/services/browser-playwright.service.js:1`, `src/services/google.auth.playwright.service.js`, `package.json` | Bất kỳ route nào chạm tới 2 service này sẽ ném `MODULE_NOT_FOUND` khi cài mới | Xoá 2 file nếu đã bỏ hướng Playwright, hoặc thêm `playwright` vào dependencies |
| High | `npm run build` trỏ tới `./build-prod.sh` — file không tồn tại | `package.json` script `build`, `ls build-prod.sh` → không có | Lệnh build production hỏng hoàn toàn | Tạo lại script hoặc đổi `build` thành `npm run build:frontend` |
| Medium | Đường dẫn upload lấy trực tiếp từ `req.body.email` | `src/middlewares/upload.video.js:9-12` (`path.join(..., 'uploads/videos', email)`) | Path traversal: `email = "../../.."` ghi file ra ngoài thư mục dự định | Sanitize/whitelist trước khi `path.join`, hoặc dùng id account đã tra DB |
| Medium | `downloads/` phình không kiểm soát (2.0 GB, nhiều `.crdownload` dở dang; file lớn nhất ~896 GB theo scan) | `du -sh downloads`, scan §CODE METRICS | Đầy đĩa → download/upload fail hàng loạt | Dọn `.crdownload` khi khởi động; xoá file sau khi upload thành công (tuỳ chọn `deleteAfterUpload` đã có ở API) |
| Medium | Không có test và không có CI | `package.json` script `test` = exit 1; scan §CI/CD: none | Không phát hiện regression trước khi merge, dù repo dùng luồng PR | Thêm test cho helper thuần + workflow CI chạy lint/type-check |
| Medium | Tài liệu gốc mô tả sai stack | `README.md` & `ARCHITECTURE.md` nói Playwright/Firefox; `CONTRIBUTING.md` nói MySQL 5.7+; thực tế là Puppeteer/Chrome + SQLite (`src/config/database.js`, `src/services/browser.service.js`) | Người mới cài sai môi trường, chạy `npx playwright install firefox` vô ích | Cập nhật hoặc thay bằng `docs/codebase/` |
| Medium | Port mặc định không nhất quán ở 3 nơi | `src/server.js:22` (3000), `.env.example` (9000), `frontend/lib/constants.ts:1` & `next.config.js` (3006) | Frontend gọi sai backend sau khi clone | Chốt một giá trị, dùng chung trong cả 2 `.env.example` |
| Low | 3 dependency khai báo nhưng không dùng: `adm-zip`, `cheerio`, `qrcode` | grep `require('<pkg>')` trong `src`, `scripts`, `setup.js`, `server.js` → 0 kết quả | Bề mặt phụ thuộc thừa | Gỡ khỏi `package.json` sau khi xác nhận |
| Low | `server.js` ở root đã deprecate và `tool_ytb copy.db` còn nằm trong cây thư mục | `server.js:1-9`, `ls tool_ytb copy.db` | Nhầm lẫn entry point / DB | Xoá sau khi xác nhận không ai tham chiếu |

### 2) Technical Debt

| Debt item | Why it exists | Where | Risk if ignored | Suggested fix |
|-----------|---------------|-------|-----------------|---------------|
| Controller phình to | Orchestration automation viết thẳng vào controller thay vì service | `src/controllers/upload.controller.js` (1.279 dòng), `src/controllers/verify.authenticator.controller.js` (1.125 dòng) | Khó đọc, khó test, dễ vỡ khi sửa | Tách phần điều phối sang service theo đúng nguyên tắc trong `CONTRIBUTING.md` |
| Hai lớp browser song song (Puppeteer + Playwright) | Từng thử chuyển sang Playwright rồi dừng giữa chừng | `src/services/browser-playwright.service.js`, `google.auth.playwright.service.js` vs `browser.service.js` | Người đọc không biết đường nào là đường chính | Chọn một, xoá nhánh còn lại |
| `DB_STORAGE` bị bỏ qua | `src/config/database.js` hardcode đường dẫn | `src/config/database.js` vs `.env.example` | Không thể trỏ DB sang chỗ khác (kể cả `:memory:` cho test) | Đọc `process.env.DB_STORAGE` với fallback hiện tại |
| Múi giờ VN hardcode +7h | Tránh phụ thuộc thư viện timezone | `src/services/upload.queue.service.js:33-40` (`VN_OFFSET_MS`, `vnNow`, `toVNString`) | Sai lịch nếu triển khai ở TZ khác; khó suy luận | Lưu UTC trong DB, chuyển đổi ở tầng hiển thị |
| Naming migration không nhất quán | Hai giai đoạn phát triển khác nhau | `20240101000001-create-...` vs `20260202_add_recovery_email.js` | Thứ tự chạy dựa trên sort chuỗi — dễ nhầm khi thêm file mới | Chốt một quy ước, ghi vào `CONVENTIONS.md` |
| `src/models/UploadQueue.js` là file rỗng | Sót lại từ lần refactor | `src/models/UploadQueue.js` (0 byte) | Gây hiểu nhầm là có model này | Xoá |
| Logging bằng `console.log` + emoji, 1.067 chỗ | Phát triển nhanh | toàn bộ `src/` | Không lọc theo mức, không ghi file, không truy vết được sự cố cũ | Thay bằng logger có mức + ghi file xoay vòng |
| Không có `engines` và version Node mâu thuẫn giữa tài liệu | — | `README.md` (18+) vs `CONTRIBUTING.md` (14+) | Cài sai runtime | Thêm `engines.node` vào `package.json` |

Ghi chú: `TODO/FIXME/HACK` trong mã sản xuất = **0** (scan). Không có test dir nên không có "test TODO" nào để tách riêng.

### 3) Security Concerns

| Risk | OWASP category | Evidence | Current mitigation | Gap |
|------|----------------|----------|--------------------|-----|
| Không xác thực/không phân quyền trên mọi endpoint | A01 Broken Access Control | `src/server.js:20-30`, `src/routes/v1/*` | Chỉ ngầm định chạy localhost | Không có auth, không giới hạn bind address |
| Command execution qua endpoint HTTP (`git pull`) | A03 Injection / A08 | `src/services/migrate.service.js:88-100` | Lệnh cố định, không nội suy input người dùng | Endpoint vẫn công khai; đổi được mã nguồn đang chạy |
| Credential nhạy cảm lưu plaintext (DB + `fb-cookies.json` + CSV trong `uploads/`) | A02 Cryptographic Failures | `src/models/AccountYoutube.js`, `src/services/faceb.downloader.service.js`, `src/middlewares/upload.js` | `.gitignore` chặn commit (`*.db`, `fb-cookies.json`, `uploads/`, `.env`) | Không mã hoá at-rest, không xoá CSV sau khi import |
| Path traversal khi tạo thư mục upload | A01 | `src/middlewares/upload.video.js:9-12` | Không có | Không sanitize `req.body.email` |
| Rò rỉ stack trace ra client | A05 Security Misconfiguration | `src/server.js:44-48`, `src/helpers/response.helper.js` | Chỉ khi `NODE_ENV=development` | Đúng, nhưng `.env` mặc định của repo đang là `development` |
| Session Google sống lưu trên đĩa | A02 | `browser-profiles/` (238 MB), `src/services/session.service.js` | Đã gitignore | Không mã hoá, không hết hạn; ai đọc được đĩa là đăng nhập được |
| Không rate limit / không body size limit tuỳ chỉnh | A05 | `src/server.js:27-28` | `express.json()` mặc định 100kb; video multer giới hạn 5 GB | Không rate limit trên endpoint tốn tài nguyên (mở browser) |
| Không có dependency scanning | A06 Vulnerable Components | scan §SECURITY & COMPLIANCE: none | Không có | Thêm `npm audit` vào CI hoặc bật Dependabot |

### 4) Performance and Scaling Concerns

| Concern | Evidence | Current symptom | Scaling risk | Suggested improvement |
|---------|----------|-----------------|-------------|-----------------------|
| Cron automation chạy chung tiến trình với HTTP server | `src/server.js:63,71` | Request API chậm khi có job nặng | Không tách được tải; một crash giết cả hai | Tách worker process riêng |
| Tối đa 1 campaign tại một thời điểm (cả watch lẫn upload) | `src/services/campaign.service.js` header, `src/services/upload.queue.service.js:11-20` | Throughput bị chặn cứng | Không tăng được bằng cách thêm máy | Ràng buộc theo profile/account thay vì toàn cục |
| SQLite file đơn + ghi từ cron và HTTP | `src/config/database.js` | Nguy cơ `SQLITE_BUSY` khi ghi đồng thời | Không hỗ trợ nhiều instance | Bật WAL, hoặc chuyển sang Postgres nếu cần chạy song song |
| Không dọn file tải về | `downloads/` 2.0 GB, nhiều `.crdownload` | Đĩa đầy dần | Fail hàng loạt khi hết chỗ | Job dọn dẹp + xoá sau upload |
| Chrome profile mỗi account | `browser-profiles/` 238 MB cho vài account | Tiêu tốn đĩa tuyến tính theo số account | Hàng nghìn account là không khả thi | Dọn cache định kỳ trong profile |
| Không có timeout tập trung cho `axios`/navigation | `src/services/video.download.service.js` | Job có thể treo vô hạn | Chiếm slot cron duy nhất | Đặt timeout mặc định cho mọi lời gọi ngoài |

### 5) Fragile/High-Churn Areas

Cửa sổ 90 ngày của scan gần như rỗng vì commit gần nhất là 2026-06-13 (~3 tháng trước); bảng dưới dùng churn toàn thời gian (`git log --name-only` đếm theo file).

| Area | Why fragile | Churn signal | Safe change strategy |
|------|-------------|-------------|----------------------|
| `frontend/app/upload-video/page.tsx` | UI phức tạp nhất, gắn với nhiều biến thể API upload | 15 commit | Đổi song song với `frontend/lib/api.ts` + `constants.ts`; kiểm tra tay từng biến thể (file, folder, folder-path) |
| `src/services/upload.queue.service.js` | Cron + trạng thái + múi giờ VN + lock toàn cục | 14 commit | Không đổi ngữ nghĩa trạng thái mà chưa kiểm tra `recoverStuckUploads` |
| `src/controllers/upload.controller.js` | 1.279 dòng, 15 route, nhiều nhánh nghiệp vụ | 12 commit | Tách hàm trước khi thêm tính năng |
| `src/services/google.drive.service.js` | Phụ thuộc UI Drive + CDP download + file lớn | 10 commit; chủ đề của nhánh hiện tại `fix/download_file_large` | Thử với cả file nhỏ, file lớn (có trang cảnh báo virus) và file cần login |
| `src/services/google.auth.service.js` | Luồng login Google + 2FA + popup xác minh; file duy nhất đổi trong 90 ngày gần nhất | 4 commit, gồm 2 commit mới nhất của repo | Đổi từng bước nhỏ, log rõ, thử với account có/không 2FA |
| `src/services/browser.service.js` | 719 dòng, quản lý vòng đời browser + stealth + cờ Chrome | 7 commit | Không đổi `activeBrowsers`/reuse-tab mà chưa thử tình huống browser đã mở sẵn |

### 6) `[ASK USER]` Questions

1. `[ASK USER]` Backend có bao giờ được expose ra ngoài `localhost` không (server chung, LAN, port-forward)? Câu trả lời quyết định mức ưu tiên của việc thêm auth và của endpoint `/api/v1/setup/pull`.
2. `[ASK USER]` Hướng Playwright (`browser-playwright.service.js`, `google.auth.playwright.service.js`) đã bị bỏ hẳn chưa? Nếu rồi tôi xoá; nếu chưa cần thêm `playwright` vào `dependencies`.
3. `[ASK USER]` `build-prod.sh` bị mất hay chưa từng được commit? Cần khôi phục hay đổi script `build` sang `build:frontend`?
4. `[ASK USER]` Port chuẩn cho backend là bao nhiêu — 3000, 3006 hay 9000? Hiện 3 nơi khai báo 3 giá trị khác nhau.
5. `[ASK USER]` Password/TOTP secret có bắt buộc phải đọc được dạng plaintext để tự động login không, hay chấp nhận mã hoá at-rest bằng key trong `.env`?
6. `[ASK USER]` Có muốn tôi cập nhật lại `README.md` / `ARCHITECTURE.md` / `CONTRIBUTING.md` cho khớp thực tế (Puppeteer + Chrome + SQLite), hay giữ nguyên và dùng `docs/codebase/` làm nguồn chuẩn?
7. `[ASK USER]` Có kế hoạch bổ sung test + CI không, và ưu tiên bắt đầu từ đâu (helper thuần / API integration / smoke E2E)?
8. `[ASK USER]` Chính sách lưu trữ cho `downloads/` (2.0 GB) và `browser-profiles/` (238 MB) là gì — được phép tự động xoá sau khi upload xong không?
9. `[ASK USER]` `tool_ytb copy.db` và `server.js` ở root có còn cần giữ không?

### 7) Evidence

- `docs/codebase/.codebase-scan.txt` (CODE METRICS, CI/CD, SECURITY & COMPLIANCE, TODO/FIXME, HIGH-CHURN FILES)
- `git log --name-only --pretty=format: -- src frontend | sort | uniq -c | sort -rn` (churn toàn thời gian)
- `du -sh downloads browser-profiles uploads` → 2.0G / 238M / 704K
- `src/server.js`, `src/services/migrate.service.js`, `src/middlewares/upload.video.js`, `src/models/AccountYoutube.js`
- `src/services/browser-playwright.service.js`, `package.json`, `ls build-prod.sh` (không tồn tại)
- `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` (so sánh ý định vs thực tế)
