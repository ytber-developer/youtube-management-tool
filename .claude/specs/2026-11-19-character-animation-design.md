# Hoạt hình nhân vật cho 2 kênh — thiết kế

## Mục tiêu
Chuyển cả 2 kênh (Cosmic What If, Inside Your Body) từ "slide ảnh + zoom" sang **hoạt hình nhân vật vẽ tay**: một nhân vật chính đóng vai "bạn" trong mọi tập. Video vẽ hoàn toàn bằng code (canvas trong Chrome, ffmpeg ghép) — không ảnh stock, không lo giấy phép, không mô hình AI, render ~1 s/1 s video.

## Quyết định của người dùng (2026-11-19)
- **1 nhân vật gốc**, đổi màu áo theo kênh: cam `#ffb347` (Cosmic), xanh ngọc `#2ec4b6` (Body).
- Phong cách: vẽ tay nét đen dày, đầu tròn to, thân nhỏ, mắt chấm, áo mảng màu. **Không sao chép** nhân vật iStock người dùng gửi (ekapanova) — chỉ lấy tinh thần chung; chi tiết (tóc, tỉ lệ, phụ kiện, màu) phải khác.
- **Toàn bộ hoạt hình** (không trộn ảnh thật).
- Đổi sang hoạt hình **mọi video từ 2026-11-25** (24 video đã dựng theo kiểu cũ). 23–24/11 giữ nguyên (đã đăng/đã hẹn).
- **40 video mới**: 20/kênh, **6–8 phút** (~980–1300 từ ở 163 wpm), đăng 1 video/ngày/kênh từ **2026-12-07 đến 2026-12-26**.

## Cách làm (đã thử bằng spike black-hole 30 s)
- `content-tools/anim/`: nhân vật có khớp xương (đầu, thân áo, 2 tay 2 đoạn, 2 chân 2 đoạn, bàn tay, giày), thư viện **tư thế** + **hành động** (nội suy theo thời gian), **biểu cảm**, **đạo cụ** (Fluent Emoji MIT, vẽ dạng ảnh), **phông nền** theo kênh, **chữ lớn**/con số, **camera** (zoom/pan nhẹ), phụ đề.
- Mỗi cảnh trong `script.json` có `anim` ngắn gọn thay cho `visual` ảnh, ví dụ:
  `{"action": "float-toward", "props": [{"icon": "hole", "at": "right"}], "face": "worry", "text": "SPAGHETTIFICATION"}`
- Build cho video `style: "anim"`: giọng Kokoro → canh câu (silencedetect + DP có sẵn) → vẽ khung hình theo mốc thời gian từng cảnh → ffmpeg ghép giọng + phụ đề. Thumbnail: nhân vật + chữ to.

## Không làm
- Không dùng nhân vật/hình có bản quyền của người khác; không dùng ảnh stock trong video hoạt hình.
- Không lách bản quyền nhạc (nhạc nền nếu có: YouTube Audio Library / Pixabay / CC BY).
- Không sản xuất "một khuôn thay chữ": mỗi tập có nội dung, hành động, đạo cụ riêng (chính sách inauthentic content của YouTube).

## Còn để người làm quyết
Danh sách hành động cụ thể, bố cục cảnh, cách chọn đạo cụ tự động khi kịch bản không ghi rõ.
