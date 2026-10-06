# API cửa hàng

API cùng origin với website, tiền tính bằng số nguyên VND. Dữ liệu ghi dùng JSON, ảnh dùng multipart/form-data. API không cho phép CORS từ website khác.

## Công khai

| Method | Endpoint          | Chức năng                                  |
| ------ | ----------------- | ------------------------------------------ |
| GET    | /api/health       | Kiểm tra server/database                   |
| GET    | /api/products     | Sản phẩm đang bán, gồm stock và version    |
| GET    | /api/products/:id | Một sản phẩm                               |
| GET    | /api/settings     | Tên shop, liên hệ, phí giao, thông báo mẫu |

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
