# API cửa hàng

**Chế độ hiện tại:** `POST /api/orders` bị chặn với 403 khi khách có phiên/CSRF hợp lệ. Khách liên hệ shop để mua; API lịch sử đơn và admin quản lý đơn cũ vẫn hoạt động. Các mô tả checkout phía dưới là chức năng cũ được giữ trong code.

API cùng origin với website, tiền tính bằng số nguyên VND. Dữ liệu ghi dùng JSON, ảnh dùng multipart/form-data. API không cho phép CORS từ website khác.

## Công khai

| Method | Endpoint          | Chức năng                                                  |
| ------ | ----------------- | ---------------------------------------------------------- |
| GET    | /api/health       | Kiểm tra server/database                                   |
| GET    | /api/products     | Sản phẩm đang bán, gồm stock và version                    |
| GET    | /api/products/:id | Một sản phẩm                                               |
| GET    | /api/settings     | Tên shop, liên hệ (gồm tiktokUrl), phí giao, thông báo mẫu |

## Tài khoản khách và đơn hàng cá nhân

| Method | Endpoint                    | Chức năng                                                         |
| ------ | --------------------------- | ----------------------------------------------------------------- |
| POST   | /api/customer/register      | name, email, password; tạo tài khoản và phiên đăng nhập           |
| POST   | /api/customer/login         | email, password; tạo phiên                                        |
| GET    | /api/customer/session       | customer + csrfToken hoặc null nếu chưa đăng nhập                 |
| POST   | /api/customer/logout        | Thu hồi phiên khách                                               |
| GET    | /api/customer/orders?page=1 | Chỉ đơn thuộc phiên hiện tại, 10 đơn/trang                        |
| GET    | /api/customer/orders/:id    | Chi tiết đơn thuộc phiên; 404 với đơn của người khác              |
| POST   | /api/orders                 | Đặt COD với cookie khách, X-CSRF-Token và Idempotency-Key UUID v4 |

Đăng ký/đăng nhập dùng JSON và kiểm tra cùng origin, có giới hạn 20 lần/15 phút theo IP.
Cookie tiemlen_customer là HttpOnly, SameSite=Strict, Secure ở production; phiên sống 8 giờ.
Các thao tác ghi sau đăng nhập cần X-CSRF-Token. Tài khoản khách không có quyền admin.

API luôn lấy customer_id từ phiên; giá trị chủ sở hữu gửi trong body/query không được dùng.
Không còn endpoint /api/orders/lookup. Đơn cũ có customer_id NULL chỉ hiện trong admin.
Khóa Idempotency-Key của người khác không cho phép lấy lại thông tin đơn.

Body đặt đơn:

```json
{
  "name": "Nguyễn Mai",
  "phone": "0912345678",
  "address": "12 Đường Hoa, Phường 1, TP Hồ Chí Minh",
  "note": "Giao giờ hành chính",
  "paymentMethod": "cod",
  "expectedTotal": 65000,
  "items": [{ "productId": 1, "quantity": 1 }]
}
```

Server lấy giá và phí giao từ database, không tin giá từng item hoặc total tùy ý từ client. expectedTotal phải khớp để tránh đặt đơn khi giá vừa đổi. Phản hồi: order, replay; 201 cho đơn mới, 200 khi phát lại đơn cũ. Header idempotency là quyền khôi phục kết quả yêu cầu, không chia sẻ hoặc log khóa này.

## Quản trị

POST /api/admin/login với email và password trả csrfToken, đặt cookie HttpOnly/SameSite=Strict. Production dùng Secure. Phiên sống 8 giờ, lưu server trong SQLite; token cookie chỉ lưu dạng SHA-256 ở database.

Các API sau cần cookie phiên; thao tác ghi còn cần header X-CSRF-Token.

