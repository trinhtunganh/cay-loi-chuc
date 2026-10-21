# Cây lời chúc — Hướng dẫn cài đặt

Web gồm 2 phần:

- `index.html`: giao diện (cây, lá, gửi lời chúc, tìm kiếm, trình chiếu). Chỉ cần 1 file, đặt lên host nào cũng chạy.
- `Code.gs`: backend chạy miễn phí trên Google Apps Script, lưu lời chúc vào Google Sheet.

Mở thẳng `index.html` bằng trình duyệt là chạy **chế độ demo** (64 lời chúc mẫu, nhập PIN bất kỳ). Làm theo các bước dưới để chạy thật.

## Bước 1 — Tạo backend (15 phút)

1. Vào sheets.google.com, tạo bảng tính mới, đặt tên `Cay loi chuc`.
2. Menu **Tiện ích mở rộng → Apps Script**. Xóa code mẫu, dán toàn bộ nội dung `Code.gs`, bấm Lưu.
3. Chọn hàm `setup` ở thanh trên cùng, bấm **Chạy**. Lần đầu Google hỏi quyền: chọn tài khoản → Nâng cao → Đi tới dự án → Cho phép.
4. Quay lại Sheet: đã có tab `LoiChuc` với các cột ID, Thời gian, Loại người nhận, Phòng ban, Tên người nhận, Nội dung, Đã duyệt.
5. **Đổi mã PIN**: trong Apps Script, bấm biểu tượng bánh răng (Cài đặt dự án) → Thuộc tính tập lệnh → sửa giá trị `PIN`. PIN mặc định là `SNMO2026`; nên dùng từ 6 ký tự trở lên.
6. **Triển khai**: bấm **Triển khai → Tùy chọn triển khai mới** → loại **Ứng dụng web**.
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   - Bấm Triển khai, sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/.../exec`).

"Bất kỳ ai" là bắt buộc để người không đăng nhập Google vẫn gửi được. Dữ liệu vẫn được bảo vệ bằng PIN, và hệ thống không ghi lại người gửi.

## Bước 2 — Cấu hình giao diện (5 phút)

Mở `index.html` bằng VS Code, tìm khối `CONFIG` gần đầu phần `<script>` và sửa:

| Mục | Ý nghĩa |
| --- | --- |
| `API_URL` | Dán URL ứng dụng web ở bước 1 |
| `COMPANY_NAME` | Tên công ty hiển thị trên trang |
| `BIRTHDAY` | Ngày sinh nhật, dạng `2026-11-04` (dùng cho đếm ngược) |
| `DEPARTMENTS` | Danh sách phòng ban; mỗi phòng ban tự có một màu lá |
| `SPOTLIGHT_SECONDS` | Bao lâu tự bật một lời chúc (mặc định 6 giây) |
| `SLIDE_SECONDS` | Thời gian mỗi lời chúc ở chế độ trình chiếu |

Lưu file, mở lại bằng trình duyệt: nhãn "Demo" biến mất, trang hỏi PIN thật.

## Bước 3 — Đưa lên mạng

Chọn một trong hai cách:

- **GitHub Pages (miễn phí)**: đưa `index.html` vào repo mới → Settings → Pages → Branch `main` → Save. Link dạng `https://<tên-github>.github.io/<tên-repo>/`.
- **Hosting riêng (ví dụ Hostinger)**: vào File Manager, tải `index.html` vào thư mục `public_html`. Phù hợp khi muốn dùng tên miền riêng của công ty.

Backend vẫn ở Google nên không cần host hỗ trợ PHP hay cơ sở dữ liệu.

## Bước 4 — Vận hành

- **Duyệt lời chúc**: mở Sheet, đọc cột Nội dung, tick cột **Đã duyệt**. Lá xuất hiện trên cây trong khoảng 1 phút.
- **Ẩn một lời chúc đã duyệt**: bỏ tick.
- **Gửi cho CBNV**: link web + mã PIN qua kênh nội bộ (email, nhóm Zalo/Teams).
- **Ngày sinh nhật**: mở trang trên máy chiếu → bấm **Trình chiếu** (toàn màn hình, phím → để chuyển nhanh, Esc để thoát).

## Khi sửa `Code.gs`

Mỗi lần sửa code backend: **Triển khai → Quản lý tùy chọn triển khai → biểu tượng bút chì → Phiên bản: Phiên bản mới → Triển khai**. Làm như vậy URL giữ nguyên, không phải sửa lại `index.html`.

## Cây lớn theo số lời chúc

| Số lời chúc | Giai đoạn |
| --- | --- |
| 0–4 | Hạt mầm |
| 5–14 | Mầm non |
| 15–39 | Cây non |
| 40–79 | Cây nhỏ |
| 80–149 | Cây đang lớn |
| 150–249 | Cây trưởng thành |
| 250+ | Cây cổ thụ nở hoa |

Hoa = lời chúc gửi cả công ty; lá màu = gửi phòng ban hoặc đồng nghiệp (màu theo phòng ban).
