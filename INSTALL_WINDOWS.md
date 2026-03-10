# 🖥️ Hướng dẫn cài đặt Tool trên Windows

## 1. Cài đặt Node.js
- Truy cập https://nodejs.org/
- Tải bản LTS và cài đặt như phần mềm bình thường
- Kiểm tra cài đặt:
  ```
  node -v
  npm -v
  ```

## 2. Cài đặt MySQL
- Truy cập https://dev.mysql.com/downloads/installer/
- Tải và cài đặt MySQL Community Server
- Trong quá trình cài đặt, sẽ có bước **set password cho user root**:
  - Chọn chế độ "Standalone MySQL Server" hoặc "Developer Default"
  - Khi đến bước "Authentication Method", chọn "Use Legacy Authentication Method" nếu cần cho các tool cũ
  - Nhập mật khẩu cho user `root` (ví dụ: `MyStrongPassword123!`)
  - Ghi nhớ mật khẩu này để dùng cho biến môi trường
- Sau khi cài xong, có thể đổi lại mật khẩu bằng lệnh:
  ```sql
  ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';
  FLUSH PRIVILEGES;
  ```
- Để login MySQL lần đầu:
  - Mở Command Prompt, chạy:
    ```
    mysql -u root -p
    ```
  - Nhập mật khẩu vừa set ở trên

## 3. Clone source code
- Mở Command Prompt hoặc PowerShell
- Di chuyển đến thư mục bạn muốn lưu source
- Chạy lệnh:
  ```
  git clone https://github.com/[YOUR_REPO]/tool-manager-ytb-acc.git
  cd tool-manager-ytb-acc
  ```

## 4. Cài đặt các package Node.js
- Chạy lệnh:
  ```
  npm install
  ```

## 5. Tạo file biến môi trường `.env` cho Backend (BE)
- Tạo file `.env` trong thư mục gốc của project (BE)
- Ví dụ nội dung:
  ```
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=your_mysql_password
  DB_NAME=tool_manager
  NODE_ENV=development
  PORT=3000
  # Thêm các biến khác nếu có (ví dụ: JWT_SECRET, REDIS_URL...)
  ```

## 5.1. Tạo file biến môi trường `.env` cho Frontend (FE) nếu có
- Nếu có thư mục `frontend/`, vào đó và tạo file `.env`
- Ví dụ nội dung:
  ```
  REACT_APP_API_URL=http://localhost:3000/api
  REACT_APP_ENV=development
  # Thêm các biến khác nếu FE cần
  ```

## 6. Khởi tạo database MySQL và migrate
- Đăng nhập MySQL bằng command line hoặc MySQL Workbench
- Tạo database:
  ```sql
  CREATE DATABASE tool_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
- Nếu project có migration (thường là thư mục `migrations/` hoặc dùng Sequelize/Knex):
  - Chạy lệnh migrate (ví dụ với Sequelize):
    ```
    npx sequelize-cli db:migrate
    ```
  - Hoặc với Knex:
    ```
    npx knex migrate:latest
    ```
  - Nếu dùng script SQL, import file đó vào database

## 7. Chạy ứng dụng Backend (BE)
- Chạy lệnh:
  ```
  npm start
  ```
  hoặc
  ```
  node src/index.js
  ```
  (Tùy theo cấu trúc project)

## 7.1. Chạy ứng dụng Frontend (FE) nếu có
- Vào thư mục `frontend/`
- Chạy lệnh:
  ```
  npm install
  npm start
  ```
- FE sẽ chạy ở port 3001 hoặc 3000 (tùy config), truy cập: `http://localhost:3001` hoặc `http://localhost:3000`

## 8. Cài đặt browser extension (nếu dùng)
- Mở Chrome, truy cập `chrome://extensions/`
- Bật **Developer mode**
- Click **Load unpacked**
- Chọn thư mục `browser-extension` trong source

## 9. Kiểm tra hoạt động
- Truy cập `http://localhost:3000` (hoặc port bạn đã cấu hình)
- Kiểm tra log terminal để xem ứng dụng đã kết nối database thành công

---

## ❗ Lưu ý
- Nếu gặp lỗi về quyền hoặc port, hãy kiểm tra lại file `.env` và cấu hình MySQL
- Đảm bảo MySQL đang chạy trước khi start app
- Nếu dùng các service khác (Redis, RabbitMQ...), cài đặt tương tự
- Nếu migrate lỗi, kiểm tra lại kết nối DB và quyền user
- Nếu FE không kết nối được BE, kiểm tra biến API_URL trong `.env` của FE

---

Chúc bạn cài đặt thành công! 🚀
