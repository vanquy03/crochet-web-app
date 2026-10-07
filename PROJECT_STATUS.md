# Tiệm Len — trạng thái dự án và bàn giao cho AI

Cập nhật: **07/10/2026**, múi giờ Asia/Bangkok. Đọc file này trước khi tiếp tục công việc, sau đó kiểm tra `git status`, `git log` và source để xác nhận trạng thái thực tế. Đây là bản bàn giao của phiên làm việc, không phải danh sách yêu cầu mới cần tự động triển khai.

## Cập nhật mới nhất — 07/10/2026

Phần này ưu tiên hơn các mô tả COD/schema v4 trong bản bàn giao ngày trước.

- **Tạm thời cho Render Free:** `server/services/bootstrap-admin.js` tạo admin từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` trước khi server listen. Chỉ tạo email chưa có, không đổi mật khẩu hoặc seed, không log bí mật. Thiếu cả hai thì bỏ qua; thiếu một/sai cấu hình thì fail startup. Có comment đánh dấu tạm thời trong code; hướng dẫn trong README/docs/operations.md và `.env.example`.

- Theo yêu cầu chủ tiệm, bỏ yêu cầu mật khẩu tối thiểu 12 ký tự ở đăng ký khách, đổi mật khẩu admin và CLI tạo admin. Cho phép mật khẩu một ký tự, không yêu cầu độ phức tạp; vẫn bắt buộc nhập, tối đa 200 ký tự, xác nhận nhập lại, hash và xác thực đăng nhập.

- Gộp “Chuyện của Nhung” và “Góc chuyện len” thành một mục **Góc sẻ chia** (tên cuối cùng được chủ tiệm chọn) tại `/community/`. Bỏ section giới thiệu riêng `#cau-chuyen` trên trang chủ, đưa lời giới thiệu Nhung vào phần mở đầu trang cộng đồng. Trang chủ giữ phần mời chia sẻ/xem bài mới nhất dưới cùng tên này.

- Chủ tiệm là **Nhung Cap**. Tên hiển thị/logo/title dùng Nhung Cap; lời giới thiệu và CTA dùng “Nhung” hoặc “mình”, không xưng “tiệm”. Settings mặc định đổi sang Nhung Cap; tên mặc định cũ Tiệm Len được chuẩn hóa khi đọc để không ghi đè tên tùy chỉnh hoặc thông tin liên hệ. Giữ nguyên cookie/storage key và mã sản phẩm để tương thích dữ liệu cũ.
- Bỏ section FAQ “Một vài điều bạn muốn biết”; tiêu đề sản phẩm đổi “Thành phẩm của mình” kèm icon hộp quà SVG. “Gợi ý của Nhung” vẫn giữ thứ tự API `ORDER BY id DESC`, không có thuật toán đề xuất hoặc gắn cờ nổi bật.
- Contact hỗ trợ TikTok với icon riêng; cấu hình `tiktokUrl` tại Admin → Cài đặt cửa hàng. Chỉ chấp nhận HTTPS trên tiktok.com/www/m/vm/vt.tiktok.com; để trống thì ẩn kênh, không thêm tài khoản giả. Chủ tiệm chưa cung cấp URL thật trong thời điểm cập nhật này. Test mới kiểm tra lưu/xóa URL hợp lệ và từ chối HTTP, JavaScript, host giả; tổng 36 test pass, check/build đạt.
- **Đóng checkout:** trang chủ không khởi tạo giỏ/checkout, không còn giỏ hàng, số lượng hoặc nút đặt COD. Product detail có “Liên hệ với tiệm” dẫn tới `#mua-hang`, kèm mã sản phẩm để khách nhắn shop. Contact không gợi ý đặt COD khi chưa cấu hình kênh. Người chưa đăng nhập vẫn xem và hỏi mua được.
- `createApp` mặc định `checkoutEnabled=false`; server runtime không bật nó. `POST /api/orders` từ phiên khách hợp lệ bị chặn 403 trước khi tạo đơn/giữ tồn kho. Các service/module/test checkout cũ vẫn giữ để bảo toàn chức năng và đơn cũ; test legacy đặt `checkoutEnabled=true` riêng trong fixture, không bật trong runtime. Không dùng tham số này để mở lại bán hàng nếu chưa được chủ tiệm yêu cầu.
- Đơn cũ, lịch sử khách, admin xử lý đơn cũ vẫn giữ. Không xóa dữ liệu runtime.
- **Schema v5:** migration `005-notifications.sql` thêm `announcements` và `notifications`; không reset dữ liệu.
- Chuông cho tài khoản khách trên trang chủ/cộng đồng/bài viết/viết bài/tài khoản. Badge chưa đọc, list phân trang 20 mục, đọc một/đọc tất cả, xem bài liên quan, làm mới. Poll số chưa đọc mỗi 15 giây khi tab visible, refresh khi quay lại tab. Không thay thế nội dung popup đang đọc khi poll.
- Like/comment mới thông báo cho tác giả; không self-notify, một người thả/bỏ/thả lại tim không spam trùng cho cùng bài. Không backfill tương tác cũ. Không gửi nội dung bình luận/email trong thông báo. Bài không còn public/bình luận ẩn bị loại khỏi list và badge.
- Admin → **Thông báo**: gửi tiêu đề/nội dung tới tất cả khách đang có, lưu lịch sử/số người nhận, rate limit 10 broadcast/15 phút theo IP. Người đăng ký sau không nhận broadcast cũ. Phiên admin/khách và CSRF vẫn tách biệt.
- Đây là **thông báo trong website**, chưa email/SMS/Web Push khi đóng trình duyệt.
- File mới: `server/services/notifications.js`, `server/routes/notifications.js`, `server/migrations/005-notifications.sql`, `src/js/features/notifications.js`.
- Kiểm tra tự động hiện **38 test pass**, thêm test chặn checkout không đổi stock, thông báo tương tác/quyền sở hữu/CSRF/chống trùng/kiểm duyệt, phân trang/read-all, admin broadcast, CTA detail liên hệ.
- Đã thử Chromium với dữ liệu local riêng ở 320/375/768/1280px: popup thông báo và CTA liên hệ không tràn ngang; khách chưa đăng nhập vẫn hỏi mua được. Đã thử mở bài từ thông báo, đọc tất cả, admin gửi thông báo, hiển thị nội dung an toàn và không có lỗi JavaScript. Chưa thử thiết bị iOS/Android thật.
- Badge đã được kiểm tra tự cập nhật sau broadcast trong chu kỳ poll, không cần tải lại trang. `format:check`, `check`, `build` và `git diff --check` đều đạt.
- Commit `957017b` của bản bàn giao trước đã push thành công lên repo chính `vanquy03/crochet-web-app` ngày 07/10/2026. Đợt thay đổi thông báo/đóng checkout là công việc mới; kiểm tra Git để biết đã commit/push hay chưa, không suy ra từ trạng thái lần trước.

