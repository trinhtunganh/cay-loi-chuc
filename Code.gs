/**
 * CÂY TRI ÂN — Backend Google Apps Script
 * Lưu lời chúc giấu tên vào Google Sheet và chỉ trả về lời chúc đã được duyệt.
 *
 * - Không lưu email, tên hay bất kỳ thông tin nào của người gửi.
 * - Cài đặt nằm ở Project Settings > Script properties:
 *     PIN           mã PIN để vào trang (mặc định VinRobotics2026)
 *     AUTO_APPROVE  "true" = lời chúc lên cây ngay (mặc định), "false" = chờ duyệt
 *     ADMIN_PIN     mã PIN riêng của Ban tổ chức để duyệt và chọn lời chúc tiêu biểu
 * - Sheet tự được tạo ở lần chạy đầu tiên, không cần chuẩn bị gì.
 */

const SHEET_NAME = 'LoiChuc';
const HEADERS = ['ID', 'Thời gian', 'Loại người nhận', 'Phòng ban', 'Tên người nhận', 'Nội dung', 'Đã duyệt', 'Tiêu biểu'];
const COL = { approved: 7, featured: 8 };
const TYPE_LABELS = { company: 'Cả công ty', dept: 'Phòng ban', person: 'Đồng nghiệp' };
const DEFAULTS = { PIN: 'VinRobotics2026', ADMIN_PIN: 'VRAdmin2026', AUTO_APPROVE: 'true' };
const MAX_TEXT = 500;
const MAX_NAME = 60;
const MAX_FAILS = 40;          // số lần nhập sai PIN tối đa trong 10 phút (toàn hệ thống)
const LIST_CACHE_SECONDS = 20; // giảm tải khi nhiều người cùng xem

/** Bấm Chạy hàm này 1 lần để cấp quyền và tạo sheet. */
function setup() {
  const sh = getSheet();
  const props = PropertiesService.getScriptProperties();
  Object.keys(DEFAULTS).forEach(k => { if (!props.getProperty(k)) props.setProperty(k, DEFAULTS[k]); });
  Logger.log('Xong. Sheet "%s" đã sẵn sàng. PIN: %s. PIN quản trị: %s. Tự duyệt: %s', sh.getName(), props.getProperty('PIN'), props.getProperty('ADMIN_PIN'), props.getProperty('AUTO_APPROVE'));
}

function doGet() {
  return json({ ok: true, message: 'Cây Tri Ân API đang chạy.' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pin_fails') || 0);
  if (fails >= MAX_FAILS) {
    return json({ ok: false, error: 'Nhập sai PIN quá nhiều lần. Vui lòng thử lại sau 10 phút.' });
  }

  const isAdmin = String(body.action || '').indexOf('admin') === 0;
  const given = String((isAdmin ? body.adminPin : body.pin) || '').trim();
  const okPin = isAdmin ? given === prop('ADMIN_PIN') : (given === prop('PIN') || given === prop('ADMIN_PIN'));
  if (!okPin) {
    cache.put('pin_fails', String(fails + 1), 600);
    return json({ ok: false, error: 'Mã PIN không đúng.', code: isAdmin ? 'BAD_ADMIN_PIN' : 'BAD_PIN' });
  }

  try {
    switch (body.action) {
      case 'adminVerify': return json({ ok: true });
      case 'adminList':   return json({ ok: true, items: listAll() });
      case 'adminSet':    return json(adminSet(body));
      case 'verify': return json({ ok: true });
      case 'list':   return json({ ok: true, items: listApproved() });
      case 'submit': return json(submit(body));
      default:       return json({ ok: false, error: 'Thao tác không hợp lệ.' });
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'Máy chủ đang bận, bạn thử lại sau ít phút nhé.' });
  }
}

function listApproved() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('approved_list');
  if (cached) return JSON.parse(cached);

  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const labelToType = {};
  Object.keys(TYPE_LABELS).forEach(k => labelToType[TYPE_LABELS[k]] = k);

  const items = rows
    .filter(r => r[0] && r[6] === true)
    .map(r => rowToItem(r, labelToType));

  const str = JSON.stringify(items);
  if (str.length < 90000) cache.put('approved_list', str, LIST_CACHE_SECONDS);
  return items;
}

