# Tạo Icons cho Extension

## Cách 1: Sử dụng Online Tool (Đơn giản nhất)

1. Vào trang: https://www.favicon-generator.org/ hoặc https://realfavicongenerator.net/
2. Upload file `icon.svg` hoặc bất kỳ hình ảnh nào (khuyến nghị 512x512px)
3. Tải về các kích thước: 16x16, 48x48, 128x128
4. Đổi tên và copy vào thư mục `icons/`

## Cách 2: Sử dụng ImageMagick (Command line)

```bash
# Cài đặt ImageMagick
brew install imagemagick  # macOS

# Chuyển đổi từ SVG
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

## Cách 3: Sử dụng Figma/Canva/Photoshop

1. Tạo design 128x128px
2. Export ở 3 kích thước: 16x16, 48x48, 128x128
3. Lưu vào thư mục `icons/`

## Khuyến nghị thiết kế:

- **Màu chủ đạo**: Facebook blue (#1877f2)
- **Biểu tượng**: Video/Reel icon với play button
- **Style**: Flat, modern, minimal
- **Background**: Có thể trong suốt hoặc màu gradient

## Icon hiện tại

File `icon.svg` đã được tạo với:
- Background gradient màu Facebook
- Icon video/reel với play button
- Kích thước 128x128px

Bạn có thể chỉnh sửa SVG này hoặc tạo mới theo ý muốn!
