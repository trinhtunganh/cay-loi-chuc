/**
 * CÂY TRI ÂN — Backend Google Apps Script
 * Lưu lời chúc giấu tên vào Google Sheet và chỉ trả về lời chúc đã được duyệt.
 *
 * - Không lưu email, tên hay bất kỳ thông tin nào của người gửi.
 * - Cài đặt nằm ở Project Settings > Script properties:
 *     PIN           mã PIN để vào trang (mặc định VinRobotics2026)
 *     AUTO_APPROVE  "true" = lời chúc lên cây ngay (mặc định), "false" = chờ duyệt
 *     ADMIN_PIN     mã PIN riêng của Ban tổ chức để duyệt và chọn lời chúc tiêu biểu
 *     DEPARTMENTS   danh sách phòng ban (JSON), tự lưu khi Ban tổ chức sửa trong trang Quản trị
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
const PROPS_CACHE_SECONDS = 120; // đọc cài đặt từ cache: Google giới hạn 50.000 lượt đọc thuộc tính/ngày
const MIN_ROWS = 3000;           // số dòng có sẵn ô tick, đủ cho cả công ty

/** Bấm Chạy hàm này 1 lần để cấp quyền và tạo sheet. */
function setup() {
  const sh = getSheet();
  const props = PropertiesService.getScriptProperties();
  Object.keys(DEFAULTS).forEach(k => { if (!props.getProperty(k)) props.setProperty(k, DEFAULTS[k]); });
  CacheService.getScriptCache().removeAll(['props', 'sheet_ok']);
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
      case 'adminList':   return json({ ok: true, items: listAll(), depts: getDepts() });
      case 'adminSet':    return json(adminSet(body));
      case 'adminSetDepts': return json(setDepts(body));
      case 'verify': return json({ ok: true });
      case 'list':   return json({ ok: true, items: listApproved(), depts: getDepts() });
      case 'submit': return json(submit(body));
      default:       return json({ ok: false, error: 'Thao tác không hợp lệ.' });
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'Máy chủ đang bận, bạn thử lại sau ít phút nhé.' });
  }
}

function listApproved() {
  const fresh = getBig('approved_list');
  if (fresh) return JSON.parse(fresh);
  /* Hết hạn cache lúc đông người: chỉ 1 lượt đọc lại Sheet, các lượt khác dùng bản vừa hết hạn
     (cũ hơn vài giây) thay vì cùng lúc đọc Sheet và làm Google báo quá tải. */
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    const stale = getBig('approved_stale');
    if (stale) return JSON.parse(stale);
    lock.waitLock(10000);
    const again = getBig('approved_list');
    if (again) { lock.releaseLock(); return JSON.parse(again); }
  }
  try {
    const items = readApproved();
    const str = JSON.stringify(items);
    putBig('approved_list', str, LIST_CACHE_SECONDS);
    putBig('approved_stale', str, 21600);
    return items;
  } finally {
    lock.releaseLock();
  }
}

function readApproved() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const labelToType = {};
  Object.keys(TYPE_LABELS).forEach(k => labelToType[TYPE_LABELS[k]] = k);
  return rows.filter(r => r[0] && r[6] === true).map(r => rowToItem(r, labelToType));
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
  /* appendRow của Google Sheet tự đảm bảo không ghi đè khi nhiều người gửi cùng lúc,
     nên không cần khóa: hàng trăm người gửi một lúc cũng không phải xếp hàng chờ. */
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
  if (approved) removeBig('approved_list');
  return { ok: true, id: id, approved: approved };
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
    const set = (col, v) => sh.getRange(row, col).setValue(v === true);
    if (typeof body.featured === 'boolean') { set(COL.featured, body.featured); if (body.featured) set(COL.approved, true); }
    if (typeof body.approved === 'boolean') { set(COL.approved, body.approved); if (!body.approved) set(COL.featured, false); }
    removeBig('approved_list');
    const v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    return { ok: true, approved: v[6] === true, featured: v[7] === true };
  } finally {
    lock.releaseLock();
  }
}

/** Phòng ban do Ban tổ chức cấu hình; null = dùng danh sách trong config.js. */
function getDepts() {
  const v = allProps().DEPARTMENTS;
  if (!v) return null;
  try { const a = JSON.parse(v); return Array.isArray(a) && a.length ? a : null; } catch (e) { return null; }
}

