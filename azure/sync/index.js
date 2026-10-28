/* Chạy 2 phút/lần: đồng bộ lời chúc, phòng ban, máy chủ đang dùng giữa Azure và Google */
const { getCore } = require('../cay/index');
module.exports = async function (context) {
  getCore().flushStats().catch(() => {});
  const r = await getCore().sync();
  if (!r.ok) context.log.warn('Đồng bộ lỗi: ' + r.error);
  else context.log('Đồng bộ xong', JSON.stringify({ pulled: r.pulled, pushed: r.pushed, ms: r.ms }));
};
