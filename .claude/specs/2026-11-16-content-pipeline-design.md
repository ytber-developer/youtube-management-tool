# Content pipeline: slide videos for 2 YouTube channels

Ngày: 2026-11-16 · Trạng thái: chờ duyệt

## Mục tiêu và lý do
- Sản xuất video khoa học dạng slide cho 2 kênh tiếng Anh nhắm thị trường Mỹ: **Cosmic What If** (vũ trụ) và **Inside Your Body** (cơ thể người).
- Đợt đầu: 14 video mỗi kênh, đăng 1 video/ngày/kênh từ **Thứ Hai 23/11/2026** đến 06/12/2026. Video sau dài hơn video trước (1:00 → ~9:40).
- Mọi thứ được làm sẵn **trừ giọng đọc**: hằng ngày người dùng tự lồng tiếng trên ElevenLabs (máy Mac), chạy 1 lệnh để ra video cuối, rồi upload.
- Biến quy trình thành lệnh + skill để các phiên Claude sau làm tiếp mà không phải suy luận lại (tiết kiệm token).

## Ngoài phạm vi
- Tự tạo giọng đọc qua API (cần gói ElevenLabs trả phí + API key; để sau, có chỗ gắn sẵn).
- Tự upload lên YouTube (tool đã có upload campaign; nối sau).
- Chạy pipeline trên máy Windows.

## Điều không được xảy ra
- Dùng ảnh sai giấy phép (chỉ NASA, Public Domain, CC0, CC BY, Pixabay License) hoặc ảnh sai chủ đề.
- Sai kiến thức khoa học; kênh Inside Your Body đưa lời khuyên y tế.
- Đưa file media nặng (ảnh, slide, mp3, mp4) vào git.
- Lộ API key.

## Cấu trúc
```
content/
  schedule.json                               # ngày → [video của từng kênh]
  2026-11-23/<channel>__<NN>-<slug>/
    script.json        (git)   nguồn gốc: lời đọc theo cảnh, headline, visual, nguồn
    credits.json       (git)   nguồn + giấy phép từng ảnh
    narration.txt      (git)   lời đọc, các cảnh cách nhau 1 dòng trống → dán vào ElevenLabs
    metadata.md        (git)   tiêu đề, mô tả (kèm nguồn + ghi công ảnh), tag, giờ đăng gợi ý
    images/*.svg       (git)   sơ đồ vẽ tay
    images/*.jpg, slides/, thumbnail.png, preview.mp4   (gitignore — dựng lại được)
    voice.mp3, final.mp4, captions.srt                  (gitignore — người dùng tạo hằng ngày)
content-tools/                                # CLI Node, chạy bằng npm run content:*
.claude/skills/                               # skill cho các phiên Claude sau
```

## Lệnh (`npm run content:<lệnh> -- <đường dẫn | ngày>`)
| Lệnh | Việc |
|---|---|
| `check` | Kiểm tra script.json theo quy tắc (số từ ±7%, độ dài cảnh, headline, outro, nguồn, chữ số trong lời đọc…) |
| `images` | Lấy ảnh theo `visual` (NASA / Pixabay / Wikimedia khoa học), ghi credits.json; ảnh đã duyệt được ghim bằng id |
| `slides` | Dựng slide 1920×1080 + contact.jpg để duyệt |
| `thumb` | Dựng thumbnail 1280×720 |
| `package` | Sinh narration.txt + metadata.md |
| `preview` | Video chưa lồng tiếng, thời lượng ước tính 163 từ/phút, phụ đề theo ước tính |
| `render` | Có voice.mp3 → canh cảnh/câu theo khoảng lặng (quy hoạch động khớp câu với khoảng lặng), ra final.mp4 + captions.srt |

## Trang điều khiển trong tool (`/content`)
- **Danh sách**: lọc theo kênh/trạng thái; mỗi video hiện ngày đăng, kênh, số thứ tự, tiêu đề, thời lượng, 7 bước tiến độ (Kịch bản → Ảnh → Duyệt ảnh → Slide → Preview → Lồng tiếng → Video cuối) và cờ "Đã đăng". Trạng thái **tính từ file trên đĩa** (không lưu riêng, không lệch): `check` đạt, đủ jpg/svg cho mọi cảnh, `review.json` (duyệt ảnh, đã đăng + link), slides mới hơn đầu vào, có preview.mp4 / voice.mp3 / final.mp4.
- **Chi tiết video**: lưới slide (ảnh thiếu/lỗi viền đỏ), nút Lấy lại ảnh / Dựng slide / Dựng preview / Đã duyệt ảnh, copy lời đọc, **kéo thả voice.mp3 → tự render video cuối**, xem preview/final, tải captions.srt, copy tiêu đề/mô tả/tag, đánh dấu đã đăng kèm link.
- **Backend**: route `/api/v1/content` (list, detail, file tĩnh trong content/, tác vụ) gọi lại đúng code của `content-tools`; tác vụ chạy tuần tự trong hàng đợi trong tiến trình, frontend hỏi tiến độ định kỳ. API chỉ đọc/ghi bên trong `content/`, tên video được kiểm tra theo danh sách thật, không chạy lệnh tùy ý.

## Cách canh thời gian khi có giọng đọc
ffmpeg `silencedetect` tìm mọi khoảng lặng. Biết số câu và độ dài ký tự từng câu, chọn N−1 khoảng lặng (theo đúng thứ tự) sao cho mốc kết thúc câu gần nhất với mốc dự kiến tỉ lệ theo số ký tự (quy hoạch động, phạt lệch bình phương, thưởng khoảng lặng dài ở ranh giới cảnh). Nếu có `ELEVENLABS_API_KEY` thì dùng timestamps của API thay thế.

## Các phương án đã cân nhắc
- **Media trong git** (bị loại: repo phình vài GB) / **Git LFS** (bị loại: thêm hạ tầng không cần vì chỉ dùng trên 1 máy) / **chọn: media gitignore, chỉ track nguồn gốc** — media dựng lại được từ script + id ảnh đã ghim.
- **Canh thời gian bằng Whisper** (bị loại: cài nặng) / **API ElevenLabs** (chưa có key) / **chọn: khoảng lặng + quy hoạch động**, đã chứng minh chính xác ở video mẫu (17 câu ↔ 16 khoảng lặng).

## Do người dùng quyết
- Máy lồng tiếng: Mac này. Ảnh đời thường kênh 2: Pixabay (người dùng lấy key). Ngày bắt đầu: 23/11/2026.

## Để lại cho người dựng
- Ảnh/sơ đồ nào được ghim, chỉnh vị trí khung ảnh từng cảnh.
- Phong cách thumbnail cụ thể (theo màu kênh, chữ ≤ 4 từ).
