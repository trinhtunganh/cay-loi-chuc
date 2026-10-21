# Cây Tri Ân · Mừng sinh nhật VinRobotics

Web gửi lời cảm ơn, lời chúc giấu tên tới VinRobotics và đồng nghiệp. Mỗi lời chúc là một chiếc lá (gửi phòng ban, đồng nghiệp) hoặc một bông hoa đỏ (gửi cả công ty); cây lớn dần qua 7 giai đoạn khi có thêm lời chúc.

**Link:** https://trinhtunganh.github.io/cay-loi-chuc/

## Trạng thái

Khi `API_URL` trong `index.html` còn trống, web chạy **bản xem trước**: hiện lời chúc mẫu, có dải thông báo ở đầu trang, lời chúc gửi thử không được lưu. Khi điền `API_URL` (backend Google Apps Script, xem `HUONG-DAN.md`), web chạy thật: lưu lời chúc vào Google Sheet, cần mã PIN, Ban tổ chức duyệt trước khi lên cây.

## Tính năng

- Giao diện theo nhận diện VinRobotics: đỏ `#E4002B`, font Roboto, logo
- Cây vẽ bằng SVG: thân thuôn có vân gỗ, lá chuyển màu theo phòng ban, hoa đỏ cho lời chúc gửi công ty, cánh hoa rơi, cây đung đưa nhẹ
- Thanh tiến độ "còn bao nhiêu lời chúc để cây lớn tiếp"
- Lá tự bật lời chúc; cột "Lời chúc mới nhất" trên màn rộng (từ 1500px)
- Tìm lời chúc theo tên hoặc phòng ban, lọc theo màu
- Form gửi có gợi ý câu mở đầu, nút mời đồng nghiệp cùng gửi
- Đếm ngược ngày, giờ, phút, giây đến 00:00 ngày 21/11/2026
- Chế độ trình chiếu toàn màn hình cho buổi tiệc (phím ← → để chuyển)
- Ảnh xem trước khi chia sẻ link qua Zalo, Facebook, Teams

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `index.html` | Toàn bộ giao diện; cấu hình ở khối `CONFIG` |
| `Code.gs` | Backend Google Apps Script + Google Sheet |
| `HUONG-DAN.md` | Hướng dẫn cài backend và vận hành |
| `assets/` | Logo, favicon, ảnh chia sẻ |
