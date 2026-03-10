# 🔧 Xử lý lỗi thường gặp

## ❌ Lỗi: "Could not establish connection. Receiving end does not exist."

**Nguyên nhân:** Content script chưa được load vào trang Facebook.

**Cách khắc phục:**
1. **Refresh trang Facebook** (nhấn F5 hoặc Cmd+R)
2. Đợi trang load xong hoàn toàn
3. Mở extension và click "Bắt đầu scrape" lại

**Hoặc:**
1. Tắt extension đi
2. Bật lại extension
3. Refresh trang Facebook
4. Thử lại

---

## ❌ Lỗi: "Vui lòng mở trang Facebook Reels trước!"

**Nguyên nhân:** Bạn chưa vào đúng trang Reels.

**Cách khắc phục:**
1. Vào trang Facebook Page bạn muốn scrape
2. Click vào tab **"Reels"** của page đó
3. URL phải có dạng: `facebook.com/pagename/reels`
4. Thử lại extension

---

## ❌ Lỗi: Không tải được reels

**Nguyên nhân:** 
- Trang chưa load xong
- Không có reels trên page
- Facebook thay đổi cấu trúc HTML

**Cách khắc phục:**
1. **Scroll thủ công** một chút trước để load reels
2. Đợi một vài giây cho reels xuất hiện
3. Thử giảm số lượng reels cần lấy
4. Kiểm tra xem page có reels không

---

## ❌ Extension không hiện lên

**Nguyên nhân:** Extension chưa được cài đúng.

**Cách khắc phục:**

**Chrome/Edge:**
1. Vào `chrome://extensions/`
2. Bật **"Developer mode"** (góc trên phải)
3. Click **"Load unpacked"**
4. Chọn thư mục `browser-extension`
5. Kiểm tra extension có màu xanh (enabled)

**Firefox:**
1. Vào `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"**
3. Chọn file `manifest.json`
4. Extension sẽ xuất hiện trong danh sách

---

## ❌ CSV không tải xuống

**Nguyên nhân:** 
- Browser chặn download
- Quyền download chưa được cấp

**Cách khắc phục:**
1. Kiểm tra thanh download của browser
2. Cho phép download từ extension trong settings
3. Kiểm tra thư mục Downloads
4. Thử lại

---

## 💡 Tips để scrape tốt hơn

1. **Đăng nhập Facebook** trước khi dùng extension
2. **Scroll thủ công** 1-2 lần để load reels trước
3. **Đợi page load xong** trước khi click scrape
4. **Không đóng tab** khi extension đang chạy
5. **Dùng số lượng vừa phải** (50-100 reels) để tránh bị Facebook phát hiện
6. **Refresh trang** nếu gặp lỗi bất kỳ

---

## 🆘 Vẫn không được?

1. **Mở Developer Console:**
   - Chrome: `Ctrl+Shift+J` (Windows) hoặc `Cmd+Option+J` (Mac)
   - Firefox: `Ctrl+Shift+K` (Windows) hoặc `Cmd+Option+K` (Mac)

2. **Kiểm tra log errors** và gửi cho developer

3. **Thử lại với page khác** để xem có phải lỗi của page cụ thể không

4. **Cài lại extension** từ đầu:
   - Gỡ extension hiện tại
   - Refresh browser
   - Cài lại
   - Refresh trang Facebook
   - Thử lại

---

## 📝 Báo lỗi

Nếu vẫn gặp vấn đề, hãy cung cấp:
- Trình duyệt đang dùng (Chrome/Firefox/Edge)
- URL của Facebook Page
- Screenshot lỗi
- Log từ Console (nếu có)

Chúc bạn scrape thành công! 🎉
