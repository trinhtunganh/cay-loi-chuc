/**
 * CÂY LỜI CHÚC — Backend Google Apps Script
 * Lưu lời chúc giấu tên vào Google Sheet, chỉ trả về lời chúc đã được duyệt.
 *
 * Không lưu email, tên hay bất kỳ thông tin nào của người gửi.
 * Mã PIN lưu trong Script Properties (khóa "PIN"), không nằm trong code giao diện.
 */

const SHEET_NAME = 'LoiChuc';
const HEADERS = ['ID', 'Thời gian', 'Loại người nhận', 'Phòng ban', 'Tên người nhận', 'Nội dung', 'Đã duyệt'];
const TYPE_LABELS = { company: 'Cả công ty', dept: 'Phòng ban', person: 'Đồng nghiệp' };
const MAX_TEXT = 500;
const MAX_NAME = 60;
const MAX_FAILS = 40;          // số lần nhập sai PIN tối đa trong 10 phút (toàn hệ thống)
const LIST_CACHE_SECONDS = 20; // giảm tải khi nhiều người cùng xem

/** Chạy 1 lần sau khi dán code: tạo sheet, tiêu đề, ô tick duyệt, PIN mặc định. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#e8f5e9');
  sh.setFrozenRows(1);
  sh.setColumnWidth(6, 480);
  sh.getRange(2, 7, sh.getMaxRows() - 1, 1).insertCheckboxes();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PIN')) props.setProperty('PIN', 'SNMO2026');
  Logger.log('Xong. PIN hiện tại: ' + props.getProperty('PIN') + ' — đổi trong Project Settings > Script properties.');
}

function doGet() {
  return json({ ok: true, message: 'Cây lời chúc API đang chạy.' });
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

  const pin = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!pin || String(body.pin || '').trim() !== pin) {
    cache.put('pin_fails', String(fails + 1), 600);
    return json({ ok: false, error: 'Mã PIN không đúng.', code: 'BAD_PIN' });
  }

  switch (body.action) {
    case 'verify': return json({ ok: true });
    case 'list':   return json({ ok: true, items: listApproved() });
    case 'submit': return json(submit(body));
    default:       return json({ ok: false, error: 'Thao tác không hợp lệ.' });
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

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = Utilities.getUuid().slice(0, 8);
    getSheet().appendRow([
      id,
      new Date(),
      TYPE_LABELS[toType],
      toType === 'company' ? '' : safeCell(toDept),
      toType === 'person' ? safeCell(toName) : '',
      safeCell(text),
      false
    ]);
    const row = getSheet().getLastRow();
    getSheet().getRange(row, 7).insertCheckboxes();
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Khi bạn tick "Đã duyệt", xóa cache để lời chúc hiện lên cây nhanh hơn. Gắn trigger "On edit" nếu muốn. */
function onEdit() {
  CacheService.getScriptCache().remove('approved_list');
}

function getSheet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Chưa chạy hàm setup().');
  return sh;
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
