# Tiệm Len

Website bán len tông hồng nhạt, phong cách Nhật, viết bằng HTML, CSS và JavaScript thuần. Không có framework hoặc thư viện chạy trên website. Node.js chỉ dùng cho công cụ phát triển; Prettier chỉ dùng để format mã.

## Bắt đầu

Cần Node.js 20 trở lên.

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:5173. Dùng server local vì JavaScript modules không chạy ổn định khi mở bằng file://. Nhấn Ctrl+C để dừng server. Có thể đổi cổng bằng biến môi trường PORT.

## Cấu trúc dự án

```text
tiem-len/
├── src/
│   ├── index.html             # Cấu trúc trang và nội dung tĩnh
│   ├── styles/
│   │   ├── base.css           # Bố cục và thành phần giao diện
│   │   └── theme.css          # Màu hồng, trang trí và responsive bổ sung
│   └── js/
│       ├── main.js            # Khởi tạo các tính năng
│       ├── config/shop.js     # Tên và kênh liên hệ của shop
│       ├── data/products.js   # Danh mục sản phẩm
│       ├── components/artwork.js # Minh họa SVG
│       ├── features/          # catalog, cart, order, contact
│       └── utils/             # DOM, tiền tệ, thông báo và storage
├── scripts/                   # Server local, build và kiểm tra
├── tests/                     # Kiểm tra logic và tích hợp module
├── dist/                      # Bản triển khai được sinh từ src
├── .openai/hosting.json       # Định danh và cấu hình Sites
├── .editorconfig              # UTF-8, 2 spaces, LF
├── .prettierrc.json            # Quy tắc format chung
├── package.json
└── package-lock.json          # Khóa phiên bản công cụ
```

Chỉ chỉnh sửa trong src. Chạy build để cập nhật dist; dist được giữ trong Git để hosting static có thể triển khai trực tiếp. Không sửa file đầu ra bằng tay.

## Lệnh thường dùng

| Lệnh                 | Mục đích                                      |
| -------------------- | --------------------------------------------- |
| npm run dev          | Chạy website từ src                           |
| npm run format       | Format mã nguồn và tài liệu                   |
| npm run format:check | Kiểm tra format                               |
| npm run check        | Kiểm tra cú pháp, import và tài nguyên HTML   |
| npm test             | Chạy kiểm tra với Node.js test runner         |
| npm run build        | Sao chép mã nguồn thành bản static trong dist |

## Cập nhật nội dung

- src/js/config/shop.js: tên shop, Zalo, Facebook, email, điện thoại; chỉ điền kênh của bạn. Đổi demo thành false sau khi hoàn tất dữ liệu thật.
- src/js/data/products.js: tên, giá VND, loại, quy cách, màu. Mỗi sản phẩm có id duy nhất và ổn định vì giỏ hàng được lưu theo id.
- src/js/components/artwork.js: thay minh họa bằng ảnh sản phẩm thật khi có ảnh.
- src/index.html: câu chuyện shop, hướng dẫn mua, FAQ, giao hàng và đổi trả.
- src/styles/theme.css: màu sắc và phong cách của tiệm.

## Chức năng và luồng dữ liệu

main.js gọi các hàm init của từng tính năng. catalog đọc products và thêm hàng vào cart; cart quản lý số lượng và lưu localStorage qua utils/storage.js. order tạo danh sách từ giỏ hàng và lời nhắn; contact mở kênh nhận đơn được cấu hình.

Có tìm kiếm, lọc, sắp xếp giá, chi tiết, số lượng, giỏ hàng, sao chép và tải danh sách. Zalo/Facebook mở kênh liên hệ để khách dán danh sách; email mở trình soạn thư và khách tự gửi. Shop xác nhận tồn kho, phí giao và thanh toán qua liên hệ. Chưa có backend quản lý đơn hoặc thanh toán trực tuyến. Thông tin người mua không được lưu trong localStorage.

## Kiểm tra và triển khai

```sh
npm run format:check
npm run check
npm test
npm run build
```

Triển khai nội dung dist lên hosting static. Sites sử dụng cấu hình .openai/hosting.json. Giữ nguyên project_id khi cập nhật website hiện tại. Bản Sites đang riêng tư; cần đổi quyền truy cập trước khi cho khách ngoài xem.

Kiểm tra tự động không thay cho kiểm tra trực quan trên trình duyệt và thiết bị thật.

## Tham khảo

Tham khảo cách tổ chức sản phẩm của [amirisu](https://shop.amirisu.com/) và [毛糸ピエロ](https://www.rakuten.co.jp/gosyo/). Không dùng hình ảnh hoặc mã nguồn của các website này. Nội dung sản phẩm hiện là dữ liệu mẫu.
