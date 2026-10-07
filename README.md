# Tiệm Len — Crochet Web App

Website bán len với frontend HTML/CSS/JavaScript thuần, backend **Node.js + Express + SQLite**. Có danh mục sản phẩm, giỏ hàng, đặt COD, tài khoản khách, lịch sử đơn cá nhân và trang quản trị sản phẩm, tồn kho, ảnh, đơn hàng, cài đặt shop và tài khoản admin.

**Chế độ hiện tại (07/10/2026):** cửa hàng chỉ trưng bày sản phẩm; khách nhắn shop qua phần liên hệ để mua hoặc đặt đan móc. Giỏ hàng/checkout đã tạm đóng cả trên giao diện và API. Các hướng dẫn COD bên dưới mô tả chức năng cũ được giữ để khôi phục sau; đơn cũ vẫn xem và quản lý được.

Chuông thông báo trong tài khoản nhận lượt thích/bình luận mới và tin từ admin. Admin → **Thông báo** để gửi tới toàn bộ thành viên hiện có.

Trạng thái triển khai và hướng dẫn bàn giao cho AI: [PROJECT_STATUS.md](PROJECT_STATUS.md).

## 1. Yêu cầu trước khi chạy

- **Node.js 24 trở lên**, kèm npm. Kiểm tra bằng các lệnh bên dưới.
- Terminal: PowerShell trên Windows hoặc shell trên macOS/Linux.
- Docker và Docker Compose nếu chọn cách chạy bằng container.

```sh
node --version
npm --version
```

Nếu Node.js đang là phiên bản 22 hoặc thấp hơn, cài Node.js 24+ rồi mở lại terminal. Project sử dụng SQLite tích hợp trong Node.js; không cần cài MySQL, PostgreSQL hay SQLite riêng.

Chạy tất cả lệnh trong thư mục gốc chứa `package.json`. Với checkout hiện tại trên Windows:

```powershell
Set-Location D:\Sources\Private\crochet-web-app
```

## 2. Chạy local từng bước

### Bước 1: Cài thư viện

```sh
npm ci
```

Lệnh cài đúng các phiên bản trong `package-lock.json`. Cần kết nối Internet ở lần cài đầu tiên.

Nếu PowerShell báo không thể chạy `npm.ps1`, dùng `npm.cmd` thay cho `npm` trong các lệnh, ví dụ `npm.cmd ci`.

### Bước 2: Tạo cấu hình môi trường

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```sh
cp .env.example .env
```

Chỉ sao chép khi chưa có `.env` để tránh ghi đè cấu hình hiện tại. File này là tùy chọn khi chạy với giá trị mặc định, nhưng nên tạo để tiện thay đổi:

```dotenv
PORT=3000
HOST=127.0.0.1
NODE_ENV=development
DATA_DIR=./data
TRUST_PROXY=0
```

| Biến          | Mặc định khi không thiết lập | Ý nghĩa                                                                                           |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `PORT`        | `3000`                       | Cổng HTTP của ứng dụng.                                                                           |
| `HOST`        | `127.0.0.1`                  | Chỉ nhận kết nối trên máy hiện tại; dùng `0.0.0.0` để nhận từ mạng/container.                     |
| `NODE_ENV`    | Phục vụ chế độ development   | Đặt `production` để phục vụ `dist/` và bật cấu hình bảo mật production; local dùng `development`. |
| `DATA_DIR`    | `data/` tại thư mục project  | Thư mục SQLite, ảnh và backup. Đường dẫn tương đối được tính từ thư mục chạy lệnh.                |
| `TRUST_PROXY` | Tắt                          | Chỉ giá trị `1` bật tin cậy một reverse proxy phía trước ứng dụng. Local trực tiếp dùng `0`.      |

Các lệnh `dev`, `start`, `admin:create` và `db:backup` tự đọc `.env`. Biến môi trường đã đặt trong terminal được ưu tiên hơn giá trị cùng tên trong file. Khởi động lại server sau khi đổi cấu hình.

Dùng cùng `DATA_DIR` khi tạo admin, chạy server và backup. Không commit `.env` hoặc dữ liệu riêng tư vào Git.

### Bước 3: Tạo tài khoản quản trị

```sh
npm run admin:create
```

