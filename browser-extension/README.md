# Facebook Reels Scraper - Browser Extension

Extension để lấy tất cả link Reels từ Facebook Page và xuất ra file CSV.

## 🚀 Cài đặt

### Chrome/Edge:
1. Mở trình duyệt và vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **Load unpacked**
4. Chọn thư mục `browser-extension`
5. Extension đã sẵn sàng!

### Firefox:
1. Mở Firefox và vào `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Chọn file `manifest.json` trong thư mục `browser-extension`
4. Extension đã sẵn sàng!

## 📖 Cách sử dụng

1. **Đăng nhập Facebook** trên trình duyệt của bạn
2. **Vào trang Reels** của Facebook Page bạn muốn scrape
   - VD: `https://www.facebook.com/pagename/reels`
3. **⚠️ QUAN TRỌNG:** Nếu mới cài extension lần đầu, hãy **refresh trang** (F5)
4. **Click vào icon extension** trên thanh công cụ
5. **Nhập số lượng reels** muốn lấy (mặc định: 50)
6. **Click "Bắt đầu scrape"**
7. **Chờ extension scroll** và lấy dữ liệu (có thể mất vài phút)
8. **File CSV sẽ tự động tải xuống**

### 💡 Tips:
- Scroll thủ công 1-2 lần trước để load reels
- Đợi page load xong trước khi scrape
- Nếu gặp lỗi "Receiving end does not exist", hãy **refresh trang** và thử lại

## 📊 Định dạng CSV

File CSV sẽ có 3 cột:
- `STT`: Số thứ tự
- `Reel URL`: Link đầy đủ của reel
- `Reel ID`: ID của reel

Ví dụ:
```csv
"STT","Reel URL","Reel ID"
"1","https://facebook.com/reel/123456789","123456789"
"2","https://facebook.com/reel/987654321","987654321"
```

## ⚠️ Lưu ý

- Bạn phải **đăng nhập Facebook** trước khi sử dụng
- Extension chỉ hoạt động trên trang **facebook.com**
- Nên scroll thủ công một chút trước để load reels
- Số lượng reels lấy được phụ thuộc vào số lượng reels có sẵn trên page
- Extension sẽ tự động scroll và đợi load content
- **⚠️ Nếu gặp lỗi, hãy refresh trang Facebook (F5) và thử lại**

## 🐛 Gặp vấn đề?

Xem file [TROUBLESHOOTING.md](TROUBLESHOOTING.md) để biết cách khắc phục lỗi thường gặp.

## 🔧 Kỹ thuật

- Manifest V3 (Chrome/Edge/Firefox compatible)
- Không cần backend server
- Tận dụng session đã đăng nhập
- Auto-scroll thông minh
- Export CSV với UTF-8 BOM (hỗ trợ tiếng Việt)

## 📝 Giấy phép

MIT License
