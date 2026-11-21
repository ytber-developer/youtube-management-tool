---
name: fb-knowledge-page
description: Use when working on the Vietnamese Facebook knowledge page (kênh chia sẻ kiến thức tổng hợp, mục tiêu bật kiếm tiền) — choosing topics, writing Reels/ảnh scripts, captions, posting schedule, or answering "what are the rules for this page". Read before the fb-script-writer, fb-fact-checker and fb-planner agents do their work.
---

# Page kiến thức tổng hợp (Facebook, tiếng Việt)

Một page duy nhất, khán giả **Việt Nam**, nội dung **kiến thức đa chủ đề** (khoa học, lịch sử, cơ thể, động vật, địa lý, tâm lý, đời sống...). Mục tiêu: đủ điều kiện **bật kiếm tiền** (Content Monetization của Meta) càng sớm càng tốt.

Tên page: **Hôm Nay Mới Biết**. Avatar, bio: chưa làm. Chi tiết ở mục "Thông tin page" bên dưới.

## Nguyên tắc để qua được kiểm duyệt kiếm tiền

- **Nội dung gốc**: kịch bản tự viết, lời đọc tự làm, ảnh có giấy phép rõ. Không đăng lại video/ảnh của người khác, kể cả ghi nguồn. Không ghép clip TikTok/YouTube.
- **Ảnh**: chỉ dùng public domain / CC (Wikimedia Commons, NASA, Openverse, Pixabay) và ghi credits ở phần comment hoặc cuối caption.
- **Không clickbait giả**: hook gây tò mò nhưng phần sau phải trả lời đúng điều đã hứa.
- **Không chủ đề cấm quảng cáo**: chính trị đương đại, tranh chấp lãnh thổ, tôn giáo gây tranh cãi, y tế chữa bệnh, bạo lực máu me, tin đồn người thật.
- **Không bịa số liệu**. Mỗi con số/ngày tháng phải có nguồn (xem fb-fact-checker). Chưa chắc thì viết "khoảng", "các nhà khoa học cho rằng".
- Đăng đều đặn, không spam; không mua follower, không mời hàng loạt.

## Mảng nội dung (xoay vòng để "lộn xộn" mà vẫn có nhận diện)

| Mảng | Ví dụ hook |
|---|---|
| Khoa học đời thường | "Vì sao bầu trời màu xanh mà hoàng hôn lại đỏ?" |
| Cơ thể người | "Điều gì xảy ra với cơ thể khi bạn nhịn ngủ 24 giờ?" |
| Lịch sử thế giới (cổ trung đại) | "Đế chế Mông Cổ lớn đến mức nào?" |
| Động vật / thiên nhiên | "Con vật nào ngủ ít nhất?" |
| Địa lý / vũ trụ | "Nếu đào xuyên Trái Đất thì sao?" |
| Tâm lý / thói quen | "Vì sao ta cứ trì hoãn?" |

Quy tắc xoay: không đăng cùng một mảng 3 lần liên tiếp. Giữ **một công thức chung** để page có nhận diện: hook câu hỏi → 3 ý ngắn → một sự thật bất ngờ → câu chốt + lời mời theo dõi.

## Định dạng

- **Reels dọc 9:16, 30–60 giây** (chính). Hook trong 3 giây đầu, phụ đề lớn, câu chốt có lời mời theo dõi.
- **Ảnh + 1 sự thật** (phụ): ảnh đẹp kèm caption 2–4 câu. Có thể làm carousel 4–6 ảnh.
- Nhịp ban đầu: 1 Reels + 1 ảnh mỗi ngày, giờ cố định (gợi ý 19:30–21:00 giờ VN, user có thể đổi sau khi xem Insights).

## Văn phong

- Tiếng Việt tự nhiên, câu ngắn, gần gũi, xưng "bạn" / "chúng ta". Không dịch word-for-word từ tiếng Anh.
- Số viết bằng chữ khi đọc thành tiếng nếu TTS đọc sai; chữ hiển thị trên phụ đề có thể viết số.
- Reels: 80–150 chữ cho 30–60 giây (khoảng 2,5 từ/giây, sẽ chỉnh khi chọn xong giọng TTS).

## Quy trình

1. **fb-planner** lên lịch chủ đề (xoay mảng, tránh trùng).
2. **fb-script-writer** viết kịch bản + caption + hashtag.
3. **fb-fact-checker** kiểm từng con số/khẳng định, trả về danh sách nguồn hoặc yêu cầu sửa.
4. Chỉ sau khi fact-check xong mới làm video/ảnh.

Nơi lưu: `content-vi/<YYYY-MM-DD>/NN-<slug>.md` (một file mỗi bài: hook, kịch bản, caption, hashtag, nguồn, nguồn ảnh). Dựng Reels bằng bộ công cụ riêng trong `content-vi/tools/` (không dùng `content-tools/`):
- `content-vi/<date>/illustrations.js` vẽ minh họa SVG từng cảnh (helpers trong `content-vi/tools/draw.js`: nền, mặt trời, mây, nhân vật doodle `person`, mặt đất, chấm tán xạ, badge chữ, logo bóng đèn, cảnh kết `outro`) → `images/sN.png` 1080×1920. **Luôn vẽ, không dùng ảnh tư liệu** trừ khi bài cần ảnh thật (chân dung, bản đồ) và đã rõ giấy phép.
- `content-vi/<date>/reel.json` (`tts`, `voice`, `scenes[{img, narration, caption?, fit?}]`), rồi `node content-vi/tools/make-reel.js content-vi/<date>` → `reel.mp4` (giọng VieNeu qua `content-tools/tts/vieneu_tts.py`, zoom chậm, phụ đề cháy, cảnh kết đặt `"caption": false`).
- Vùng an toàn: phụ đề ở khoảng y 1150–1360; nhân vật/điểm nhấn không đặt ở đó; chừa mép phải ~110px cho nút của Facebook.

## Thông tin page

- Tên: **Hôm Nay Mới Biết** (đổi từ "Mỗi Ngày Một Điều Hay" ngày 2026-11-21)
- Slogan gợi ý: "Mỗi ngày biết thêm một điều mới."
- Lời mời cuối Reels: "Theo dõi Hôm Nay Mới Biết để mỗi ngày biết thêm một điều mới."
- Link: _chưa có_
- Giọng đọc (TTS): **VieNeu-TTS v3 Turbo, giọng "Hải Đăng"** (nam, Bắc, tự nhiên; offline, `.venv-tts-vi`). Mẫu các giọng khác: `downloads/tts-vi-samples/`.

## Tiến độ (cập nhật 2026-11-21)

- 30 Reels (23/11 → 22/12) đã viết, kiểm chứng và dựng xong (`content-vi/<ngày>/reel.mp4`). Các bài ảnh (30 bài) chưa làm vì chưa có công cụ tạo ảnh.
- Quy trình mỗi bài: `fb-script-writer` → `fb-fact-checker` (bắt buộc sửa lời cho khớp nguồn đã mở) → vẽ `illustrations.js` + `reel.json` (agent general-purpose, không chạy make-reel) → dựng tuần tự bằng `content-vi/tools/render-queue.sh <ngày>…` (một video một lúc; `FORCE=1` để dựng lại).
- Bài nguồn yếu cần người xem lại trước khi đăng: 07/12 (la bàn: chỉ Wikipedia/Hakai), 10/12 (số liệu 81/75/61/40% chỉ từ bản tin), 04/12, 13/12 (ý "chữ rời Đông Á" chưa có nguồn gốc), 19/12 (5.000 km chỉ qua UN Tourism), 22/12 (số ở caption chỉ từ bản sao chương sách).
