# Cây Tri Ân — Hướng dẫn cài đặt và vận hành

Web gồm 3 phần:

| File | Vai trò | Ai sửa |
| --- | --- | --- |
| `config.js` | Tên công ty, ngày sinh nhật, phòng ban, link máy chủ và **toàn bộ chữ hiển thị** | Nhắn Claude, hoặc tự sửa trên GitHub |
| `index.html` | Giao diện, cây, hiệu ứng | Không cần sửa |
| `Code.gs` | Máy chủ chạy miễn phí trên Google Apps Script, lưu lời chúc vào Google Sheet | Dán 1 lần |

Khi `backend.apiUrl` trong `config.js` còn trống, web chạy **bản xem trước**: hiện lời chúc mẫu, có dải thông báo ở đầu trang, không lưu gì.

## Kích hoạt máy chủ (khoảng 10 phút, làm 1 lần)

Máy chủ phải tạo bằng tài khoản Google của Ban tổ chức, vì lời chúc sẽ nằm trong Google Sheet của tài khoản đó.

1. Vào sheets.google.com, tạo **bảng tính trống**, đặt tên `Cay Tri An`.
2. Menu **Tiện ích mở rộng → Apps Script**. Xóa hết code mẫu, dán toàn bộ nội dung file `Code.gs`, bấm biểu tượng **Lưu**.
3. Ở thanh trên cùng chọn hàm `setup`, bấm **Chạy**. Google hỏi quyền: chọn tài khoản → **Nâng cao** → **Đi tới dự án (không an toàn)** → **Cho phép**. Cảnh báo này xuất hiện vì đây là script tự viết, không phải ứng dụng công khai.
4. Bấm **Triển khai → Tùy chọn triển khai mới**, bấm bánh răng chọn **Ứng dụng web**:
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai**, sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
5. Gửi URL đó cho Claude trong chat. Claude điền vào `config.js` và đưa lên GitHub, sau khoảng 1 phút web chạy thật.

"Bất kỳ ai" là cần thiết để nhân viên không phải đăng nhập Google. Dữ liệu vẫn được bảo vệ bằng mã PIN, và hệ thống không ghi lại người gửi.

## Cài đặt máy chủ

Trong Apps Script, bấm bánh răng **Cài đặt dự án → Thuộc tính tập lệnh**:

| Thuộc tính | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PIN` | `VinRobotics2026` | Mã PIN để vào trang. Nên đổi trước khi gửi cho mọi người |
| `ADMIN_PIN` | `VRAdmin2026` | Mã PIN riêng của Ban tổ chức để vào trang quản trị. **Bắt buộc đổi** và không chia sẻ |
| `DEPARTMENTS` | (trống) | Tự tạo khi lưu trong tab Phòng ban. Xóa thuộc tính này để quay về danh sách trong `config.js` |
| `AUTO_APPROVE` | `true` | `true` = lời chúc lên cây ngay, Ban tổ chức bỏ duyệt nếu cần ẩn; `false` = duyệt từng lời chúc trước |

**Đổi mã PIN:** cách nhanh nhất là Quản trị → tab **Mã PIN** (đổi cùng lúc trên cả Google và Azure, có hiệu lực ngay). Đổi trực tiếp thuộc tính ở đây thì có hiệu lực sau tối đa 2 phút (máy chủ giữ cài đặt trong bộ nhớ đệm để không vượt giới hạn 50.000 lượt đọc/ngày của Google), không cần triển khai lại.

## Vận hành hằng ngày

### Trang quản trị (khuyên dùng)

Mở web, bấm **"Ban tổ chức? Đăng nhập quản trị"** ở màn hình nhập PIN (hoặc mở link có đuôi `#admin`), nhập `ADMIN_PIN`. Sau khi đăng nhập, nút **Quản trị** xuất hiện ở đầu trang.

- Mặc định lời chúc **tự duyệt**, lên cây ngay khi gửi. Gặp lời chúc không phù hợp: tab **Đã duyệt** → **Bỏ duyệt** để ẩn.
- Tab **Chờ duyệt**: lời chúc đã bị bỏ duyệt (hoặc mọi lời chúc mới nếu đặt `AUTO_APPROVE` = `false`); bấm **Duyệt** để đưa lại lên cây.
- Tab **Đã duyệt**: bỏ duyệt để ẩn lời chúc khỏi cây; lời chúc tiêu biểu luôn do Ban tổ chức chọn tay, bấm **☆ Tiêu biểu** để chọn lời chúc nổi bật (chọn tiêu biểu thì tự duyệt luôn).
- Tab **Phòng ban**: kéo ⋮⋮ hoặc bấm ↑ ↓ để đổi thứ tự, bấm ô màu để đổi màu lá, sửa tên trực tiếp, thêm hoặc xóa phòng ban, rồi bấm **Lưu phòng ban**. Đổi tên thì các lời chúc cũ của phòng đó cũng đổi theo. Danh sách lưu trên máy chủ (thuộc tính `DEPARTMENTS`) và được ưu tiên hơn danh sách trong `config.js`.
- Tab **Tiêu biểu**: xem các lời chúc đã chọn; nút **Trình chiếu lời chúc tiêu biểu** mở ngay màn trình chiếu.
- Trình chiếu tự ưu tiên lời chúc tiêu biểu khi có; ở góc trên có nút chuyển **★ Tiêu biểu / Tất cả**.
- Phiên quản trị chỉ lưu trong tab trình duyệt đang mở; đóng tab là đăng xuất.

