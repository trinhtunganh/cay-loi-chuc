/**
 * CÂY TRI ÂN — Backend Google Apps Script
 * Lưu lời chúc giấu tên vào Google Sheet và chỉ trả về lời chúc đã được duyệt.
 *
 * - Không lưu email, tên hay bất kỳ thông tin nào của người gửi.
 * - Cài đặt nằm ở Project Settings > Script properties:
 *     PIN           mã PIN để vào trang (mặc định VinRobotics2026)
 *     AUTO_APPROVE  "true" = lời chúc lên cây ngay, "false" = chờ duyệt (mặc định)
 * - Sheet tự được tạo ở lần chạy đầu tiên, không cần chuẩn bị gì.
 */

const SHEET_NAME = 'LoiChuc';
const HEADERS = ['ID', 'Thời gian', 'Loại người nhận', 'Phòng ban', 'Tên người nhận', 'Nội dung', 'Đã duyệt'];
const TYPE_LABELS = { company: 'Cả công ty', dept: 'Phòng ban', person: 'Đồng nghiệp' };
const DEFAULTS = { PIN: 'VinRobotics2026', AUTO_APPROVE: 'false' };
const MAX_TEXT = 500;
const MAX_NAME = 60;
const MAX_FAILS = 40;          // số lần nhập sai PIN tối đa trong 10 phút (toàn hệ thống)
const LIST_CACHE_SECONDS = 20; // giảm tải khi nhiều người cùng xem

/** Bấm Chạy hàm này 1 lần để cấp quyền và tạo sheet. */
function setup() {
  const sh = getSheet();
  const props = PropertiesService.getScriptProperties();
  Object.keys(DEFAULTS).forEach(k => { if (!props.getProperty(k)) props.setProperty(k, DEFAULTS[k]); });
  Logger.log('Xong. Sheet "%s" đã sẵn sàng. PIN: %s. Tự duyệt: %s', sh.getName(), props.getProperty('PIN'), props.getProperty('AUTO_APPROVE'));
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

  if (String(body.pin || '').trim() !== prop('PIN')) {
    cache.put('pin_fails', String(fails + 1), 600);
    return json({ ok: false, error: 'Mã PIN không đúng.', code: 'BAD_PIN' });
  }

  try {
    switch (body.action) {
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
    .map(r => ({
      id: String(r[0]),
      time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
      toType: labelToType[r[2]] || 'company',
      toDept: String(r[3] || ''),
      toName: String(r[4] || ''),
      text: String(r[5] || '')
    }));

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
      approved
    ]);
    sh.getRange(sh.getLastRow(), 7).insertCheckboxes();
    if (approved) CacheService.getScriptCache().remove('approved_list');
    return { ok: true, id: id, approved: approved };
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
