# Cây Tri Ân VinRobotics: bàn giao để làm tiếp

Cập nhật: 24/10/2026. Dán file này (hoặc link repo) vào đầu cuộc trò chuyện mới để Claude nắm ngay bối cảnh.

## Dự án là gì
- Web "Cây Tri Ân" mừng sinh nhật VinRobotics (21/11/2026). Khoảng 250 nhân viên gửi lời cảm ơn tới cả công ty; mỗi lời chúc mọc thành một bông hoa hoặc chiếc lá (màu ngẫu nhiên) trên cây.
- Repo: `trinhtunganh/cay-loi-chuc` (GitHub Pages: https://trinhtunganh.github.io/cay-loi-chuc/).
- File chính: `index.html` (toàn bộ giao diện), `config.js` (chữ và cài đặt mặc định), `Code.gs` (máy chủ Google Apps Script), `azure/` (máy chủ Azure Functions, không dùng thư viện ngoài).
- Hướng dẫn cho Ban tổ chức: `HUONG-DAN.md`.

## Kiến trúc
- Chỉ dùng **Azure**: `https://caytrian-vinrobotics.azurewebsites.net/api/cay`. Google Apps Script đã **tắt** từ 28/10/2026 (`apiUrl` trong `config.js` để trống; code `Code.gs` và phần đồng bộ vẫn giữ, bật lại bằng cách điền `apiUrl` và cài `GOOGLE_URL`/`SYNC_KEY` trên Azure).
- Azure nạp code từ `azure/dist/cay-azure.zip` trên nhánh `main`. Sau mỗi lần sửa code Azure phải: build lại zip, push, rồi **Restart** Function App trên portal.azure.com.
- Trình duyệt tự chuyển sang máy chủ kia nếu máy đang dùng lỗi 3 lần liên tiếp.

## Chức năng quản trị (đã xong)
- Tab **Lời chúc**:
  - Duyệt, chọn tiêu biểu, Ẩn đi / Khôi phục / Xóa hẳn.
  - Lọc theo trạng thái; nút xuất Excel ở góc cửa sổ.
  - Công tắc **Chế độ ẩn danh**. Tắt ẩn danh thì account hiện kèm lời chúc.
- Tab **Máy chủ**: tình trạng Azure + **báo cáo hiệu năng** (người đang mở trang, lượt gọi/giờ, thời gian xử lý TB và 95%, lỗi, dữ liệu gửi đi; 24 giờ / 3 ngày / 7 ngày). Số liệu do Azure tự ghi vào bảng `ThongKe` mỗi phút.
- Tab **Mã PIN**: đổi PIN nhân viên và PIN quản trị riêng.
- Tab **Nội dung**: sửa mọi chữ hiển thị và ngày giờ sinh nhật (đồng hồ đếm ngược), lưu trên máy chủ.
- Tab **Sao lưu**:
  - Tải bản sao lưu .json; khôi phục kiểu Gộp hoặc Đưa về đúng bản sao lưu.
  - Azure tự sao lưu: 3 giờ/lần, 1 giờ/lần quanh sinh nhật, chỉ khi dữ liệu đổi. Giữ 24 bản + 1 bản/ngày trong 45 ngày.
- **Cảm xúc** kiểu Facebook trên từng lời chúc, sắp xếp danh sách theo số cảm xúc.
- **Giám sát**: workflow `.github/workflows/monitor.yml` 10 phút/lần (mở Issue khi lỗi) + tác vụ định kỳ của Claude mỗi giờ báo về điện thoại.
- Nút **Quay thưởng** (hộp quà):
  - Chọn khoảng thời gian; bảng kê lời chúc kèm lý do không được quay.
  - Account rải ngẫu nhiên, quay đúng 5 giây; người đã trúng bị loại khỏi lượt sau.

## Việc còn treo (cần máy tính có app Claude desktop)
1. **Restart Azure** để nạp bản mới nhất. Bản mới gồm: tab Nội dung, sao lưu tự động, ngày sinh nhật sửa trong Quản trị, cảm xúc, giám sát chi tiết (?health), báo cáo hiệu năng.
2. "Ẩn đi" dòng lời chúc `[THỬ NGHIỆM]` trên Azure. Muốn xóa hẳn thì Ban tổ chức tự bấm.
3. (Không cần nữa, Google đã tắt) Cài `Code.gs` mới, `SYNC_KEY`, `GOOGLE_URL`.

## Kiểm thử
Có bộ máy chủ giả lập (mock Google + mock Azure) và script Playwright. Bộ này nằm trong scratchpad của phiên cũ nên sẽ mất khi phiên đóng; khi cần, nhờ Claude dựng lại. Không ghi dữ liệu thử lên máy chủ thật.
