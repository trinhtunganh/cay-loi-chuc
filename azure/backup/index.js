/* Chạy mỗi giờ (phút thứ 7): tự sao lưu toàn bộ dữ liệu vào bảng SaoLuu nếu đã đến kỳ và dữ liệu có thay đổi */
const { getCore } = require('../cay/index');
module.exports = async function (context) {
  const r = await getCore().autoBackup();
  context.log('Sao lưu', JSON.stringify(r));
};
