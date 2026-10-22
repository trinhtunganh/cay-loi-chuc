# Cây Tri Ân · Mừng sinh nhật VinRobotics

Web gửi lời cảm ơn, lời chúc giấu tên tới VinRobotics và đồng nghiệp. Mỗi lời chúc là một chiếc lá (gửi phòng ban, đồng nghiệp) hoặc một bông hoa đỏ (gửi cả công ty); cây lớn dần qua 7 giai đoạn khi có thêm lời chúc.

**Link:** https://trinhtunganh.github.io/cay-loi-chuc/

## Trạng thái

Khi `backend.apiUrl` trong `config.js` còn trống, web chạy **bản xem trước**: hiện lời chúc mẫu, có dải thông báo ở đầu trang, lời chúc gửi thử không được lưu. Khi điền `apiUrl` (backend Google Apps Script, xem `HUONG-DAN.md`), web chạy thật: lưu lời chúc vào Google Sheet, cần mã PIN, Ban tổ chức duyệt trước khi lên cây.

## Tính năng

- Giao diện theo nhận diện VinRobotics: đỏ `#E4002B`, font Roboto, logo
- Cây vẽ bằng SVG, chạc cây mang hình logo VinRobotics (vòng tròn + hai cánh chữ V); lá theo màu phòng ban, hoa đỏ cho lời chúc gửi công ty
- Cảnh vật sống động: mặt trời, chim, bướm, cánh hoa rơi; 3 robot dạng người đi lại quanh cây (tưới cây, tỉa cành, cầm bóng tim)
- Thẻ trạng thái: tổng số lời chúc và tiến độ "còn bao nhiêu lời chúc để cây lớn tiếp"
- Gợi ý "chạm vào lá" cho người mới, màn hình chờ khi cây chưa có lời chúc, nút gửi cố định trên điện thoại
- Lá tự bật lời chúc; cột "Lời chúc mới nhất" cuộn vô hạn để xem toàn bộ
- Ô tìm kiếm ở đầu danh sách lời chúc: lọc theo tên người nhận hoặc nội dung, kèm bộ lọc phòng ban
- Dãy phòng ban có biểu tượng lá, hoa giống trên cây và số lời chúc của từng phòng
- Form gửi có gợi ý câu mở đầu, nút mời đồng nghiệp cùng gửi
- Đếm ngược ngày, giờ, phút, giây đến 00:00 ngày 21/11/2026
- Chế độ trình chiếu toàn màn hình có cây, lá của lời chúc đang chiếu phát sáng (phím ← → để chuyển)
- Ảnh xem trước khi chia sẻ link qua Zalo, Facebook, Teams

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `config.js` | Tên công ty, ngày, phòng ban, link máy chủ, toàn bộ chữ hiển thị |
| `index.html` | Giao diện, cây, hiệu ứng |
| `Code.gs` | Backend Google Apps Script + Google Sheet |
| `HUONG-DAN.md` | Hướng dẫn cài backend và vận hành |
| `assets/` | Logo, favicon, ảnh chia sẻ |