Nhập email hợp lệ và mật khẩu bạn chọn (không để trống, tối đa 200 ký tự) theo câu hỏi trong terminal. Mật khẩu được ẩn khi nhập ở terminal tương tác.

- Không có tài khoản hoặc mật khẩu mặc định.
- Lệnh tự tạo thư mục dữ liệu, database và chạy migration nếu đây là lần đầu.
- Email phải chưa tồn tại; chạy lại lệnh không đổi mật khẩu tài khoản cũ.
- Có thể tạo thêm admin bằng email khác. Nếu quên mật khẩu, tạo admin mới bằng quyền terminal trên máy chạy ứng dụng.

### Bước 4: Khởi động server

```sh
npm run dev
```

Giữ terminal đang chạy, rồi mở:

- Cửa hàng: http://localhost:3000
- Quản trị: http://localhost:3000/admin/
- Kiểm tra server/database: http://localhost:3000/api/health — kết quả `{"ok":true}`.

Nếu đổi `PORT`, thay cổng trong các URL tương ứng. Nhấn **Ctrl+C** để dừng server.

Server development phục vụ trực tiếp `src/`. Node tự khởi động lại khi file được theo dõi thay đổi; tải lại trang trình duyệt để xem thay đổi giao diện. Không cần build trước khi chạy local.

Không mở `src/index.html` bằng `file://` hoặc chỉ chạy Live Server: giao diện cần các API của backend trên cùng ứng dụng.

### Bước 5: Chuẩn bị dữ liệu và thử đặt hàng

1. Đăng nhập trang quản trị bằng tài khoản vừa tạo.
2. Thêm/sửa sản phẩm, giá, ảnh và tồn kho. **Sản phẩm mẫu có tồn kho 0**, nên cần tăng tồn kho để thử mua.
3. Trong cài đặt shop, cập nhật tên, liên hệ, phí giao hàng và ngưỡng miễn phí giao. Giá trị khởi tạo là 30.000đ và miễn phí từ 500.000đ.
4. Thay dữ liệu mẫu, sau đó tắt thông báo demo khi đã sẵn sàng.
5. Mở cửa hàng, đăng ký/đăng nhập tài khoản khách, thêm hàng vào giỏ và đặt đơn COD với thông tin thử nghiệm. Xem đơn tại trang Đơn hàng của tôi.
6. Kiểm tra đơn ở trang quản trị; xác nhận → giao hàng → đánh dấu thu tiền → hoàn tất. Hủy đơn chờ hoặc đã xác nhận để thử hoàn tồn kho.

Đơn mới giữ hàng ngay khi đặt. Đơn chờ không tự hết hạn; admin cần xác nhận hoặc hủy để giải phóng hàng. COD, liên hệ khách và giao hàng được shop xử lý thủ công.

## 3. Dữ liệu được lưu ở đâu?

Với cấu hình mặc định:

```text
data/
  shop.sqlite       # Sản phẩm, admin, đơn hàng, cài đặt và các dữ liệu backend
  shop.sqlite-wal   # File SQLite có thể xuất hiện khi đang chạy
  shop.sqlite-shm   # File SQLite có thể xuất hiện khi đang chạy
  uploads/          # Ảnh sản phẩm tải lên
  backups/          # Các bản sao database do db:backup tạo
```

Migration và dữ liệu mẫu chỉ được khởi tạo khi database chưa có schema. Khởi động lại server không xóa dữ liệu. Chạy build chỉ cập nhật frontend, không reset database.

## 4. Các lệnh thường dùng