| Method   | Endpoint                                | Chức năng                                                       |
| -------- | --------------------------------------- | --------------------------------------------------------------- |
| GET      | /api/admin/session                      | Email + CSRF token                                              |
| POST     | /api/admin/logout                       | Thu hồi phiên                                                   |
| PUT      | /api/admin/password                     | currentPassword + password mới, thu hồi mọi phiên của admin     |
| GET/POST | /api/admin/products                     | Liệt kê / thêm sản phẩm                                         |
| PUT      | /api/admin/products/:id                 | Sửa đầy đủ sản phẩm, cần version hiện tại                       |
| DELETE   | /api/admin/products/:id                 | Ẩn sản phẩm, giữ lịch sử                                        |
| POST     | /api/admin/uploads                      | Trường image, PNG/JPG/WebP tối đa 5 MB                          |
| GET      | /api/admin/orders?page=1&status=pending | Danh sách, 30 đơn/trang                                         |
| GET      | /api/admin/orders/:id                   | Chi tiết gồm thông tin người nhận                               |
| PATCH    | /api/admin/orders/:id                   | status + paid boolean                                           |
| GET      | /api/admin/dashboard                    | Tổng đơn, đơn chờ, doanh thu hoàn tất và hàng sắp hết           |
| PUT      | /api/admin/settings                     | Cập nhật tên, liên hệ, shippingFee, freeShippingThreshold, demo |

Sản phẩm: name, type (cotton/milk/tools), desc, price, stock, color và bg dạng #RRGGBB, tag, imageUrl, active boolean. PUT cần version để chặn việc lưu đè tồn kho đã thay đổi bởi đơn mới hoặc admin khác.

Lỗi trả JSON với error, dùng 400/401/403/404/409/415/429. Không gửi stack trace hoặc dữ liệu database trong phản hồi lỗi.

## Ảnh và video sản phẩm

Sản phẩm có `media`: mảng tối đa 12 phần tử `{ type: "image" | "video", url: string, primary: boolean }`. Mảng có nội dung phải có đúng một ảnh `primary: true`; video không được chọn làm ảnh chính. URL không trùng nhau, dùng HTTPS hoặc đường dẫn upload hợp lệ. `imageUrl` trả về URL ảnh chính để dùng trong catalog. Yêu cầu cũ không gửi `media` sẽ tạo gallery từ `imageUrl`; gửi `media: []` xóa gallery. PUT vẫn yêu cầu `version`.

`POST /api/admin/media`: multipart trường `file`, yêu cầu phiên admin và CSRF. Nhận PNG/JPG/WebP tối đa 5 MB hoặc MP4/WebM tối đa 30 MB, trả `201 { url, type }`. Kiểm tra chữ ký file; không chuyển mã hay kiểm tra thời lượng video. Endpoint upload ảnh cũ được giữ để tương thích. File video phục vụ HTTP Range để tua.

Bài cộng đồng `status: "draft"` có thể lưu khi nội dung còn trống hoặc ngắn; tiêu đề trống được đặt là “Câu chuyện chưa đặt tên”. Chia sẻ (`published`) vẫn yêu cầu tiêu đề từ 3 ký tự và nội dung từ 20 ký tự.

## Thông báo

Các endpoint khách cần cookie phiên riêng; thao tác ghi cần `X-CSRF-Token`.

| Method | Endpoint                               | Chức năng                                                                         |
| ------ | -------------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/customer/notifications?page=1`   | Thông báo của chính mình, 20 mục/trang; notifications, unread, total, page, pages |
| GET    | `/api/customer/notifications/unread`   | Số chưa đọc: `{ unread }`                                                         |
| PATCH  | `/api/customer/notifications/:id/read` | Đọc một thông báo; ID của người khác trả 404                                      |
| POST   | `/api/customer/notifications/read-all` | Đọc tất cả thông báo của chính mình                                               |
| GET    | `/api/admin/notifications?page=1`      | Lịch sử gửi toàn bộ thành viên, 20 mục/trang                                      |
| POST   | `/api/admin/notifications`             | `{ title, body }`; trả 201 `{ id, recipients }`                                   |

Thông báo admin yêu cầu phiên admin, CSRF và JSON; tối đa 10 lần gửi/15 phút theo IP. Tiêu đề 3–160 ký tự, nội dung 3–2000 ký tự; nội dung hiển thị dạng text, không HTML. Gửi đến các tài khoản khách tại thời điểm gửi; không phát lại cho người đăng ký sau.

Notifications gồm id, kind (like/comment/announcement), title, body, href (bài viết hoặc null), read, createdAt. Không gửi email hoặc nội dung bình luận trong thông báo tương tác. Bài ẩn/xóa/nháp và bình luận bị ẩn không được đưa ra danh sách/số chưa đọc. Một lượt thả tim của mỗi người cho mỗi bài chỉ tạo một thông báo; không thông báo tương tác của chính tác giả.
