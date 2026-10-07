# Chạy và quản trị cửa hàng

## Khởi động local

Cài Node.js 24 trở lên, sau đó:

```sh
npm ci
npm run admin:create
npm run dev
```

Lệnh admin:create hỏi email và mật khẩu (không để trống, ẩn khi nhập trong terminal). Không có tài khoản hoặc mật khẩu mặc định. Mật khẩu chỉ được lưu dưới dạng scrypt hash. Website: http://localhost:3000. Quản trị: http://localhost:3000/admin/.

Database được tạo và migration tự chạy lần đầu tại data/shop.sqlite. Ảnh nằm ở data/uploads. Những file này không được commit Git. Muốn đổi vị trí, sao chép .env.example thành .env và đặt DATA_DIR; dùng cùng DATA_DIR khi tạo admin, chạy server và sao lưu.

## Chuẩn bị bán hàng

1. Vào /admin/, sửa hoặc thêm sản phẩm: tên, mô tả, ảnh, giá và tồn kho.
2. Hàng mẫu khởi tạo tồn kho 0. Tồn kho là số lượng còn có thể bán, không tính hàng đang giữ cho đơn đã đặt.
3. Cập nhật tên shop, liên hệ, phí giao hàng và ngưỡng miễn phí giao trong Cài đặt shop. Phí mặc định 30.000đ và miễn phí từ 500.000đ là giá trị khởi tạo để chỉnh lại theo shop, không phải biểu phí hãng giao hàng.
4. Bỏ thông báo dữ liệu mẫu sau khi đã thay nội dung, ảnh và giá thực tế.
5. Thử đặt một đơn và xử lý đến hoàn tất trước khi nhận khách thật.

## Xử lý đơn hàng

- Khách đặt COD với họ tên, số điện thoại, địa chỉ và lời nhắn. Server lấy giá từ database và kiểm tra tổng khách đã xác nhận; nếu giá hoặc phí giao vừa đổi, khách cần kiểm tra và gửi lại.
- Đơn chờ xác nhận đã giữ hàng: tồn kho bị trừ trong cùng transaction với việc lưu đơn. Hai khách mua cùng hàng không thể làm tồn âm.
- Luồng: pending → confirmed → shipping → completed. Hoàn tất cần đánh dấu đã thu tiền.
- Có thể hủy pending hoặc confirmed. Hủy hoàn lại tồn kho một lần. Đơn đang giao không hỗ trợ hủy; đơn đã thu tiền cần xử lý hoàn tiền rồi bỏ đánh dấu thu tiền trước khi hủy.
- Khách đăng ký/đăng nhập tại /register/ hoặc /login/, rồi xem đơn của mình tại /account/. Không cần giữ mã tra cứu. Đơn cũ chưa gắn tài khoản vẫn giữ trong admin.
- Khóa idempotency giữ cùng một đơn khi gửi lại cùng nội dung sau lỗi mạng. Trình duyệt giữ khóa và fingerprint SHA-256 trong sessionStorage; không lưu tên, điện thoại hoặc địa chỉ ở đó.
- Chủ shop cần kiểm tra đơn chờ và liên hệ xác nhận. Hiện chưa gửi email/SMS tự động, chưa tích hợp cổng thanh toán hoặc tạo vận đơn hãng giao hàng. COD và giao hàng được shop xử lý thủ công.

## Sao lưu và phục hồi

```sh
npm run db:backup
```

Lệnh dùng SQLite online backup, tạo file trong data/backups. Sao lưu cả thư mục uploads đến nơi khác; không chỉ giữ bản backup trên cùng ổ đĩa. Với cửa hàng cá nhân, nên thực hiện hằng ngày và trước khi nâng cấp.

Để phục hồi: dừng server, giữ bản database hiện tại để đối chiếu, thay shop.sqlite bằng bản backup cùng bộ ảnh uploads tương ứng, rồi chạy server. Không dùng file WAL/SHM của database cũ với bản vừa phục hồi. Kiểm tra sản phẩm và đơn gần nhất sau phục hồi.

## Triển khai Node.js