### Quay thưởng và xuất dữ liệu

- **Quay thưởng:** khi đã đăng nhập quản trị, bấm nút hộp quà ở đầu trang (bên trái nút trình chiếu). Chọn tên giải, khoảng thời gian gửi lời chúc, bấm **Quay**. Mỗi lời chúc là 1 lượt; người đã trúng (theo Account VGR) không còn trong danh sách. Bấm **Hủy kết quả này** nếu người trúng vắng mặt.
- **Xuất dữ liệu:** Quản trị → tab **Lời chúc** → **Xuất Excel (CSV)**: toàn bộ lời chúc kể cả đã xóa, kèm Account VGR, trạng thái, giải thưởng.

### Hoặc duyệt trực tiếp trong Google Sheet

- **Duyệt lời chúc**: tick cột **Đã duyệt**. Lá xuất hiện trên cây trong khoảng 1 phút.
- **Chọn tiêu biểu**: tick cột **Tiêu biểu** (cột này tự thêm ở lần chạy đầu tiên sau khi cập nhật code).
- **Ẩn một lời chúc đã duyệt**: bỏ tick.
- **Gửi cho CBNV**: link web + mã PIN qua email hoặc nhóm chat nội bộ. Khi dán link vào Zalo, Teams, Facebook sẽ hiện ảnh xem trước.
- **Ngày sinh nhật**: mở web trên máy chiếu, bấm **Trình chiếu** (toàn màn hình; phím ← → để chuyển, Esc để thoát).

## Máy chủ dự phòng Azure

Ngoài Google còn một máy chủ dự phòng trên Azure (Function App `caytrian-vinrobotics`, resource group `cay-tri-an-rg`, vùng Southeast Asia, gói Consumption).

- **Chuyển máy chủ:** Quản trị → tab **Máy chủ** → **Chuyển sang Azure/Google**. Mọi người tự chuyển theo trong khoảng 1–2 phút.
- **Tự chuyển khi lỗi:** nếu máy chủ đang dùng không trả lời 3 lần liên tiếp, trình duyệt của nhân viên tự chuyển sang máy chủ còn lại trong 5 phút rồi thử lại.
- **Dữ liệu riêng:** lời chúc trên Google và Azure không chép qua lại. Danh sách phòng ban nên sửa ở cả hai (vào tab Phòng ban sau khi chuyển).
- **Mã PIN:** đặt ở Function App → Settings → Environment variables (`PIN`, `ADMIN_PIN`, `AUTO_APPROVE`). Phải giống bên Google.
- **Dữ liệu:** bảng `LoiChuc` và `CaiDat` trong Storage account của resource group.
- **Cập nhật code:** sửa thư mục `azure/`, đóng gói lại `azure/dist/cay-azure.zip`, đẩy lên GitHub. Máy chủ tự nạp gói mới lần khởi động kế tiếp (sau khoảng 20 phút không dùng, hoặc bấm Restart).
- **Chi phí:** cảnh báo ngân sách `cay-tri-an-5usd` gửi email khi chi tiêu đạt 80% của 5 USD/tháng. Muốn ngừng hẳn: xóa resource group `cay-tri-an-rg`.

## Khi sửa `Code.gs`

Mỗi lần sửa code máy chủ: **Triển khai → Quản lý tùy chọn triển khai → bút chì → Phiên bản: Phiên bản mới → Triển khai**. Làm như vậy URL giữ nguyên.

## Sửa chữ và thông tin hiển thị

Mọi chữ và danh sách phòng ban nằm trong `config.js`, nhóm theo khu vực (đếm ngược, thẻ trạng thái, form gửi, cổng PIN, trình chiếu…). Các từ trong ngoặc nhọn như `{company}`, `{date}`, `{n}` được thay tự động. Cách nhanh nhất là nhắn Claude nội dung muốn đổi.

Riêng ảnh và chữ hiện khi chia sẻ link (Zalo, Facebook) nằm trong thẻ `<meta>` đầu file `index.html` và ảnh `assets/og-image.png`, vì các ứng dụng chat đọc chúng trước khi trang chạy.

## Cây lớn theo số lời chúc

Mốc mặc định (sửa trong `config.js`, mục `stages`):

| Số lời chúc | Giai đoạn |
| --- | --- |
| 0–4 | Hạt mầm |
| 5–14 | Mầm non |
| 15–39 | Cây non |
| 40–79 | Cây nhỏ |
| 80–149 | Cây đang lớn |
| 150–249 | Cây trưởng thành |
| 250+ | Đại thụ nở hoa |

Hoa đỏ = lời chúc gửi cả công ty; lá màu = gửi phòng ban hoặc đồng nghiệp (màu theo thứ tự phòng ban trong `config.js`).
