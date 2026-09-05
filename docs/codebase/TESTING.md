# Testing Patterns

> Tóm tắt: **repo hiện không có test tự động nào.** Mọi mục dưới đây phản ánh trạng thái đó thay vì mô tả một hệ thống test tưởng tượng.

## Core Sections (Required)

### 1) Test Stack and Commands

- Primary test framework: **không có**. `package.json` và `frontend/package.json` không chứa `jest`, `mocha`, `vitest`, `@playwright/test`, `supertest` hay bất kỳ test runner nào (grep xác nhận: 0 kết quả).
- Assertion/mocking tools: không có.
- Commands:

```bash
npm test        # => echo "Error: no test specified" && exit 1   (package.json)
# run unit tests        -> [TODO] chưa tồn tại
# run integration tests -> [TODO] chưa tồn tại
# run e2e tests         -> [TODO] chưa tồn tại
# run coverage          -> [TODO] chưa tồn tại
```

Kiểm chứng thủ công hiện có (không phải test):
```bash
npm run dev            # khởi động backend + frontend
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/setup/status   # kiểm tra kết nối DB + migration pending
```

### 2) Test Layout

- Test file placement pattern: **[TODO]** — `find` toàn repo (loại trừ `node_modules`) không trả về file `*.test.js`, `*.spec.*`, thư mục `__tests__/`, `test/` hay `tests/` nào.
- Naming convention: **[TODO]** — chưa có tiền lệ trong repo.
- Setup files: không có. Không có `jest.config.*`, `vitest.config.*`, `.mocharc*`, `playwright.config.*`.
- `CONTRIBUTING.md` có mục "Testing" trong mục lục nhưng không định nghĩa framework hay layout → đây là mục tiêu chưa thực hiện, không phải quy ước đang áp dụng.

### 3) Test Scope Matrix

| Scope | Covered? | Typical target | Notes |
|-------|----------|----------------|-------|
| Unit | Không | Ứng viên rõ nhất: `src/helpers/*` (thuần, không I/O) — `timing.helper.js`, `name.generator.js`, `video.metadata.helper.js`, `response.helper.js`, `file.helper.js` | Các file này không chạm DB/browser nên test được ngay mà không cần mock |
| Integration | Không | Route Express + Sequelize trên SQLite in-memory; `migrate.service.js`; logic tick của `campaign.service.js` / `upload.queue.service.js` | Sequelize hỗ trợ `storage: ':memory:'`, nhưng `src/config/database.js` hardcode đường dẫn file nên phải refactor trước |
| E2E | Không | Luồng automation thật (login Google, tạo kênh, upload) | Phụ thuộc UI bên thứ ba và account thật → khó tự động hoá ổn định; hiện đang được kiểm chứng bằng tay |

### 4) Mocking and Isolation Strategy

- Main mocking approach: **[TODO]** — chưa có.
- Trở ngại về isolation đã tồn tại trong code (cần xử lý trước khi viết test):
  - Service export **singleton có state**: `browser.service.js` giữ `this.activeBrowsers` Map (`src/services/browser.service.js:33-35`) → state rò rỉ giữa các test trong cùng tiến trình.
  - `src/config/database.js` hardcode `storage: path.join(__dirname, '../../tool_ytb.db')` → test sẽ ghi vào DB thật.
  - Cron được khởi động ngay trong `startServer()` (`src/server.js:63,71`), và `src/server.js` tự gọi `startServer()` khi import → không import được app để test mà không dựng cả hệ thống.
  - `src/services/video.download.service.js:30` require `google.drive.service` ngay trong hàm → không thể inject dependency mà không dùng module mocking.
- Common failure mode: chưa quan sát được (không có test để hỏng).

### 5) Coverage and Quality Signals

- Coverage tool + threshold: **[TODO]** — không có.
- Current reported coverage: **0%** (không có test nào trên 17.737 dòng backend + 13 file TSX frontend).
- CI: không có pipeline nào (scan §CI/CD PIPELINES: "No CI/CD pipelines detected") → không có cổng chất lượng tự động trước khi merge; repo có luồng PR trên GitHub (lịch sử commit đầy merge PR #28–#35) nhưng không có kiểm tra tự động chạy trên PR.
- Tín hiệu chất lượng khác đang có: lint frontend (`next lint`), type-check TypeScript frontend, `TODO/FIXME/HACK` trong code sản xuất = 0 (scan).
- Known gaps: toàn bộ backend; đặc biệt là logic có thể test thuần tuý mà không cần browser — lập lịch cron, xử lý múi giờ VN trong `upload.queue.service.js` (`vnNow`, `toVNString`, offset +7h hardcode), sinh task round-robin trong `campaign.service.generateTasks`, và các helper metadata video.
- `[ASK USER]` Có kế hoạch bổ sung test không, và ưu tiên ở đâu (helper thuần / API integration / smoke E2E)? — xem `CONCERNS.md` §6.

### 6) Evidence

- `package.json` (script `test`), `frontend/package.json` (không có test dep)
- `find . -name "*.test.js" -o -name "*.spec.*" -o -name "__tests__"` → không kết quả
- `docs/codebase/.codebase-scan.txt` (CI/CD PIPELINES: none; PERFORMANCE & TESTING: none; TODO/FIXME: none)
- `src/config/database.js`, `src/server.js`, `src/services/browser.service.js` (các rào cản isolation)
- `CONTRIBUTING.md` (mục Testing chưa có nội dung cụ thể)