Ứng dụng chạy một instance Node.js với một SQLite database trên ổ bền vững. Không dùng hosting chỉ phục vụ file tĩnh, ổ đĩa tạm hoặc chạy nhiều container có database riêng.

```sh
npm ci
npm run build
```

Đặt NODE_ENV=production, HOST=127.0.0.1 (hoặc 0.0.0.0 trong container), PORT=3000 và DATA_DIR đến thư mục bền vững. Dùng reverse proxy có HTTPS; cookie quản trị ở production chỉ gửi qua HTTPS. Nếu đúng một reverse proxy đứng trước app, đặt TRUST_PROXY=1; không mở app trực tiếp ra Internet đồng thời tin proxy tùy ý.

## Docker Compose

```sh
docker compose up -d --build
docker compose exec shop npm run admin:create
```

compose.yaml giữ database/ảnh trên named volume shop-data và chỉ mở cổng 3000 ở loopback. Cấu hình reverse proxy HTTPS ở host trỏ đến 127.0.0.1:3000. Không dùng HTTP production để đăng nhập admin. Không chạy docker compose down -v nếu cần giữ dữ liệu shop.

```sh
docker compose exec shop npm run db:backup
```

Dockerfile và Compose được cung cấp để triển khai; kiểm tra build Docker trên máy có Docker trước khi lên hosting. Bản Sites cũ là bản xem giao diện, không chứa backend SQLite. Chưa triển khai backend lên máy chủ Internet trong phiên này.

## Khôi phục quyền quản trị

Nếu quên mật khẩu, người có quyền terminal trên máy chủ có thể chạy admin:create để tạo tài khoản quản trị khác, đăng nhập và xử lý tài khoản cũ bằng database nếu cần. Không cung cấp endpoint đăng ký quản trị công khai.

## Giới hạn vận hành

Đây là cửa hàng cá nhân dùng COD. Tài khoản khách hỗ trợ đăng ký, đăng nhập và lịch sử đơn riêng. Chưa có xác thực email, khôi phục mật khẩu, giảm giá, quản lý biến thể nhiều màu trong một sản phẩm, trả hàng/hoàn tiền tự động hoặc phí giao tính theo hãng. Hãy tạo mỗi màu/quy cách thành một sản phẩm riêng. Đơn chờ không tự hết hạn; chủ shop phải xác nhận hoặc hủy để giải phóng hàng.

Login có giới hạn số lần thử; đặt đơn cũng giới hạn theo IP. Thông tin giao hàng chỉ hiện với quản trị hoặc chính khách sở hữu đơn đã đăng nhập. Không đưa file database/backup vào thư mục public, Git hoặc ảnh tải lên.

## Tạo admin tạm thời trên Render Free (không có Shell)

**Giải pháp tạm thời:** trong Render → Environment, thêm `ADMIN_EMAIL` và `ADMIN_PASSWORD` bằng email/mật khẩu bạn chọn. Cấu hình thêm `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`; để Render cấp `PORT`. Build command: `npm ci && npm run build`; Start command: `npm start`. Lưu biến môi trường rồi redeploy, đăng nhập tại `/admin/` qua HTTPS.

Server tạo admin khi khởi động nếu email chưa tồn tại, hash mật khẩu và không in thông tin đăng nhập ra log. Không tự chạy seed. Không có hai biến thì bỏ qua; thiếu một biến hoặc cấu hình sai thì dừng khởi động với lỗi cấu hình. Đổi `ADMIN_PASSWORD` không đổi mật khẩu của tài khoản đã có; dùng mục đổi mật khẩu trong admin.

Khi có storage bền vững và quy trình tạo admin bằng CLI, xóa hai biến này để ngừng cách khởi tạo tạm thời. Trên Render Free, SQLite/uploads nằm trên filesystem tạm: mất khi restart/redeploy hoặc dịch vụ ngủ (spin down). Xem [giới hạn Render Free](https://render.com/docs/free#local-files-lost-on-redeploy). Bootstrap có thể tạo lại admin nếu database mới, nhưng không khôi phục sản phẩm, bài viết hoặc ảnh đã mất.