## 1. Mục tiêu và thông tin của chủ tiệm

Website **Tiệm Len** trưng bày/bán các sản phẩm len do chủ tiệm tự tay đan móc. Chủ tiệm xác nhận sản phẩm đăng bán và ảnh sản phẩm là thật, đồng thời nhận **đan móc theo yêu cầu**; khách liên hệ qua các kênh được cấu hình trong admin. Website còn có cộng đồng chia sẻ chuyện len.

Yêu cầu giao diện đã thống nhất:

- Tông kem/hồng nhẹ, thân thiện, hợp đồ thủ công; typography hỗ trợ tiếng Việt.
- Dùng tiện trên điện thoại, không tràn ngang ở màn hình nhỏ; nút dễ chạm.
- Hiệu ứng hover, nhấn, đóng/mở nhẹ; tôn trọng `prefers-reduced-motion`.
- Lời mời chia sẻ câu chuyện ấm áp, có hành động rõ ràng.
- Không dùng lời cảnh báo rằng ảnh sản phẩm là ảnh minh họa cho sản phẩm thật của chủ tiệm.

**Lưu ý:** source vẫn có dữ liệu seed, ảnh SVG mẫu và chế độ `shop.demo`. Chúng là dữ liệu thử nghiệm; không phải tất cả dữ liệu đi kèm repo đều là sản phẩm thật của chủ tiệm. Không tự xóa/reset database hoặc seed vào dữ liệu đang dùng.

## 2. Kiến trúc và cách chạy

- Frontend: HTML/CSS/JavaScript ES modules thuần, không framework/bundler.
- Backend: Node.js **24+**, Express 5, SQLite tích hợp `node:sqlite`.
- `src/`: source frontend; sửa ở đây.
- `dist/`: bản frontend build, được theo dõi trong Git. `npm run build` copy `src/` sang `dist/`.
- `server/`: API, phiên đăng nhập, dữ liệu, migrations, tồn kho, đơn và cộng đồng.
- `scripts/`: build/check, seed test, tạo admin, backup.
- `tests/`: Node test runner; `docs/api.md` và `docs/operations.md`: tài liệu API/vận hành.
- Development phục vụ `src/`; production phục vụ `dist/`. Chạy backend cùng frontend, không mở HTML bằng `file://`.
- Dữ liệu runtime trong `DATA_DIR` (mặc định `data/`): SQLite, uploads, backups. `.env`, dữ liệu runtime và `node_modules` được Git ignore.