| Lệnh                   | Chức năng                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm ci`               | Cài thư viện theo lockfile.                                           |
| `npm run dev`          | Chạy server với Node watch; chế độ phục vụ vẫn phụ thuộc `NODE_ENV`.  |
| `npm start`            | Chạy server không watch; chỉ là production khi `NODE_ENV=production`. |
| `npm run admin:create` | Tạo admin qua terminal.                                               |
| `npm run build`        | Sao chép frontend từ `src/` sang `dist/`; không bundle/minify.        |
| `npm run check`        | Kiểm tra cú pháp JavaScript, import tương đối và tài nguyên HTML.     |
| `npm test`             | Chạy bộ kiểm tra bằng Node test runner.                               |
| `npm run format:check` | Kiểm tra định dạng bằng Prettier.                                     |
| `npm run format`       | Format mã và tài liệu; có sửa file.                                   |
| `npm run db:backup`    | Sao lưu SQLite bằng online backup.                                    |

Chuỗi kiểm tra tương ứng CI, chạy từng lệnh và xử lý lỗi trước khi tiếp tục:

```sh
npm run format:check
npm run check
npm test
npm run build
```

## 5. Chạy production bằng Node.js

Cài dependencies và build frontend:

```sh
npm ci
npm run build
```

Sửa `.env`:

```dotenv
PORT=3000
HOST=127.0.0.1
NODE_ENV=production
DATA_DIR=./data
TRUST_PROXY=1
```

Ví dụ trên dành cho **đúng một reverse proxy đáng tin cậy có HTTPS** trên cùng máy, chuyển tiếp đến `127.0.0.1:3000`. Proxy cần chuyển tiếp đúng host và giao thức gốc, gồm `X-Forwarded-Proto: https`. Chỉ bật `TRUST_PROXY=1` khi cấu hình này thực sự tồn tại.

Dùng đường dẫn `DATA_DIR` đến ổ lưu trữ bền vững nếu triển khai trên hosting. Nếu chưa có admin trong database đích, tạo rồi chạy:

```sh
npm run admin:create
npm start
```

Truy cập cửa hàng và `/admin/` qua URL HTTPS của reverse proxy. Cookie admin ở production có thuộc tính Secure, nên đăng nhập qua HTTP không hoạt động đúng. Để thử trên máy cá nhân bằng HTTP, dùng `NODE_ENV=development` và `TRUST_PROXY=0`.

Sau mỗi lần sửa frontend, chạy lại `npm run build`. Production phục vụ `dist/`, nên sửa riêng `src/` chưa cập nhật giao diện production.

Ứng dụng cần một instance Node.js và một SQLite database trên ổ bền vững. Hosting tĩnh chỉ phục vụ HTML/CSS/JS không chạy được backend này. Khi vận hành lâu dài, cấu hình dịch vụ tự khởi động lại tiến trình và reverse proxy HTTPS.

## 6. Chạy bằng Docker Compose

Dockerfile dùng Node.js 24, tự cài dependencies, build frontend và chạy production. Cần Docker đang hoạt động; trên Windows có thể dùng Docker Desktop.

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f shop
```

Nhấn Ctrl+C để thoát xem log; container vẫn chạy nền. Tạo admin trong database của container:

```sh
docker compose exec shop npm run admin:create
```

Compose hiện tại:

- Chỉ mở cổng trên host tại `127.0.0.1:3000`.
- Đặt `NODE_ENV=production`, `HOST=0.0.0.0`, `DATA_DIR=/app/data`, `TRUST_PROXY=1`.
- Lưu database/ảnh trong named volume `shop-data` (tên thực tế có thể thêm tiền tố project).
- Không tự đọc `.env` của host vào môi trường container; các biến ứng dụng được khai báo trong `compose.yaml`.

Cấu hình reverse proxy HTTPS trên host trỏ đến `127.0.0.1:3000`, rồi truy cập qua tên miền HTTPS để sử dụng admin. HTTP tại localhost chỉ phù hợp kiểm tra kết nối; cấu hình Compose production hiện tại cần HTTPS để dùng đầy đủ giao diện và phiên đăng nhập.

Database container độc lập với `./data` trên host. Admin tạo bằng `npm run admin:create` trên host không tự xuất hiện trong container.

Các lệnh quản lý:

```sh
docker compose restart shop
docker compose exec shop npm run db:backup
docker compose down
```

`docker compose down` dừng và gỡ container, giữ named volume. **Không chạy `docker compose down -v` nếu cần giữ dữ liệu**, vì tùy chọn này xóa volume.

Khi cập nhật mã nguồn, chạy lại `docker compose up -d --build`.

## 7. Sao lưu và phục hồi

Chạy trên môi trường đang chứa dữ liệu cần backup:

```sh
npm run db:backup
```

Lệnh tạo bản SQLite có dấu thời gian trong `DATA_DIR/backups/`, có thể chạy khi server đang hoạt động. **Sao lưu cả `uploads/`** và chuyển bản sao ra ổ/máy khác. Với Docker, backup nằm trong volume ở `/app/data/backups/`; cần sao chép ra ngoài container để lưu riêng.

Để phục hồi:

1. Dừng server/container và giữ bản dữ liệu hiện tại để đối chiếu.
2. Thay `shop.sqlite` bằng bản backup cần phục hồi.
3. Khôi phục bộ ảnh `uploads/` tương ứng.
4. Không dùng lại các file `shop.sqlite-wal`/`shop.sqlite-shm` cũ với database vừa phục hồi; chuyển chúng cùng bản dữ liệu cũ khi server đã dừng.
5. Khởi động lại và kiểm tra sản phẩm, ảnh, tài khoản admin và đơn hàng gần nhất.

Xem thêm [hướng dẫn vận hành](docs/operations.md).

## 8. Lỗi thường gặp

| Hiện tượng                                                            | Cách xử lý                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Không nhận lệnh `node` hoặc `npm`                                     | Cài Node.js 24+, kiểm tra PATH và mở lại terminal.                                            |
| Lỗi tùy chọn Node hoặc không có `node:sqlite`                         | Kiểm tra `node --version`; dùng phiên bản 24+ theo yêu cầu project.                           |
| PowerShell chặn `npm.ps1`                                             | Dùng `npm.cmd`, ví dụ `npm.cmd run dev`.                                                      |
| Không tìm thấy `express` hoặc dependency                              | Chạy `npm ci` tại thư mục chứa `package.json`.                                                |
| `EADDRINUSE` khi khởi động                                            | Dừng tiến trình đang dùng cổng hoặc đổi `PORT` trong `.env`, rồi khởi động lại.               |
| Không tạo được database/ảnh, lỗi quyền truy cập                       | Kiểm tra `DATA_DIR` và quyền ghi của tài khoản chạy Node/container.                           |
| Tạo admin báo email đã tồn tại                                        | Dùng tài khoản đã tạo hoặc tạo admin với email khác.                                          |
| Đăng nhập báo sai tài khoản dù đã tạo admin                           | Kiểm tra server và lệnh tạo admin dùng cùng `DATA_DIR`; dữ liệu Docker và host là riêng biệt. |
| Đăng nhập production không giữ phiên hoặc trình duyệt tự chuyển HTTPS | Dùng reverse proxy HTTPS đúng cấu hình; thử local HTTP với `NODE_ENV=development`.            |
| Sản phẩm mẫu không mua được                                           | Đăng nhập admin và cập nhật tồn kho lớn hơn 0.                                                |
| Sửa giao diện nhưng production chưa đổi                               | Chạy `npm run build`, tải lại trang; nếu dùng Docker, build lại image.                        |
| API không hoạt động khi mở HTML trực tiếp                             | Chạy Node server rồi truy cập `http://localhost:3000`.                                        |
| Đăng nhập bị giới hạn                                                 | Sau 10 lần thử trong cửa sổ 15 phút theo IP, đợi hết giới hạn trước khi thử lại.              |

Nếu muốn thử bằng điện thoại trong cùng mạng LAN, đặt `HOST=0.0.0.0`, giữ `NODE_ENV=development`, khởi động lại rồi truy cập `http://<IP-LAN-của-máy>:3000`. Cho phép cổng qua firewall nếu cần; điện thoại phải cùng mạng.

## 9. Cấu trúc project

```text
src/
  index.html             # Cửa hàng
  admin/                 # Giao diện quản trị
  js/
    config/              # Cấu hình shop từ API
    data/                # Danh mục và sản phẩm mẫu
    components/          # Minh họa sản phẩm
    features/            # Catalog, giỏ hàng, checkout, liên hệ và đăng nhập khách
    services/            # API client
    utils/               # DOM, escape HTML, storage
  styles/                # CSS
server/
  index.js               # Đọc cấu hình, mở database, khởi động server
  app.js                 # Middleware, API và phục vụ frontend
  database.js            # SQLite, migration, dữ liệu ban đầu
  routes/                # API công khai và quản trị
  migrations/            # Schema database
  services/              # Xử lý đơn và tồn kho
scripts/                 # Build, check, tạo admin, backup
tests/                   # Test frontend, API và storage
docs/                    # Tài liệu vận hành và API
dist/                    # Frontend sau build
data/                    # Dữ liệu runtime, không commit
Dockerfile               # Image production
compose.yaml             # Container và volume dữ liệu
```

Sửa frontend trong `src/`, sau đó build để cập nhật `dist/`. Tài liệu endpoint nằm ở [docs/api.md](docs/api.md).

