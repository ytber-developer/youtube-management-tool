# Hướng dẫn cài đặt tool trên máy mới

Tài liệu này hướng dẫn cài **toàn bộ tool** (quản lý tài khoản YouTube + dây chuyền làm video nội dung) trên một máy mới, từ máy trắng đến lúc build được video.

- Đã kiểm tra trên: **macOS (Apple Silicon M1–M4)**.
- **Windows**: phần web, dựng slide, render video và giọng đọc chạy được. Riêng **vẽ ảnh AI chưa được thử** (cần GPU NVIDIA).
- Thời gian cài: khoảng 30–60 phút, phần lớn là chờ tải mô hình và thư viện.

---

## Mục lục

1. [Yêu cầu máy](#1-yêu-cầu-máy)
2. [Cài phần mềm nền](#2-cài-phần-mềm-nền)
3. [Lấy mã nguồn](#3-lấy-mã-nguồn)
4. [Chép dữ liệu không nằm trong git](#4-chép-dữ-liệu-không-nằm-trong-git)
5. [Cài thư viện Node](#5-cài-thư-viện-node)
6. [Cấu hình file `.env`](#6-cấu-hình-file-env)
7. [Tạo database](#7-tạo-database)
8. [Cài AI chạy trên máy (giọng đọc, ảnh)](#8-cài-ai-chạy-trên-máy-giọng-đọc-ảnh)
9. [Chạy tool](#9-chạy-tool)
10. [Kiểm tra cài đặt](#10-kiểm-tra-cài-đặt)
11. [Dùng hằng ngày](#11-dùng-hằng-ngày)
12. [Tuỳ chọn nâng cao (biến môi trường)](#12-tuỳ-chọn-nâng-cao-biến-môi-trường)
13. [Xử lý sự cố](#13-xử-lý-sự-cố)
14. [Lưu ý bảo mật](#14-lưu-ý-bảo-mật)

---

## 1. Yêu cầu máy

| | Tối thiểu | Khuyên dùng |
|---|---|---|
| Hệ điều hành | macOS 13+ (Apple Silicon) hoặc Windows 10/11 64-bit | macOS Apple Silicon |
| RAM | 8 GB | 16 GB (bắt buộc nếu bật vẽ ảnh AI) |
| Ổ trống | 15 GB | 30 GB (video, mô hình AI, cache) |
| Mạng | Cần khi cài và khi lấy ảnh | — |
| GPU | Không cần | Windows + vẽ ảnh AI: NVIDIA ≥ 12 GB VRAM |

---

## 2. Cài phần mềm nền

### 2A. macOS

1. **Cài Homebrew** (nếu chưa có). Mở Terminal và chạy:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Cài xong, làm theo 2 dòng "Next steps" mà Homebrew in ra (thêm `brew` vào PATH), rồi **mở lại Terminal**.

2. **Cài Node.js 22, Python 3.12, ffmpeg, git:**
   ```bash
   brew install node@22 python@3.12 ffmpeg git
   brew link --overwrite node@22
   ```

3. **Cài espeak-ng** (Kokoro cần để đọc các từ lạ):
   ```bash
   brew install espeak-ng
   ```

4. **Cài Google Chrome** từ https://www.google.com/chrome/ (để mở tài khoản YouTube và xem giao diện).

5. Kiểm tra:
   ```bash
   node -v        # v22.x
   npm -v
   python3.12 --version
   ffmpeg -version | head -1
   espeak-ng --version
   ```

> Bản ffmpeg của Homebrew **không có** bộ lọc `drawtext`/`subtitles`. Như vậy là bình thường: tool vẽ phụ đề bằng ảnh PNG, không dùng 2 bộ lọc đó.

### 2B. Windows

Mở **PowerShell** (bấm phải → *Run as administrator*) và chạy:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
winget install Gyan.FFmpeg
winget install Git.Git
winget install Google.Chrome
```

**Đóng PowerShell rồi mở lại** để nhận PATH mới, sau đó kiểm tra:

```powershell
node -v
py -3.12 --version
ffmpeg -version
git --version
```

- Nếu `node -v` thấp hơn 20, cài bản 22 từ https://nodejs.org.
- Nếu sau này giọng đọc phát âm sai từ lạ: `winget install eSpeak-NG.eSpeak-NG`.
- **Có GPU NVIDIA và muốn vẽ ảnh AI**: cập nhật driver mới nhất, kiểm tra bằng lệnh `nvidia-smi`.

---

## 3. Lấy mã nguồn

### Cách 1: Clone từ GitHub (khuyên dùng)

1. Tạo SSH key cho tài khoản GitHub (nếu máy mới chưa có):
   ```bash
   ssh-keygen -t ed25519 -C "may-moi"
   cat ~/.ssh/id_ed25519.pub
   ```
   Dán nội dung vừa in vào GitHub → **Settings → SSH and GPG keys → New SSH key**.

2. Clone và chuyển sang branch đang làm:
   ```bash
   cd ~/Documents
   git clone git@github.com:<tai-khoan>/<ten-repo>.git tool-manager-ytb-acc
   cd tool-manager-ytb-acc
   git checkout feature/content-pipeline     # hoặc main sau khi đã merge
   ```

3. **Đặt danh tính git đúng tài khoản** (chỉ áp dụng cho repo này):
   ```bash
   git config user.name  "ytber-developer"
   git config user.email "<email-cua-tai-khoan-github>"
   ```

### Cách 2: Chép nguyên thư mục

Chép cả thư mục repo sang máy mới (USB, AirDrop, ổ mạng), **trừ** các thư mục sau vì phải cài lại trên máy mới:

- `node_modules/`, `frontend/node_modules/`, `frontend/.next/`
- `.venv-tts/`, `.venv-img/` (môi trường Python gắn với máy cũ, chép sang sẽ không chạy)

---

## 4. Chép dữ liệu không nằm trong git

Những thứ dưới đây **không có trong git** (vì nặng hoặc nhạy cảm). Chép tay từ máy cũ nếu cần:

| Thứ | Đường dẫn trên máy cũ | Có cần chép? |
|---|---|---|
| Ảnh, slide, video đã dựng | `content/**/images/*.jpg`, `slides/`, `thumbnail.png`, `*.mp4`, `voice.mp3`, `captions.srt` | **Nên chép**, để khỏi dựng lại vài giờ và giữ ảnh đã duyệt. Cách nhanh nhất: chép nguyên thư mục `content/` đè lên |
| Cấu hình | `.env`, `frontend/.env` | Có (hoặc tạo lại ở bước 6) |
| Database tài khoản | `tool_ytb.db` | Chỉ khi dùng phần quản lý tài khoản |
| Hồ sơ Chrome của tài khoản | `browser-profiles/` | Chỉ khi dùng phần quản lý tài khoản (giữ đăng nhập) |
| Mô hình giọng đọc Kokoro | macOS: `~/.cache/huggingface/`, Windows: `%USERPROFILE%\.cache\huggingface\` | Nên chép, đỡ tải lại khoảng 330 MB |

> **Không** gửi `.env`, `tool_ytb.db`, `browser-profiles/` qua email, chat hay ổ chia sẻ công khai. Chúng chứa mật khẩu và phiên đăng nhập. Dùng USB hoặc AirDrop.

---

## 5. Cài thư viện Node

Ở thư mục gốc của repo:

```bash
npm install
```

Lệnh này cài thư viện cho backend và frontend (workspace), đồng thời **tự tải Chrome cho Puppeteer** (dùng để dựng slide và thumbnail), mất vài phút.

Kiểm tra Chrome của Puppeteer đã tải về chưa:

```bash
ls ~/.cache/puppeteer            # macOS: phải có chrome/ và chrome-headless-shell/
```
```powershell
dir $env:USERPROFILE\.cache\puppeteer   # Windows
```

Nếu thiếu, tải lại bằng:
```bash
npx puppeteer browsers install chrome
npx puppeteer browsers install chrome-headless-shell
```

---

## 6. Cấu hình file `.env`

### 6.1. Backend: `.env` ở thư mục gốc

```bash
cp .env.example .env
```
(Windows: `copy .env.example .env`)

Mở `.env` và sửa:

```ini
PORT=9000
NODE_ENV=development
CONCURRENT_TABS=3

# Đường dẫn Chrome thật (dùng cho phần quản lý tài khoản)
# macOS:
CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Windows:
# CHROME_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
CHROME_USE_TEMP_PROFILE=true

# (Tuỳ chọn) Key ảnh miễn phí Pixabay: đăng ký tại https://pixabay.com/api/docs/
# PIXABAY_API_KEY=
```

> Bạn tự dán API key vào `.env`. Không bao giờ commit file này (đã có trong `.gitignore`).

### 6.2. Frontend: `frontend/.env`

```bash
cp frontend/.env.example frontend/.env
```

Đảm bảo **cùng cổng** với `PORT` ở trên:

```ini
NEXT_PUBLIC_API_URL=http://localhost:9000
```

> Nếu 2 cổng lệch nhau (ví dụ backend 9000, frontend gọi 3006), giao diện sẽ trống và không có dữ liệu.

---

## 7. Tạo database

```bash
npm run migrate
```

Lệnh này tạo file `tool_ytb.db` (SQLite) và chạy mọi bản cập nhật cấu trúc. Nếu đã chép `tool_ytb.db` từ máy cũ thì vẫn chạy lệnh này; nó chỉ áp dụng các bản cập nhật còn thiếu.

---

## 8. Cài AI chạy trên máy (giọng đọc, ảnh)

### 8.1. Cài bằng một lệnh

```bash
npm run content:setup
```

Lệnh này tạo 2 môi trường Python riêng trong repo (đã gitignore):

| Môi trường | Dùng cho | Dung lượng |
|---|---|---|
| `.venv-tts` | **Kokoro**: giọng đọc tiếng Anh, miễn phí, Apache-2.0 | khoảng 1 GB |
| `.venv-img` | **Z-Image-Turbo**: vẽ ảnh AI (mặc định **tắt**, xem mục 12) | khoảng 1 GB + mô hình vài GB khi dùng |

Chỉ muốn cài phần giọng đọc (khuyên dùng nếu máy yếu):
```bash
npm run content:setup -- tts
```

Trên Windows **không có GPU NVIDIA**, lệnh setup tự bỏ qua phần vẽ ảnh. Không sao, vì tool dùng ảnh miễn phí và tranh minh hoạ thay thế.

### 8.2. Các mô hình tự tải lần đầu dùng

Không cần làm gì, chỉ cần có mạng ở lần chạy đầu:

| Mô hình | Khi nào tải | Kích thước | Lưu ở |
|---|---|---|---|
| Kokoro (giọng đọc) | Lần đầu tạo giọng | khoảng 330 MB | `~/.cache/huggingface/` |
| CLIP (tự chọn ảnh) | Lần đầu lấy ảnh | khoảng 90 MB | `node_modules/@huggingface/transformers/.cache/` |
| Z-Image-Turbo | Chỉ khi bật `AI_IMAGES=1` | vài GB | `~/.cache/huggingface/` |

---

## 9. Chạy tool

### macOS

```bash
npm run dev
```
Lệnh này chạy cả backend (cổng 9000, tự khởi động lại khi sửa code) và frontend (cổng 3000).

### Windows

`npm run dev` dùng script bash nên không chạy trên Windows. Dùng:
```powershell
npm run dev:all
```
Hoặc mở 2 cửa sổ PowerShell, một cửa sổ chạy `npm run dev:backend`, cửa sổ kia chạy `npm run dev:frontend`.

### Mở giao diện

- Trang chính: http://localhost:3000
- **Quản lý video nội dung**: http://localhost:3000/content

---

## 10. Kiểm tra cài đặt

Làm lần lượt. Bước nào lỗi thì xem [mục 13](#13-xử-lý-sự-cố).

1. **Test tự động của dây chuyền nội dung**:
   ```bash
   npm run test:content
   ```
   Kết quả mong đợi: `# fail 0`.

2. **Backend sống**:
   ```bash
   curl http://localhost:9000/health
   curl http://localhost:9000/api/v1/setup/status
   ```

3. **Danh sách video**:
   ```bash
   curl http://localhost:9000/api/v1/content | head -c 300
   ```
   Phải thấy `"success":true` và danh sách video.

4. **Kiểm tra kịch bản**:
   ```bash
   npm run content -- check all
   ```
   Mong đợi: `28/28 OK`.

5. **Build thử 1 video** (kiểm tra cả slide, giọng đọc, render):
   ```bash
   npm run content -- build 2026-11-23/cosmic-what-if__01-fell-into-a-black-hole
   ```
   - Nếu đã chép `content/` từ máy cũ: in `đã đủ` (không cần làm gì).
   - Nếu chưa: tool chạy đủ các bước, khoảng 2–5 phút, rồi in `✅ … final.mp4`.

6. Mở http://localhost:3000/content, bấm vào video vừa build và xem `final.mp4` trong trang.

---

## 11. Dùng hằng ngày

### Lệnh chính

```bash
npm run content -- build <ngày|id|all>
```
Ví dụ: `npm run content -- build 2026-11-25` làm 2 video ngày 25/11. Tool tự chạy các bước còn thiếu theo thứ tự: lấy ảnh → dựng slide → thumbnail → đóng gói → preview → giọng đọc → video cuối. Bước nào đã xong thì bỏ qua.

Hoặc trên giao diện: bấm vào video → nút xanh lá **"Làm hết (tự động)"**.

### Các lệnh lẻ

| Lệnh | Làm gì |
|---|---|
| `npm run content -- check <mục tiêu>` | Kiểm tra kịch bản đúng quy tắc |
| `npm run content -- images <mục tiêu>` | Lấy ảnh cho cảnh còn thiếu |
| `npm run content -- slides <mục tiêu>` | Dựng slide |
| `npm run content -- thumb <mục tiêu>` | Tạo thumbnail |
| `npm run content -- package <mục tiêu>` | Xuất lời đọc + mô tả/tags |
| `npm run content -- preview <mục tiêu>` | Video thử không tiếng |
| `npm run content -- voice <mục tiêu>` | Tạo giọng Kokoro + render |
| `npm run content -- render <mục tiêu>` | Render video cuối từ `voice.mp3` có sẵn |
| `npm run content:search -- "từ khoá" --sheet out.jpg` | Tìm ảnh để chọn tay |

`<mục tiêu>` là một id video (ví dụ `2026-11-23/cosmic-what-if__01-fell-into-a-black-hole`), một ngày (`2026-11-23`), hoặc `all`.

### Chạy dài (build nhiều video)

Build cả loạt mất nhiều giờ. Nên chạy nền và giữ máy không ngủ:

```bash
# macOS: giữ máy và màn hình không ngủ trong lúc build
nohup caffeinate -d -i npm run -s content -- build all > logs/build.log 2>&1 &
tail -f logs/build.log
```

Trên Windows, chỉnh *Settings → System → Power* để máy không ngủ, rồi chạy `npm run content -- build all` trong một cửa sổ PowerShell để riêng.

### Đăng video

1. Mở video trên `/content`, xem `final.mp4`, kiểm tra các cảnh có nhãn **Minh hoạ**/**AI**.
2. Tick **Đã duyệt ảnh**.
3. Lên YouTube Studio: tải `final.mp4`, thumbnail `thumbnail.png`, phụ đề `captions.srt`; dán tiêu đề/mô tả/tags (nút Copy trên trang).
4. Hẹn giờ **12:00 PM, múi giờ Eastern Time (New York)**.
5. Dán link video vào ô **Link sau khi đăng**.

---

## 12. Tuỳ chọn nâng cao (biến môi trường)

Đặt trước lệnh (macOS/Linux), ví dụ `REVOICE=1 npm run content -- voice 2026-11-23`. Trên Windows PowerShell: `$env:REVOICE=1; npm run content -- voice 2026-11-23`.

| Biến | Tác dụng |
|---|---|
| `PIXABAY_API_KEY=…` (trong `.env`) | Thêm nguồn ảnh đời thường miễn phí Pixabay |
| `CLIP=0` | Tắt tự chọn ảnh bằng CLIP |
| `ILLUSTRATE=0` | Tắt tranh minh hoạ ghép từ emoji |
| `AI_IMAGES=1` | **Bật** vẽ ảnh AI (Z-Image-Turbo). Nặng: mỗi ảnh 30–120 giây, cần RAM ≥ 16 GB |
| `REFETCH=1` | Lấy lại ảnh cho **mọi** cảnh (bỏ ảnh cũ) |
| `REVOICE=1` | Tạo lại giọng đọc kể cả khi đã có `voice.mp3` |
| `VOICE=am_fenrir` | Đổi giọng Kokoro cho lần chạy này. Giọng nam: `am_michael`, `am_fenrir`, `am_puck`; giọng nữ: `af_heart`, `af_bella`, `af_nicole` |
| `SPEED=1.1` | Tốc độ đọc (1.0 = bình thường) |

Giọng mặc định của từng kênh nằm ở `content-tools/lib/channels.js` (`ttsVoice`, `ttsSpeed`).

---

## 13. Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách sửa |
|---|---|
| `command not found: node` | Chưa cài Node hoặc chưa mở lại Terminal. macOS: `brew link --overwrite node@22`. Kiểm tra `which node` |
| Giao diện `/content` trống, không có video | Cổng lệch: `PORT` trong `.env` khác `NEXT_PUBLIC_API_URL` trong `frontend/.env`. Sửa cho trùng rồi chạy lại `npm run dev` |
| `Chưa cài Kokoro (.venv-tts)` | Chạy `npm run content:setup -- tts` |
| `content:setup` báo cần Python 3.12 | macOS: `brew install python@3.12`. Windows: `winget install Python.Python.3.12` rồi mở lại PowerShell |
| Lỗi `No such filter: drawtext` / `subtitles` | Bình thường, tool không dùng 2 bộ lọc này. Nếu render vẫn lỗi, xem dòng lỗi phía trên |
| `Page.captureScreenshot timed out` | Chrome bị treo khi máy tắt màn hình. Chạy build bằng `caffeinate -d -i` (macOS), không để máy ngủ, rồi chạy lại lệnh `build`; bước đã xong sẽ được bỏ qua |
| `build` dừng với `Còn thiếu ảnh cảnh …` | Không tìm được ảnh nào. Kiểm tra mạng; hoặc ghim ảnh tay (`content:search`) hoặc thêm `"icons": [...]` cho cảnh đó trong `script.json` (xem `.claude/skills/source-visuals/SKILL.md`) |
| Openverse báo `HTTP 403` | Bị giới hạn lượt truy vấn, đợi vài phút rồi chạy lại. Tool vẫn lấy được ảnh từ Commons và NASA |
| Phụ đề lệch với giọng đọc | Kịch bản đã sửa sau khi tạo giọng. Chạy `REVOICE=1 npm run content -- voice <id>` |
| Hết dung lượng ổ | Xoá `preview.mp4` của video đã duyệt (dựng lại được); dọn `~/.cache/huggingface` nếu đã bật rồi tắt vẽ ảnh AI |
| Windows: `npm run dev` lỗi `'.' is not recognized` | Dùng `npm run dev:all` (xem mục 9) |
| Vẽ ảnh AI trên Windows lỗi | Phần này chưa được thử. Cần GPU NVIDIA ≥ 12 GB VRAM và `nvidia-smi` chạy được; nếu không, cứ để `AI_IMAGES` tắt |

---

## 14. Lưu ý bảo mật

- **Không commit** `.env`, `tool_ytb.db`, `browser-profiles/`, cookie, file CSV tài khoản. Mọi file này đã có trong `.gitignore`.
- Không đưa mật khẩu, mã 2FA, API key vào code, kịch bản hay tài liệu.
- Ảnh chỉ dùng giấy phép được phép: NASA/Public Domain, CC0, CC BY (có ghi công, tool tự ghi), Pixabay, Fluent Emoji (MIT). Không tự thêm ảnh tải từ Google Images.
- Kênh **Inside Your Body** luôn phải có câu miễn trừ y tế trong mô tả (tool tự kiểm tra bằng lệnh `check`).

---

*Tài liệu cho Claude Code ở máy mới: `CLAUDE.md` và các skill trong `.claude/skills/` đều nằm trong repo, nên máy mới tự có hướng dẫn cho Claude.*