Lệnh chính:

```sh
npm ci
npm run dev
npm run admin:create
npm run db:seed
npm run format:check
npm run check
npm test
npm run build
npm run db:backup
```

Không chạy seed trên production. Tài khoản seed dành cho local/test được mô tả trong README. Không có tài khoản production mặc định.

## 3. Chức năng đã có trước các chỉnh sửa giao diện gần đây

### Cửa hàng và quản trị

- Danh sách sản phẩm, tìm kiếm, lọc nhóm/loại, sắp xếp giá, xem chi tiết.
- Sản phẩm phân nhóm `supplies` / `handmade`; loại `cotton` / `milk` / `tools`.
- Giỏ hàng, đặt COD, phí giao hàng, ngưỡng miễn phí giao hàng.
- Khách phải đăng nhập khi thêm vào giỏ/đặt hàng; giỏ được giữ qua luồng đăng nhập.
- Backend tự tính giá/tổng; kiểm tra tổng kỳ vọng, tồn kho, idempotency để tránh đơn trùng.
- Đặt đơn giữ tồn kho; hủy đơn hợp lệ hoàn tồn kho đúng một lần.
- Admin: sản phẩm/ảnh/tồn kho, dashboard, đơn hàng/trạng thái/thu tiền, cài đặt shop, đổi mật khẩu.
- Tài khoản khách: đăng ký/đăng nhập/đăng xuất, lịch sử và chi tiết đơn của chính mình.
- Phiên khách/admin riêng, cookie HttpOnly, CSRF, same-origin và rate limits; Secure cookie khi production.

### Cộng đồng

- `/community/`: đọc, tìm kiếm và lọc bài; `/community/?mine=1`: bài của mình.
- `/write/`: viết; `/write/?id=...`: sửa; `/story/?id=...`: đọc chi tiết.
- Chủ đề: Sống chậm, Hành trình đan, Kỷ niệm, Mẹo nhỏ.
- Bản nháp chỉ tác giả xem; bài công khai có tim/bình luận; gỡ bài/bình luận của mình.
- Admin ẩn/hiện bài công khai và ẩn bình luận; không liệt kê bản nháp riêng tư.

## 4. Các thay đổi đã hoàn thành trong phiên này

### Gallery nhiều ảnh và video sản phẩm

- Migration `server/migrations/004-product-media.sql` nâng schema lên **v4**, thêm `products.media` JSON; giữ nguyên dữ liệu cũ.
- Mỗi sản phẩm tối đa **12** ảnh/video. Gallery có nội dung phải có **đúng một ảnh chính** (`type: image`, `primary: true`); video không được làm ảnh chính.
- `imageUrl` tiếp tục trả URL ảnh chính cho danh sách và tương thích code cũ.
- API cũ không gửi `media` tạo gallery từ `imageUrl`; `media: []` xóa gallery. URL phải hợp lệ và không trùng.
- Admin có tải nhiều file tuần tự, thêm URL HTTPS, chọn ảnh chính, đổi thứ tự, gỡ rồi lưu sản phẩm. Giữ kiểm tra `version` khi sửa.
- `POST /api/admin/media`: multipart trường `file`, cần phiên admin/CSRF; ảnh PNG/JPG/WebP tối đa 5 MB, video MP4/WebM tối đa 30 MB. Endpoint upload ảnh cũ vẫn giữ.
- Upload kiểm tra chữ ký file; **chưa chuyển mã, cắt video hoặc kiểm tra thời lượng/codec thực tế**. Khuyến nghị clip ngắn MP4 H.264. URL HTTPS ngoài có thể lỗi hoặc bị chặn bởi nguồn bên ngoài.
- Chi tiết sản phẩm giữ bố cục thông tin hiện có, mở ảnh chính trước; vuốt ngang bằng scroll-snap, thumbnail, nút trước/sau, phím trái/phải khi focus gallery.
- Video có native controls, `playsinline`, không tự phát, dừng khi chuyển slide/đóng dialog. Có xử lý đổi kích thước gallery.
- File chính: `src/js/components/product-gallery.js`, `src/js/features/catalog.js`, `src/admin/admin.js`, `server/routes/products.js`, `server/validation.js`, `server/uploads.js`, `server/database.js`.

### Responsive, animation, dropdown và font