Phạm vi hiện tại là COD; chưa có thanh toán online, email/SMS tự động hay API hãng vận chuyển. Trước khi mở bán, thay dữ liệu mẫu và thử đầy đủ quy trình đặt/xử lý đơn.

## 10. Seed dữ liệu test và tài khoản mặc định

File [scripts/seed-data.json](scripts/seed-data.json) chứa admin, sản phẩm và đơn hàng thử nghiệm.
Script [scripts/seed.mjs](scripts/seed.mjs) nạp dữ liệu vào database đang được cấu hình qua `DATA_DIR`:

```sh
npm run db:seed
```

Nếu máy vẫn dùng Node.js 22, chạy với runtime Node.js 24 đã tải:

```powershell
npm.cmd exec --yes --package=node@24 -- node --env-file-if-exists=.env scripts/seed.mjs
```

Tài khoản mặc định sau lần seed đầu:

- Email: **admin@tiemlen.test**
- Mật khẩu: **AdminTest123!**

Seed thêm 5 sản phẩm có tiền tố `[TEST]`, ID 10001–10005: 3 sản phẩm có tồn kho, 1 hết hàng và 1 ẩn.
Có 5 đơn tương ứng chờ xác nhận, đã xác nhận, đang giao, hoàn tất đã thu tiền và đã hủy.
Script dùng luồng đặt đơn thật để giữ/hoàn tồn kho và in mã đơn ra terminal.

Chạy lại không tạo trùng admin, sản phẩm hoặc đơn; không ghi đè mật khẩu, sản phẩm hay trạng thái đơn đã tồn tại.
Muốn sửa bộ dữ liệu cho database mới, chỉnh JSON trước khi seed. Không có tùy chọn xóa/reset database.
Seed không thay cài đặt shop hiện tại và không tạo ảnh tải lên; sản phẩm sử dụng minh họa sẵn có.

Dữ liệu và tài khoản này chỉ dành cho local/test. Script từ chối chạy với `NODE_ENV=production`.
Nếu database đã có email trên, mật khẩu cũ được giữ nguyên.

## 11. Tài khoản khách và lịch sử đặt hàng