/** Quản trị: lưu danh sách, thứ tự, màu phòng ban; đổi tên thì cập nhật lời chúc cũ. */
function setDepts(body) {
  const list = Array.isArray(body.depts) ? body.depts : [];
  const seen = {};
  const depts = [];
  for (let i = 0; i < list.length && depts.length < 40; i++) {
    const name = clean(list[i] && list[i].name, MAX_NAME);
    const color = String((list[i] && list[i].color) || '');
    const key = name.toLowerCase();
    if (!name || seen[key]) continue;
    seen[key] = true;
    depts.push(/^#[0-9a-fA-F]{6}$/.test(color) ? { name: name, color: color } : { name: name });
  }
  if (!depts.length) return { ok: false, error: 'Cần ít nhất một phòng ban.' };

  const renames = body.renames && typeof body.renames === 'object' ? body.renames : {};
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    PropertiesService.getScriptProperties().setProperty('DEPARTMENTS', JSON.stringify(depts));
    CacheService.getScriptCache().remove('props');
    const keys = Object.keys(renames);
    if (keys.length) {
      const sh = getSheet();
      const last = sh.getLastRow();
      if (last >= 2) {
        const rng = sh.getRange(2, 4, last - 1, 1);
        const vals = rng.getValues();
        let changed = false;
        vals.forEach(r => {
          const to = renames[r[0]];
          if (to) { r[0] = safeCell(clean(to, MAX_NAME)); changed = true; }
        });
        if (changed) rng.setValues(vals);
      }
    }
    removeBig('approved_list');
    return { ok: true, depts: depts };
  } finally {
    lock.releaseLock();
  }
}

/** Tự chạy khi bạn sửa Sheet (ví dụ tick "Đã duyệt"): xóa cache để lá lên cây nhanh hơn. */
function onEdit() {
  removeBig('approved_list');
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
  const cache = CacheService.getScriptCache();
  if (!cache.get('sheet_ok')) {
    if (!sh.getRange(1, COL.featured).getValue()) {   // sheet cũ chưa có cột "Tiêu biểu"
      sh.getRange(1, COL.featured).setValue(HEADERS[COL.featured - 1]).setFontWeight('bold').setBackground('#FDE8EC');
    }
    /* Ô tick sẵn cho 2 cột "Đã duyệt", "Tiêu biểu" để lúc gửi lời chúc chỉ cần 1 lệnh ghi */
    if (sh.getMaxRows() < MIN_ROWS) sh.insertRowsAfter(sh.getMaxRows(), MIN_ROWS - sh.getMaxRows());
    const cb = sh.getRange(2, COL.approved, sh.getMaxRows() - 1, 2);
    if (!sh.getRange(sh.getMaxRows(), COL.approved).getDataValidation()) {
      cb.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    }
    cache.put('sheet_ok', '1', 21600);
  }
  return sh;
}

/** Toàn bộ cài đặt, đọc 1 lần rồi giữ trong cache 2 phút (đổi PIN có hiệu lực sau tối đa 2 phút). */
function allProps() {
  if (allProps.v) return allProps.v;
  const cache = CacheService.getScriptCache();
  const c = cache.get('props');
  if (c) { allProps.v = JSON.parse(c); return allProps.v; }
  allProps.v = PropertiesService.getScriptProperties().getProperties();
  cache.put('props', JSON.stringify(allProps.v), PROPS_CACHE_SECONDS);
  return allProps.v;
}

/** Cache cho dữ liệu lớn hơn 100 KB: chia thành nhiều mảnh. */
function putBig(key, str, ttl) {
  const cache = CacheService.getScriptCache(), size = 90000, parts = {};
  const n = Math.ceil(str.length / size) || 1;
  if (n > 40) return;
  for (let i = 0; i < n; i++) parts[key + '_' + i] = str.slice(i * size, (i + 1) * size);
  parts[key] = String(n);
  cache.putAll(parts, ttl);
}
function getBig(key) {
  const cache = CacheService.getScriptCache(), n = Number(cache.get(key) || 0);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = cache.getAll(keys);
  if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join('');
}
function removeBig(key) { CacheService.getScriptCache().remove(key); }

function prop(key) {
  const v = allProps()[key];
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
