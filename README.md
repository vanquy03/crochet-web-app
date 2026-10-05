# Tiệm Len — Crochet Web App

Cửa hàng len với frontend HTML/CSS/JavaScript thuần, backend **Node.js + Express + SQLite**. Có giỏ hàng, đặt COD, tra cứu đơn và trang quản trị sản phẩm, tồn kho, ảnh, đơn hàng, phí giao và tài khoản.

## Chạy local

Cần **Node.js 24 trở lên**.

```sh
npm ci
npm run admin:create
npm run dev
```

Tạo admin bằng email và mật khẩu riêng qua terminal, sau đó mở:

- Cửa hàng: http://localhost:3000
- Quản trị: http://localhost:3000/admin/

Không có mật khẩu mặc định. Database tự tạo tại data/shop.sqlite, ảnh tại data/uploads. Sản phẩm mẫu có tồn kho 0; nhập sản phẩm, giá và số lượng thật trong trang quản trị trước khi bán.

## Cấu trúc

```text
src/
  index.html             # Cửa hàng, giỏ và checkout
  admin/                 # Giao diện quản trị
  js/
    main.js              # Tải dữ liệu API, khởi tạo giao diện
    config/              # Trạng thái cấu hình shop từ database
    data/                # Danh mục API và mẫu trưng bày
    components/          # Minh họa / ảnh sản phẩm
    features/            # Catalog, cart, checkout, order, contact
    services/            # API client
    utils/               # DOM, escape HTML, localStorage
  styles/
server/
  index.js               # Khởi động, cấu hình runtime
  app.js                 # Express middleware và đăng ký API
  database.js            # SQLite, migration, transaction
  routes/                # API công khai, xác thực, sản phẩm, đơn và cài đặt
  migrations/            # Schema database
  security.js            # Hash mật khẩu, cookie và token
  validation.js          # Kiểm tra dữ liệu vào
  services/orders.js     # Đặt đơn, tồn kho và trạng thái
scripts/                 # Build, kiểm tra, tạo admin, backup
tests/                   # Kiểm tra API với database thật và frontend
docs/                    # Vận hành, triển khai, API
dist/                    # Bản frontend do build tạo
data/                    # Runtime riêng tư, không commit
```

Chỉ sửa frontend trong src; chạy build cập nhật dist. Server phục vụ src ở development và dist ở production. Prettier và EditorConfig dùng UTF-8, 2 spaces, LF. package-lock.json khóa phiên bản thư viện.

## Lệnh

| Lệnh                 | Chức năng                                   |
| -------------------- | ------------------------------------------- |
| npm run dev          | Server development, tự restart khi đổi file |
| npm start            | Server theo .env / biến môi trường          |
| npm run admin:create | Tạo admin, nhập mật khẩu qua terminal       |
| npm run format       | Format mã và tài liệu                       |
| npm run format:check | Kiểm tra format                             |
| npm run check        | Kiểm tra cú pháp, import, tài nguyên HTML   |
| npm test             | Kiểm tra API, database và frontend          |
| npm run build        | Sinh frontend dist                          |
| npm run db:backup    | SQLite online backup                        |

## Chức năng thực tế

- Sản phẩm và cài đặt shop đọc/ghi SQLite; thêm, sửa, ẩn, tải ảnh sản phẩm.
- Khách đặt COD với tên, điện thoại, địa chỉ, lời nhắn; lưu đơn và cấp mã tra cứu riêng.
- Giá, phí giao và tồn kho được server kiểm tra; đặt đơn và giữ hàng cùng transaction.
- Gửi lại cùng yêu cầu không tạo đơn trùng. Hủy đơn hoàn tồn một lần; sửa tồn kho có kiểm tra version.
- Admin đăng nhập bằng cookie HttpOnly, mật khẩu scrypt hash, CSRF, giới hạn thử login, đổi mật khẩu và thu hồi phiên.
- Đơn có luồng chờ xác nhận → xác nhận → giao → hoàn tất; đánh dấu thu tiền và thống kê doanh thu đã hoàn tất.
- Lưu localStorage cho giỏ; không lưu thông tin người nhận trong đó. Nội dung đưa vào HTML được escape.

## Vận hành và triển khai

Đọc [hướng dẫn vận hành](docs/operations.md) để chuẩn bị bán hàng, chỉnh phí giao, sao lưu và triển khai Docker/Node.js. Đọc [API](docs/api.md) khi cần tích hợp thêm.

Ứng dụng cần một server Node.js với ổ lưu trữ bền vững. Dockerfile và compose.yaml đã có; đặt HTTPS trước khi dùng production. Bản Sites tĩnh là bản xem giao diện, không chạy backend SQLite. Backend chưa được triển khai lên máy chủ Internet trong phiên này.

Phạm vi hiện tại là COD; shop xác nhận khách và xử lý giao hàng thủ công. Chưa tích hợp thanh toán online, email/SMS hay API hãng vận chuyển. Dữ liệu mẫu cần thay bằng thông tin thật. Kiểm tra tự động không thay thế kiểm tra trực quan trên thiết bị thật.

Thiết kế tham khảo cách tổ chức sản phẩm của [amirisu](https://shop.amirisu.com/) và [毛糸ピエロ](https://www.rakuten.co.jp/gosyo/), không dùng mã hoặc hình của hai website này.