- Đăng nhập khách: [http://localhost:3000/login/](http://localhost:3000/login/).
- Đăng ký khách: [http://localhost:3000/register/](http://localhost:3000/register/).
- Đơn hàng của tôi: [http://localhost:3000/account/](http://localhost:3000/account/).
- Thay cổng bằng PORT hiện tại, ví dụ 3001 trong môi trường local đang chạy.

Khách cần đăng nhập khi thêm vào giỏ hoặc đặt hàng. Sau đăng nhập/đăng ký, sản phẩm vừa chọn
được thêm lại vào giỏ và giỏ tự mở. Giỏ hiện có được giữ khi chuyển qua trang đăng nhập.
Đăng xuất xóa giỏ và yêu cầu đặt hàng tạm trên trình duyệt để dùng an toàn trên máy chung.

Đăng ký gồm họ tên, email, mật khẩu và nhập lại mật khẩu. Mật khẩu không yêu cầu độ dài tối thiểu hay độ phức tạp; cần nhập mật khẩu, tối đa 200 ký tự và được hash.
Phiên khách dùng cookie HttpOnly riêng với admin, sống 8 giờ và cần HTTPS ở production.
Trang lịch sử chỉ hiển thị đơn của tài khoản đang đăng nhập; không còn chức năng tra cứu bằng mã.

Chạy lại npm run db:seed để tạo khách test:

- Email: **user@tiemlen.test**
- Mật khẩu: **UserTest123!**

Khách test có 5 đơn mẫu trong lịch sử. Tài khoản admin vẫn là admin@tiemlen.test / AdminTest123!,
chỉ dùng tại /admin/. Seed giữ nguyên mật khẩu các tài khoản đã tồn tại.

Migration 002 tự chạy khi mở database, bổ sung customers, customer_sessions và orders.customer_id,
giữ nguyên sản phẩm/admin/đơn cũ. Đơn cũ chưa có chủ sở hữu chỉ hiện trong admin, không tự ghép theo
email hay điện thoại. Seed chỉ liên kết đúng các đơn mẫu đã khai báo với khách test.

Chưa có xác thực email hoặc khôi phục mật khẩu cho khách. QR/thanh toán chuyển khoản để làm sau.

## Góc trưng bày và cộng đồng chuyện len

- Trang chủ: đồ thủ công và len/dụng cụ; lọc **Đồ len thủ công**. Quản trị viên chọn nhóm sản phẩm và tải ảnh thật trong **Sản phẩm**.
- `/community/`: đọc bài công khai, tìm kiếm, lọc theo Sống chậm, Hành trình đan, Kỷ niệm, Mẹo nhỏ.
- `/write/`: đăng nhập tài khoản thành viên rồi viết bài, thêm ảnh bìa PNG/JPG/WebP tối đa 5 MB, lưu bản nháp hoặc chia sẻ.
- `/community/?mine=1`: xem, sửa, gỡ bài của chính mình. Bản nháp chỉ tác giả xem được; bài công khai hiển thị tên tác giả, không hiển thị email.
- Trang bài viết cho phép thành viên thả/bỏ tim, viết và gỡ bình luận của mình. Mỗi tài khoản có một trái tim cho mỗi bài.
- Quản trị `/admin/` → **Chuyện len**: ẩn/hiện bài công khai và ẩn bình luận; không liệt kê bản nháp riêng tư.
- Chạy `npm run db:seed` để thêm ba câu chuyện mẫu và hai sản phẩm thủ công minh họa. Bài mẫu thuộc `user@tiemlen.test` / `UserTest123!`. Seed giữ nguyên dữ liệu đã tồn tại khi chạy lại. Thay ảnh, nội dung và thông tin sản phẩm bằng dữ liệu của bạn trước khi sử dụng thực tế.

Schema v3 tự cập nhật khi khởi động, giữ nguyên tài khoản và đơn hàng. Sao lưu cả SQLite và thư mục uploads theo hướng dẫn phía trên. Thanh toán QR vẫn để làm sau.

## Gallery sản phẩm

Mỗi sản phẩm có tối đa 12 ảnh/video, với duy nhất một ảnh chính cho danh sách. Trong admin → Sản phẩm, tải nhiều file hoặc thêm URL HTTPS, chọn ảnh chính, đổi thứ tự và gỡ file rồi lưu sản phẩm. Ảnh PNG/JPG/WebP tối đa 5 MB; video MP4/WebM tối đa 30 MB. Nên dùng clip ngắn, MP4 H.264 để tương thích tốt trên điện thoại. Hệ thống không chuyển mã hoặc cắt video tự động.

Chi tiết sản phẩm mở với ảnh chính, có thumbnail, nút trước/sau, phím mũi tên khi focus gallery và vuốt ngang trên điện thoại. Video có điều khiển, không tự phát và dừng khi chuyển slide hoặc đóng chi tiết. Migration 004 giữ ảnh cũ làm ảnh chính, không xóa dữ liệu.

## Thông báo trong tài khoản

Migration 005 nâng schema lên v5, giữ nguyên dữ liệu. Chuông xuất hiện sau đăng nhập trên trang chủ, cộng đồng, bài viết, viết bài và tài khoản. Thông báo chưa đọc được cập nhật mỗi 15 giây khi trang đang mở, và khi quay lại tab; mở chuông để đọc hoặc làm mới danh sách. Có đọc từng thông báo và đọc tất cả.

Thông báo cho tác giả khi người khác thả tim/bình luận; không thông báo tương tác của chính mình. Một người thả/bỏ/thả tim lại không tạo trùng thông báo cho cùng bài. Bài không còn công khai hoặc bình luận bị ẩn sẽ không xuất hiện trong danh sách/số chưa đọc. Không tạo lại thông báo cho tương tác cũ trước migration.

Admin gửi tiêu đề/nội dung đến tất cả tài khoản khách đang có, với lịch sử gửi và số người nhận. Thành viên đăng ký sau không nhận lại thông báo cũ. Đây là thông báo trong website, không phải email, SMS hay Web Push khi đóng trình duyệt.

### Admin tạm thời trên Render Free

Không có Shell: đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong **Render → Environment**, rồi redeploy. Server chỉ tạo email chưa có, không đổi mật khẩu tài khoản hiện hữu, không seed. Đây là giải pháp **tạm thời**, có comment trong `server/services/bootstrap-admin.js`; xem [hướng dẫn Render](docs/operations.md#tạo-admin-tạm-thời-trên-render-free-không-có-shell).