function submit(body) {
  const toType = TYPE_LABELS[body.toType] ? body.toType : null;
  if (!toType) return { ok: false, error: 'Vui lòng chọn người nhận.' };

  const toDept = clean(body.toDept, MAX_NAME);
  const toName = clean(body.toName, MAX_NAME);
  const text = clean(body.text, MAX_TEXT);

  if (toType === 'dept' && !toDept) return { ok: false, error: 'Vui lòng chọn phòng ban.' };
  if (toType === 'person' && !toName) return { ok: false, error: 'Vui lòng nhập tên người nhận.' };
  if (text.length < 5) return { ok: false, error: 'Lời chúc cần ít nhất 5 ký tự.' };

  const approved = prop('AUTO_APPROVE').toLowerCase() === 'true';
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet();
    const id = Utilities.getUuid().slice(0, 8);
    sh.appendRow([
      id,
      new Date(),
      TYPE_LABELS[toType],
      toType === 'company' ? '' : safeCell(toDept),
      toType === 'person' ? safeCell(toName) : '',
      safeCell(text),
      approved,
      false
    ]);
    sh.getRange(sh.getLastRow(), COL.approved, 1, 2).insertCheckboxes();
    if (approved) CacheService.getScriptCache().remove('approved_list');
    return { ok: true, id: id, approved: approved };
  } finally {
    lock.releaseLock();
  }
}

function rowToItem(r, labelToType) {
  return {
    id: String(r[0]),
    time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
    toType: labelToType[r[2]] || 'company',
    toDept: String(r[3] || ''),
    toName: String(r[4] || ''),
    text: String(r[5] || ''),
    approved: r[6] === true,
    featured: r[7] === true
  };
}

/** Quản trị: toàn bộ lời chúc, kể cả chưa duyệt. */
function listAll() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const labelToType = {};
  Object.keys(TYPE_LABELS).forEach(k => labelToType[TYPE_LABELS[k]] = k);
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues().filter(r => r[0]).map(r => rowToItem(r, labelToType));
}

/** Quản trị: duyệt / bỏ duyệt, chọn / bỏ chọn tiêu biểu. Chọn tiêu biểu thì tự duyệt luôn. */
function adminSet(body) {
  const id = String(body.id || '');
  if (!id) return { ok: false, error: 'Thiếu mã lời chúc.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet();
    const last = sh.getLastRow();
    if (last < 2) return { ok: false, error: 'Không tìm thấy lời chúc.' };
    const ids = sh.getRange(2, 1, last - 1, 1).getValues();
    let row = -1;
    for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { row = i + 2; break; }
    if (row < 0) return { ok: false, error: 'Không tìm thấy lời chúc.' };
    const set = (col, v) => { const c = sh.getRange(row, col); c.insertCheckboxes(); c.setValue(v === true); };
    if (typeof body.featured === 'boolean') { set(COL.featured, body.featured); if (body.featured) set(COL.approved, true); }
    if (typeof body.approved === 'boolean') { set(COL.approved, body.approved); if (!body.approved) set(COL.featured, false); }
    CacheService.getScriptCache().remove('approved_list');
    const v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    return { ok: true, approved: v[6] === true, featured: v[7] === true };
  } finally {
    lock.releaseLock();
  }
}

/** Tự chạy khi bạn sửa Sheet (ví dụ tick "Đã duyệt"): xóa cache để lá lên cây nhanh hơn. */
function onEdit() {
  CacheService.getScriptCache().remove('approved_list');
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME, 0);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#FDE8EC');
    sh.setFrozenRows(1);
    sh.setColumnWidth(6, 480);
    sh.setColumnWidth(2, 150);
  }
  if (!sh.getRange(1, COL.featured).getValue()) {   // sheet cũ chưa có cột "Tiêu biểu"
    sh.getRange(1, COL.featured).setValue(HEADERS[COL.featured - 1]).setFontWeight('bold').setBackground('#FDE8EC');
  }
  return sh;
}

function prop(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === '' ? DEFAULTS[key] : v;
}

function clean(v, max) {
  return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

/** Chặn chèn công thức vào Sheet (nội dung bắt đầu bằng = + - @). */
function safeCell(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