- Cải thiện header/navigation mobile, kích thước nút, giỏ hàng/dialog, chữ dài, gallery và admin media editor.
- Dialog có transition mở/đóng bằng `@starting-style`, `display/overlay allow-discrete`; hover/nhấn nhẹ; có reduced-motion.
- Dropdown “Gợi ý của tiệm” và select ở form/admin: nền kem, viền hồng, bo góc, dấu tick, mục chọn màu hồng, mũi tên xoay và animation.
- Select dùng progressive enhancement `appearance: base-select`; **trình duyệt chưa hỗ trợ dùng picker gốc**, nên popup có thể khác giao diện giữa các trình duyệt.
- Đổi font tiêu đề từ Georgia hệ thống sang **Lora**, lưu local normal/italic variable fonts và giấy phép OFL tại `src/fonts/`; biến CSS `--font-heading`. Đã kiểm tra tiêu đề tiếng Việt thực sự render bằng Lora, không ghép font fallback.

### Nội dung trang chủ và contact

- Bỏ link “Chọn màu cho dự án tiếp theo →”.
- Bỏ dòng footer “Bản mẫu website · 2026”.
- Footer hiện: “Sản phẩm tự tay làm, hình ảnh thực tế 100%.”
- Dưới “Những điều tự tay làm”: xác nhận sản phẩm do tiệm tự làm và nhận đan theo yêu cầu; link tới `#mua-hang`.
- Khung mời cộng đồng: “Hãy chia sẻ câu chuyện của bạn với chúng mình.”, mô tả gợi ý, nút tới `/write/`, link đọc `/community/`; bài mới bên dưới.
- Contact: khung hồng nổi bật, tiêu đề “Bạn có ý tưởng, tiệm có đôi tay.”, các thẻ có icon SVG cho Zalo/Facebook/email/điện thoại, ba bước đặt riêng.
- Kênh contact lấy **từ settings thật**, chỉ hiển thị khi hợp lệ; không hardcode số/tài khoản cá nhân. Khi chưa cấu hình, có thông báo thay thế. Nút liên hệ trong giỏ vẫn giữ hành vi hỏi mua/copy nội dung.
- File chính: `src/index.html`, `src/js/features/contact.js`, các stylesheet.

### Form viết bài mới

- Lấy cảm hứng từ WordPress Write và Ghost: vùng viết rộng, sidebar cho ảnh bìa/chủ đề/lời mở đầu; mobile một cột.
- Thanh **Xem trước / Lưu nháp / Chia sẻ** sticky khi cuộn; nút dễ chạm.
- Tiêu đề/nội dung tự giãn; đếm ký tự và ước tính phút đọc.
- Xem trước bằng dialog, render text an toàn, hiện ảnh bìa/chủ đề/tác giả.
- Lưu nháp ở lại trang, cập nhật ID trong URL và `version`, có trạng thái đã lưu/chưa lưu; không tạo bản nháp mới khi lưu tiếp.
- Backend cho lưu draft chưa hoàn chỉnh; tiêu đề trống thành “Câu chuyện chưa đặt tên”. Publish vẫn cần tiêu đề ≥3 ký tự, nội dung ≥20 ký tự.
- Sửa bài đã published: nút “Lưu thay đổi”/“Cập nhật bài”, không tự biến bài công khai thành draft.
- Cảnh báo khi rời trang có thay đổi chưa lưu, khóa form trong lúc upload/lưu, bảo toàn nội dung khi lỗi.
- **Không tự động lưu**, không lưu nội dung bài vào localStorage; người viết chủ động nhấn Lưu nháp. Editor hiện là **văn bản thuần**, chưa có rich text/block editor, ảnh trong thân bài hoặc gallery bài viết.
- File chính: `src/write/index.html`, `src/js/pages/write.js`, `src/styles/community.css`, `server/services/community.js`.

## 5. Kiểm tra đã thực hiện

- Lần kiểm tra chức năng gần nhất: **30 test pass**, không fail. Có test mới cho gallery/ảnh chính/URL, upload video/Range/auth, migration v3→v4 giữ ảnh cũ và lưu nháp chưa hoàn chỉnh rồi publish.
- Đã chạy kiểm tra cú pháp/import/tài nguyên HTML, Prettier và build; `dist/` được cập nhật.
- Playwright Chromium: các viewport **320, 375, 768, 1280px**; gallery và các trang còn kiểm tra thêm 390px. Không tràn ngang trong các màn đã kiểm tra.
- Kiểm tra browser thực tế: chọn/sắp xếp/lưu ảnh chính trong admin; dropdown mở/đóng/keyboard/sắp xếp; font tiếng Việt; link mời viết/đăng nhập; contact cấu hình và fallback; viết nháp trống, reload, validation, preview không thực thi HTML, upload/gỡ ảnh và publish. Không có lỗi JS trong những luồng đó.
- **Chưa kiểm tra trên thiết bị iOS/Android thật hoặc Safari/Firefox.** Viewport Chromium không thay thế hoàn toàn kiểm tra bàn phím ảo, trình duyệt mobile và codec video thật.
- Script/screenshot browser chỉ là công cụ kiểm tra tạm ngoài repo, không phải bộ test browser được commit.

