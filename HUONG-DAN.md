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
| `AUTO_APPROVE` | `false` | `false` = Ban tổ chức duyệt từng lời chúc; `true` = lời chúc lên cây ngay |

Đổi thuộc tính có hiệu lực ngay, không cần triển khai lại.

## Vận hành hằng ngày

- **Duyệt lời chúc**: mở Google Sheet, đọc cột Nội dung, tick cột **Đã duyệt**. Lá xuất hiện trên cây trong khoảng 1 phút.
- **Ẩn một lời chúc đã duyệt**: bỏ tick.
- **Gửi cho CBNV**: link web + mã PIN qua email hoặc nhóm chat nội bộ. Khi dán link vào Zalo, Teams, Facebook sẽ hiện ảnh xem trước.
- **Ngày sinh nhật**: mở web trên máy chiếu, bấm **Trình chiếu** (toàn màn hình; phím ← → để chuyển, Esc để thoát).

## Khi sửa `Code.gs`

Mỗi lần sửa code máy chủ: **Triển khai → Quản lý tùy chọn triển khai → bút chì → Phiên bản: Phiên bản mới → Triển khai**. Làm như vậy URL giữ nguyên.

## Sửa chữ và thông tin hiển thị

Mọi chữ nằm trong `config.js`, nhóm theo khu vực (đếm ngược, thẻ trạng thái, form gửi, cổng PIN, trình chiếu…). Các từ trong ngoặc nhọn như `{company}`, `{date}`, `{n}` được thay tự động. Cách nhanh nhất là nhắn Claude nội dung muốn đổi.

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
