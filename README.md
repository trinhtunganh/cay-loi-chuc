# Cây lời chúc

Web gửi lời chúc giấu tên mừng sinh nhật công ty. Mỗi lời chúc là một chiếc lá hoặc bông hoa, cây lớn dần khi có thêm lời chúc.

**Bản demo:** https://trinhtunganh.github.io/cay-loi-chuc/ (nhập mã PIN bất kỳ để xem thử).

## Tính năng

- Cây lớn qua 7 giai đoạn theo số lời chúc
- Hoa = gửi cả công ty, lá màu = gửi phòng ban hoặc đồng nghiệp
- Lá tự bật lời chúc, cột "Lời chúc mới nhất" trên màn rộng
- Tìm lời chúc theo tên hoặc phòng ban
- Chế độ trình chiếu toàn màn hình
- Giấu tên hoàn toàn, có bước duyệt, vào trang bằng mã PIN

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `index.html` | Giao diện (chạy demo khi chưa điền `API_URL`) |
| `Code.gs` | Backend Google Apps Script + Google Sheet |
| `HUONG-DAN.md` | Hướng dẫn cài đặt bản thật |
