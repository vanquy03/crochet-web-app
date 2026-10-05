# Tiệm Len
Website nhẹ bằng HTML, CSS và JavaScript thuần. Không cần npm hoặc bước build.

## Xem website
Mở dist/index.html trong trình duyệt. Sao chép clipboard hoạt động tốt nhất khi chạy qua HTTPS; nếu không được, dùng nút tải danh sách.

## Cập nhật shop
- dist/config.js: tên shop, số Zalo, Facebook, email và điện thoại. Chỉ điền kênh thật của bạn. Chuyển demo thành false khi hoàn tất nội dung thật.
- dist/app.js: danh sách products ở đầu file; sửa tên, loại, giá, màu và quy cách. Mỗi id phải duy nhất. Các hình hiện là minh họa SVG; thay hàm art bằng ảnh sản phẩm thật nếu cần.
- dist/index.html: câu chuyện, FAQ, thông tin giao hàng và đổi trả.
- dist/theme.css: tông hồng và giao diện responsive.

## Chức năng
Danh mục, tìm kiếm, lọc, sắp xếp giá, chi tiết sản phẩm, số lượng, giỏ hàng lưu localStorage, lời nhắn, sao chép / tải danh sách, Zalo / Facebook / email / gọi điện khi đã cấu hình.

## Nhận đơn
Zalo và Facebook mở kênh liên hệ và sao chép danh sách để khách dán vào cuộc trò chuyện. Email mở trình soạn thư có sẵn nội dung, khách cần tự gửi. Website không có cơ sở dữ liệu đơn hàng, không tự xác nhận tồn kho, không nhận thanh toán trực tuyến. Thông tin người mua chỉ dùng tại trình duyệt và không được lưu localStorage.

## Triển khai
Upload nội dung dist lên hosting static. Bản Sites hiện xuất bản riêng tư, cần thay đổi quyền truy cập khi muốn khách ngoài truy cập.

## Kiểm tra
Đã kiểm tra cú pháp JavaScript và logic bằng DOM mô phỏng: danh mục, lọc, tìm kiếm, chi tiết, giỏ hàng, tổng tiền và trạng thái giỏ trống. Chưa kiểm tra trực quan bằng trình duyệt trong môi trường này.

Tham khảo cách tổ chức sản phẩm: https://shop.amirisu.com/ và https://www.rakuten.co.jp/gosyo/. Không sao chép hình ảnh hay mã của các website này.