## 6. Môi trường kiểm tra trong phiên này

Workspace: `/mnt/d/Sources/Private/crochet-web-app` (WSL, Windows drive D:).

`node` chưa có trong PATH Linux ban đầu. Runtime Node 24 được tải tạm tại `/tmp/node-v24.21.0-linux-x64/bin/node`. Nếu còn runtime này:

```sh
PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm test
```

Đường dẫn `/tmp` không bền vững; máy khác cần cài Node 24+. Dependencies repo không thêm Playwright. Browser tools được cài tạm tại `/tmp/crochet-browser`; dữ liệu thử tại `/tmp/crochet-gallery-review`, không sửa database của chủ tiệm.

## 7. Git và bàn giao

- Remote: `https://github.com/vanquy03/crochet-web-app.git`; nhánh `main`.
- Commit trước đợt cải thiện UI này: `73b8dbc` — accounts/community/handmade products. Lần push từ Git Linux trước đó thất bại vì thiếu xác thực; remote lúc kiểm tra đầu lần bàn giao còn ở `34f52e6`.
- Chủ tiệm đã yêu cầu **commit và push toàn bộ code, kèm file bàn giao này**. Các cải thiện mô tả ở trên nằm trong commit chứa file này; dùng `git log -1` để lấy hash chính xác.
- Git Windows (`git.exe`) hiện có credential helper `manager` và danh tính user đã cấu hình; ưu tiên thử Git đó nếu Git Linux không xác thực được. Không đọc/in token, không force-push; khi push bị từ chối, báo đúng lỗi và giữ commit local.
- Xác nhận push bằng hash remote và local, không suy ra thành công chỉ từ commit local. Báo cáo trong chat là nơi xác nhận kết quả push của lần bàn giao.

## 8. Phần còn thiếu và việc nên xác nhận khi tiếp tục

Đây là các giới hạn/việc đề xuất, **chưa được giao triển khai tự động**:

- Chưa có thanh toán QR/online, email/SMS tự động, API vận chuyển, xác thực email và quên mật khẩu.
- Chưa rich text, ảnh trong thân bài hoặc tự lưu bài.
- Video chưa chuyển mã/kiểm tra thời lượng; cần thử clip thật trên mobile.
- Kiểm tra iOS/Android thật, Safari/Firefox, bàn phím ảo và tính tiện dụng khi viết dài.
- Xác nhận settings contact, demo flag và dữ liệu production; còn thông báo demo trong JS khi `shop.demo` bật. Không tự sửa dữ liệu runtime.
- Trong modal sản phẩm, một số mô tả/type/quy cách còn theo nhóm len nguyên liệu; có thể cần viết riêng cho sản phẩm handmade.
- Tài liệu API được cập nhật gallery/draft, nhưng cần rà soát độ đầy đủ của các endpoint cộng đồng nếu thay đổi tiếp.

## 9. Nguyên tắc tiếp tục

1. Đọc README, tài liệu này và các file liên quan; kiểm tra Git trước khi sửa.
2. Giữ lựa chọn giao diện/nội dung của chủ tiệm; không khôi phục link/dòng footer đã yêu cầu bỏ.
3. Sửa `src/`, chạy build cập nhật `dist/`; không chỉnh riêng output.
4. Giữ migration tương thích, quyền sở hữu bài/đơn, CSRF, idempotency, tồn kho và version checks.
5. Không reset database, không force-push, không seed production, không thêm thông tin liên hệ giả.
6. Chạy checks phù hợp, báo rõ điều đã kiểm tra và giới hạn; cập nhật file bàn giao khi hoàn thành đợt công việc mới.

## 10. Tham khảo thiết kế trong phiên

- [MDN: dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)
- [MDN: customizable select](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)
- [web.dev: reduced motion](https://web.dev/articles/prefers-reduced-motion)
- [LoveCrafts: cộng đồng](https://www.lovecrafts.com/en-us/blogs/articles-us/the-flock)
- [The Moth: Tell Your Story](https://www.themoth.org/tell-your-story)
- [Webflow: contact page examples](https://webflow.com/blog/contact-us-page)
- [WordPress Write editor](https://wordpress.com/support/editors/write-editor/)
- [Ghost: publishing/preview](https://ghost.org/help/publishing-content/)
