/**
 * CÂY TRI ÂN — Backend Google Apps Script
 * Lưu lời chúc giấu tên vào Google Sheet và chỉ trả về lời chúc đã được duyệt.
 *
 * - Chỉ lưu Account VGR của người gửi (để trao thưởng, chỉ Ban tổ chức xem được), không công khai.
 * - Cài đặt nằm ở Project Settings > Script properties:
 *     PIN           mã PIN để vào trang (mặc định VinRobotics2026)
 *     AUTO_APPROVE  "true" = lời chúc lên cây ngay (mặc định), "false" = chờ duyệt
 *     ADMIN_PIN     mã PIN riêng của Ban tổ chức để duyệt và chọn lời chúc tiêu biểu
 *     DEPARTMENTS   danh sách phòng ban (JSON), tự lưu khi Ban tổ chức sửa trong trang Quản trị
 *     ACTIVE        máy chủ cả công ty đang dùng (google/azure), đổi trong Quản trị → Máy chủ
 *     TEXTS_*       chữ hiển thị sửa trong Quản trị → Nội dung (tự tạo)
 *     ANON          true = chế độ ẩn danh (không hỏi Account VGR), đổi trong Quản trị → Lời chúc
 *     SYNC_KEY      khóa bí mật dùng chung với máy chủ Azure để 2 máy chủ đồng bộ dữ liệu
 * - Sheet tự được tạo ở lần chạy đầu tiên, không cần chuẩn bị gì.
 */

const SHEET_NAME = 'LoiChuc';
const HEADERS = ['ID', 'Thời gian', 'Loại người nhận', 'Phòng ban', 'Tên người nhận', 'Nội dung', 'Đã duyệt', 'Tiêu biểu', 'Cập nhật', 'Đã xóa', 'Account VGR', 'Giải thưởng', 'Thời điểm trúng'];
const COL = { approved: 7, featured: 8, updated: 9, deleted: 10, account: 11, prize: 12, wonAt: 13 };
const ACCOUNT_RE = /^[A-Za-z0-9._@\-]{2,60}$/;
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
  CacheService.getScriptCache().removeAll(['props', 'sheet_ok', 'sheet_ok2', 'sheet_ok3']);
  Logger.log('Xong. Sheet "%s" đã sẵn sàng. PIN: %s. PIN quản trị: %s. Tự duyệt: %s', sh.getName(), props.getProperty('PIN'), props.getProperty('ADMIN_PIN'), props.getProperty('AUTO_APPROVE'));
}

function doGet() {
  return json({ ok: true, message: 'Cây Tri Ân API đang chạy.' });
}

function doPost(e) {
  allProps.v = null;
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' });
  }

  /* Đồng bộ giữa 2 máy chủ: xác thực bằng SYNC_KEY, không dùng PIN */
  if (String(body.action || '').indexOf('peer') === 0) {
    const key = String(prop('SYNC_KEY') || '');
    if (key.length < 16 || String(body.key || '') !== key) return json({ ok: false, error: 'Sai khóa đồng bộ.' });
    try {
      if (body.action === 'peerDump') return json(peerDump(body));
      if (body.action === 'peerUpsert') return json(peerUpsert(body));
      return json({ ok: false, error: 'Thao tác không hợp lệ.' });
    } catch (err) { console.error(err); return json({ ok: false, error: String(err) }); }
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
      case 'adminVerify': return json({ ok: true, active: activeBackend(), anon: anonMode() });
      case 'adminSetTexts': return json(setTexts(body));
      case 'adminRestore': return json(adminRestore(body));
      case 'adminList':   return json({ ok: true, items: listAll(), depts: getDepts(), active: activeBackend(), anon: anonMode(), staffPin: prop('PIN'), texts: textsObj(), tv: textsTv() });
      case 'adminSetPins': return json(setPins(body));
      case 'adminSet':    return json(adminSet(body));
      case 'adminPurge':  return json(adminPurge(body));
      case 'adminSetDepts': return json(setDepts(body));
      case 'adminSetActive': return json(setActive(body));
      case 'adminSetAnon': return json(setAnon(body));
      case 'verify': return json(withTexts({ ok: true, active: activeBackend(), anon: anonMode() }, body));
      case 'list':   return json(listDelta(body));
      case 'submit': return json(submit(body));
      case 'react':  return json(react(body));
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

/**
 * Tiết kiệm băng thông: trình duyệt gửi lại "ver" (mã của danh sách nó đang có) và "after" (thời điểm
 * lời chúc mới nhất nó có). Không đổi gì → chỉ trả {same:true}; chỉ có lời chúc mới → chỉ trả phần mới;
 * có duyệt/bỏ duyệt/đổi tên → trả cả danh sách.
 */
function listDelta(body) {
  const items = listApproved();
  const ver = hashItems(items);
  const out = withRx(withTexts({ ok: true, ver: ver, depts: getDepts(), active: activeBackend(), anon: anonMode() }, body), body);
  const since = String(body.since || ''), after = String(body.after || '');
  if (since && since === ver) { out.same = true; return out; }
  if (since && after) {
    const old = [], added = [];
    items.forEach(m => (String(m.time) <= after ? old : added).push(m));
    if (hashItems(old) === since) { out.partial = true; out.items = added; return out; }
  }
  out.items = items;
  return out;
}
function hashItems(items) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(items), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(d).slice(0, 22);
}

function readApproved() {
  const sh = getSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const labelToType = {};
  Object.keys(TYPE_LABELS).forEach(k => labelToType[TYPE_LABELS[k]] = k);
  const anon = anonMode();   // không ẩn danh: hiện account người gửi (trường "from")
  return rows.filter(r => r[0] && r[6] === true && r[9] !== true).map(r => {
    const m = rowToItem(r, labelToType), p = publicItem(m);
    if (!anon && m.account) p.from = m.account;
    return p;
  });
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
  const anon = anonMode();   // chế độ ẩn danh: không nhận, không lưu account
  const account = anon ? '' : clean(body.account, MAX_NAME);
  if (!anon && !ACCOUNT_RE.test(account)) return { ok: false, error: 'Vui lòng nhập Account VGR hợp lệ (không dấu, không khoảng trắng).' };

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
    false,
    Date.now(),
    false,
    safeCell(account),
    '',
    ''
  ]);
  if (approved) removeBig('approved_list');
  return { ok: true, id: id, approved: approved };
}

function rowToItem(r, labelToType) {
  const time = r[1] instanceof Date ? r[1].toISOString() : String(r[1]);
  return {
    id: String(r[0]),
    time: time,
    toType: labelToType[r[2]] || 'company',
    toDept: String(r[3] || ''),
    toName: String(r[4] || ''),
    text: String(r[5] || ''),
    approved: r[6] === true,
    featured: r[7] === true,
    updated: Number(r[8]) || Date.parse(time) || 0,
    deleted: r[9] === true,
    account: String(r[10] || ''),
    prize: String(r[11] || ''),
    wonAt: Number(r[12]) || 0
  };
}
/** Bản gửi cho trình duyệt nhân viên: bỏ các trường chỉ dùng nội bộ. */
function publicItem(m) {
  return { id: m.id, time: m.time, toType: m.toType, toDept: m.toDept, toName: m.toName, text: m.text, approved: m.approved, featured: m.featured };
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

/** Quản trị: duyệt / bỏ duyệt, chọn / bỏ chọn tiêu biểu, xóa / khôi phục. Chọn tiêu biểu thì tự duyệt luôn. */
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
    if (typeof body.deleted === 'boolean') { set(COL.deleted, body.deleted); if (body.deleted) set(COL.featured, false); }
    if (typeof body.prize === 'string') {   // quay thưởng: ghi giải; chuỗi rỗng = hủy kết quả
      const pz = clean(body.prize, MAX_NAME);
      sh.getRange(row, COL.prize, 1, 2).setValues([[safeCell(pz), pz ? (Number(body.wonAt) || Date.now()) : '']]);
    }
    sh.getRange(row, COL.updated).setValue(Date.now());
    removeBig('approved_list');
    const v = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    return { ok: true, approved: v[6] === true, featured: v[7] === true, deleted: v[9] === true, prize: String(v[11] || ''), wonAt: Number(v[12]) || 0 };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Cảm xúc (giống Facebook): sheet CamXuc, mỗi dòng = 1 trình duyệt × 1 lời chúc ---------- */
const RX_SHEET = 'CamXuc', RX_TYPES = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'pacman'], CID_RE = /^[a-z0-9]{8,32}$/;
function rxSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(RX_SHEET);
  if (!sh) { sh = ss.insertSheet(RX_SHEET); sh.getRange(1, 1, 1, 4).setValues([['Mã lời chúc', 'Mã trình duyệt', 'Cảm xúc', 'Cập nhật']]); sh.setFrozenRows(1); }
  return sh;
}
function rxAll(sh) {
  sh = sh || rxSheet();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().map((r, i) => ({ id: String(r[0]), cid: String(r[1]), r: String(r[2] || ''), at: Number(r[3]) || 0, row: i + 2 })).filter(e => e.id && e.cid);
}
function rxCount(list) {
  const map = {};
  list.forEach(e => { if (e.r && RX_TYPES.indexOf(e.r) >= 0) { const m = map[e.id] || (map[e.id] = {}); m[e.r] = (m[e.r] || 0) + 1; } });
  return map;
}
function rxHash(map) { return hashItems(map).slice(0, 16); }
function rxCached() {
  const c = getBig('rx_map');
  if (c) { try { return JSON.parse(c); } catch (e) {} }
  const map = rxCount(rxAll()), v = { map: map, rv: rxHash(map) };
  putBig('rx_map', JSON.stringify(v), 30);
  return v;
}
function withRx(out, body) {
  const c = rxCached();
  out.rv = c.rv;
  if (String((body && body.rv) || '') !== c.rv) out.rx = c.map;
  return out;
}
function react(body) {
  const id = String(body.id || ''), cid = String(body.cid || ''), r = String(body.r || '');
  if (!/^[\w-]{1,40}$/.test(id) || !CID_RE.test(cid) || (r && RX_TYPES.indexOf(r) < 0)) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  if (!listApproved().some(m => m.id === id)) return { ok: false, error: 'Không tìm thấy lời chúc.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = rxSheet(), all = rxAll(sh), now = Date.now();
    const e = all.find(x => x.id === id && x.cid === cid);
    if (e) sh.getRange(e.row, 3, 1, 2).setValues([[r, now]]); else sh.appendRow([id, cid, r, now]);
    if (e) e.r = r; else all.push({ id: id, cid: cid, r: r, at: now });
    const counts = rxCount(all.filter(x => x.id === id))[id] || {};
    const map = rxCount(all), v = { map: map, rv: rxHash(map) };
    putBig('rx_map', JSON.stringify(v), 30);
    return { ok: true, id: id, r: r, counts: counts };
  } finally {
    lock.releaseLock();
  }
}
/** nhận cảm xúc từ máy chủ kia / bản sao lưu: bên nào sau thì thắng (forceNow: ghi đè bằng thời điểm hiện tại) */
function rxMerge(list, forceNow) {
  if (!Array.isArray(list) || !list.length) return 0;
  const sh = rxSheet(), local = {}, now = Date.now();
  rxAll(sh).forEach(e => local[e.id + '|' + e.cid] = e);
  let n = 0;
  list.forEach(e => {
    if (!e || !/^[\w-]{1,40}$/.test(String(e.id || '')) || !CID_RE.test(String(e.cid || '')) || (e.r && RX_TYPES.indexOf(e.r) < 0)) return;
    const l = local[e.id + '|' + e.cid], at = forceNow ? now : (Number(e.at) || now);
    if (l && !forceNow && Number(e.at) <= l.at) return;
    if (l && forceNow && l.r === (e.r || '')) return;
    if (l) sh.getRange(l.row, 3, 1, 2).setValues([[e.r || '', at]]); else { sh.appendRow([e.id, e.cid, e.r || '', at]); local[e.id + '|' + e.cid] = { r: e.r, at: at, row: sh.getLastRow() }; }
    n++;
  });
  if (n) removeBig('rx_map');
  return n;
}

/**
 * Khôi phục từ bản sao lưu (file .json tải về từ Quản trị → Sao lưu).
 * Trước khi khôi phục luôn chép sheet LoiChuc ra một tab "SaoLuu …" để có thể quay lại.
 * mode "merge": chỉ thêm lại lời chúc bị mất. mode "replace": đưa về đúng bản sao lưu,
 * lời chúc không có trong bản thì chuyển sang "Ẩn đi" (không xóa).
 */
function adminRestore(body) {
  const data = body.data || {}, items = Array.isArray(data.items) ? data.items.slice(0, 5000) : null, mode = body.mode === 'replace' ? 'replace' : 'merge';
  if (!items) return { ok: false, error: 'File sao lưu không hợp lệ.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = getSheet();
    const copyName = 'SaoLuu ' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
    sh.copyTo(ss).setName(copyName);
    const last = sh.getLastRow(), local = {};
    if (last >= 2) sh.getRange(2, 1, last - 1, COL.deleted).getValues().forEach((r, i) => { if (r[0]) local[String(r[0])] = { row: i + 2, deleted: r[COL.deleted - 1] === true }; });
    const gone = {}; getPurged(PropertiesService.getScriptProperties().getProperties()).forEach(x => gone[x] = 1);
    const now = Date.now(), inFile = {};
    let added = 0, changed = 0, hidden = 0;
    items.forEach(raw => {
      let id = String((raw && raw.id) || '');
      if (!/^[\w-]{1,40}$/.test(id)) return;
      if (gone[id]) { const base = id.slice(0, 36); let k = 1; while (gone[base + 'r' + k]) k++; id = base + 'r' + k; }   // đã xóa hẳn → mã mới, giống nhau ở 2 máy chủ
      const m = raw, type = TYPE_LABELS[m.toType] ? m.toType : 'company';
      const vals = [
        TYPE_LABELS[type], safeCell(clean(m.toDept, MAX_NAME)), safeCell(clean(m.toName, MAX_NAME)), safeCell(clean(m.text, MAX_TEXT)),
        m.approved === true, m.featured === true, now, m.deleted === true,
        safeCell(clean(m.account, MAX_NAME)), safeCell(clean(m.prize, MAX_NAME)), Number(m.wonAt) || ''
      ];
      inFile[id] = 1;
      const l = local[id];
      if (!l) { sh.appendRow([id, new Date(m.time || now)].concat(vals)); added++; }
      else if (mode === 'replace') { sh.getRange(l.row, 3, 1, vals.length).setValues([vals]); changed++; }
    });
    if (mode === 'replace') Object.keys(local).forEach(id => {
      const l = local[id];
      if (inFile[id] || l.deleted) return;
      sh.getRange(l.row, COL.featured).setValue(false); sh.getRange(l.row, COL.updated).setValue(now); sh.getRange(l.row, COL.deleted).setValue(true); hidden++;
    });
    const done = [], s = (body.withSettings && data.settings) || null, upd = {};
    if (s) {
      try { const d = JSON.parse(s.DEPARTMENTS || 'null'); if (Array.isArray(d) && d.length) { upd.DEPARTMENTS = JSON.stringify(d); upd.DEPARTMENTS_AT = String(now); done.push('DEPARTMENTS'); } } catch (e) {}
      if (s.ANON === 'true' || s.ANON === 'false') { upd.ANON = s.ANON; upd.ANON_AT = String(now); done.push('ANON'); }
      if (Object.keys(upd).length) PropertiesService.getScriptProperties().setProperties(upd);
      if (typeof s.TEXTS === 'string' && s.TEXTS) { let o = null; try { o = JSON.parse(s.TEXTS); } catch (e) {} const r = cleanTexts(o); if (r.ok) { writeTexts(r.json, now); done.push('TEXTS'); } }
    }
    CacheService.getScriptCache().remove('props');
    removeBig('approved_list');
    const rxn = rxMerge(Array.isArray(data.reactions) ? data.reactions.slice(0, 50000) : [], true);
    return { ok: true, mode: mode, added: added, changed: changed, hidden: hidden, reactions: rxn, settings: done, safety: copyName };
  } finally {
    lock.releaseLock();
  }
}

/** Xóa hẳn khỏi Sheet — chỉ với lời chúc đã "Ẩn đi". Ghi mã vào PURGED để bên Azure cũng xóa khi đồng bộ. */
function adminPurge(body) {
  const id = String(body.id || '');
  if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, error: 'Thiếu mã lời chúc.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSheet(), last = sh.getLastRow();
    const rows = last >= 2 ? sh.getRange(2, 1, last - 1, COL.deleted).getValues() : [];
    let row = -1;
    for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === id) { row = i + 2; break; }
    if (row > 0 && rows[row - 2][COL.deleted - 1] !== true) return { ok: false, error: 'Hãy "Ẩn đi" lời chúc trước khi xóa hẳn.' };
    if (row > 0) sh.deleteRow(row);
    addPurged([id]);
    removeBig('approved_list');
    return { ok: true, purged: id, found: row > 0 };
  } finally {
    lock.releaseLock();
  }
}
const PURGED_MAX = 2000;
function getPurged(p) { try { const a = JSON.parse((p || allProps()).PURGED || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } }
function addPurged(ids) {
  const props = PropertiesService.getScriptProperties();
  const cur = getPurged(props.getProperties()), set = {};
  cur.forEach(x => set[x] = 1);
  const add = ids.map(String).filter(x => /^[\w-]{1,40}$/.test(x) && !set[x]);
  if (!add.length) return cur;
  const out = cur.concat(add).slice(-PURGED_MAX);
  props.setProperty('PURGED', JSON.stringify(out));
  CacheService.getScriptCache().remove('props');
  return out;
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
    PropertiesService.getScriptProperties().setProperties({ DEPARTMENTS: JSON.stringify(depts), DEPARTMENTS_AT: String(Date.now()) });
    CacheService.getScriptCache().remove('props');
    const keys = Object.keys(renames);
    if (keys.length) {
      const sh = getSheet();
      const last = sh.getLastRow();
      if (last >= 2) {
        const rng = sh.getRange(2, 4, last - 1, 1), upd = sh.getRange(2, COL.updated, last - 1, 1);
        const vals = rng.getValues(), uv = upd.getValues(), now = Date.now();
        let changed = false;
        vals.forEach((r, i) => {
          const to = renames[r[0]];
          if (to) { r[0] = safeCell(clean(to, MAX_NAME)); uv[i][0] = now; changed = true; }
        });
        if (changed) { rng.setValues(vals); upd.setValues(uv); }
      }
    }
    removeBig('approved_list');
    return { ok: true, depts: depts };
  } finally {
    lock.releaseLock();
  }
}

/** Máy chủ Ban tổ chức đang chọn cho cả công ty: "google" hoặc "azure" (null = chưa chọn). */
function activeBackend() { return allProps().ACTIVE || null; }
function setActive(body) {
  const v = String(body.active || '');
  if (!/^(google|azure)$/.test(v)) return { ok: false, error: 'Máy chủ không hợp lệ.' };
  PropertiesService.getScriptProperties().setProperties({ ACTIVE: v, ACTIVE_AT: String(Date.now()) });
  CacheService.getScriptCache().remove('props');
  return { ok: true, active: v };
}

/** Chữ hiển thị do Ban tổ chức sửa trong Quản trị → Nội dung (chỉ lưu những chữ khác mặc định). */
const TEXTS_CHUNK = 2500, TEXTS_MAX = 30000;
function cleanTexts(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
  const out = {};
  const keys = Object.keys(o).slice(0, 400);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], v = o[k];
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) || typeof v !== 'string') continue;
    out[k] = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').slice(0, 2000);
  }
  const json = JSON.stringify(out);
  if (json.length > TEXTS_MAX) return { ok: false, error: 'Nội dung quá dài, bạn rút gọn bớt nhé.' };
  return { ok: true, obj: out, json: json };
}
function getTextsRaw(p) {
  p = p || allProps();
  const n = Number(p.TEXTS_N || 0); let s = '';
  for (let i = 0; i < n; i++) s += p['TEXTS_' + i] || '';
  return s || '{}';
}
function textsTv(p) { return String(Number((p || allProps()).TEXTS_AT || 0)); }
function textsObj(p) { try { return JSON.parse(getTextsRaw(p)); } catch (e) { return {}; } }
function writeTexts(json, at) {
  const props = PropertiesService.getScriptProperties(), old = Number(props.getProperty('TEXTS_N') || 0), parts = [];
  for (let i = 0; i < json.length; i += TEXTS_CHUNK) parts.push(json.slice(i, i + TEXTS_CHUNK));
  const upd = { TEXTS_N: String(parts.length), TEXTS_AT: String(at) };
  parts.forEach((x, i) => upd['TEXTS_' + i] = x);
  props.setProperties(upd);
  for (let i = parts.length; i < old; i++) props.deleteProperty('TEXTS_' + i);
  CacheService.getScriptCache().remove('props');
}
function setTexts(body) {
  const r = cleanTexts(body.texts);
  if (!r.ok) return r;
  const at = Date.now();
  writeTexts(r.json, at);
  return { ok: true, tv: String(at), texts: r.obj };
}
/** gắn chữ tùy chỉnh vào phản hồi: chỉ gửi nội dung khi trình duyệt chưa có bản mới nhất */
function withTexts(out, body) {
  const p = allProps(), tv = textsTv(p);
  out.tv = tv;
  if (String((body && body.tv) || '') !== tv) out.texts = textsObj(p);
  return out;
}

/** Chế độ ẩn danh (ANON=true): người gửi không cần nhập Account VGR và account không được lưu. */
function anonMode() { return allProps().ANON === 'true'; }
function setAnon(body) {
  if (typeof body.anon !== 'boolean') return { ok: false, error: 'Giá trị không hợp lệ.' };
  PropertiesService.getScriptProperties().setProperties({ ANON: String(body.anon), ANON_AT: String(Date.now()) });
  CacheService.getScriptCache().remove('props');
  removeBig('approved_list');
  return { ok: true, anon: body.anon };
}

/** Quản trị: đổi mã PIN nhân viên và/hoặc PIN quản trị. Có hiệu lực ngay. */
function setPins(body) {
  const pin = String(body.newPin || '').trim(), ap = String(body.newAdminPin || '').trim();
  if (!pin && !ap) return { ok: false, error: 'Chưa nhập mã PIN mới.' };
  if (pin && (pin.length < 4 || pin.length > 40)) return { ok: false, error: 'PIN nhân viên cần 4–40 ký tự.' };
  if (ap && (ap.length < 8 || ap.length > 60)) return { ok: false, error: 'PIN quản trị cần 8–60 ký tự.' };
  if ((pin || prop('PIN')) === (ap || prop('ADMIN_PIN'))) return { ok: false, error: 'PIN nhân viên và PIN quản trị phải khác nhau.' };
  const now = String(Number(body.at) || Date.now()), upd = {};
  if (pin) { upd.PIN = pin; upd.PIN_AT = now; }
  if (ap) { upd.ADMIN_PIN = ap; upd.ADMIN_PIN_AT = now; }
  PropertiesService.getScriptProperties().setProperties(upd);
  CacheService.getScriptCache().remove('props');
  return { ok: true, pin: !!pin, adminPin: !!ap };
}

/* ---------- Đồng bộ với máy chủ Azure ----------
   Azure chủ động gọi 2 phút/lần: lấy thay đổi của Google (peerDump) và gửi thay đổi của Azure sang
   (peerUpsert). Mỗi lời chúc có cùng mã ở 2 nơi; bên nào sửa sau ("Cập nhật" lớn hơn) thì thắng. */
function peerSettings(p) {
  return {
    DEPARTMENTS: { v: p.DEPARTMENTS || '', at: Number(p.DEPARTMENTS_AT || 0) },
    ACTIVE: { v: p.ACTIVE || '', at: Number(p.ACTIVE_AT || 0) },
    PIN: { v: p.PIN || '', at: Number(p.PIN_AT || 0) },
    ADMIN_PIN: { v: p.ADMIN_PIN || '', at: Number(p.ADMIN_PIN_AT || 0) },
    ANON: { v: p.ANON || '', at: Number(p.ANON_AT || 0) },
    TEXTS: { v: getTextsRaw(p), at: Number(p.TEXTS_AT || 0) }
  };
}
function peerDump(body) {
  const since = Number(body.since || 0);
  const items = listAll().filter(m => m.updated >= since);
  const p = PropertiesService.getScriptProperties().getProperties();
  const rx = rxAll().filter(e => e.at >= since).map(e => ({ id: e.id, cid: e.cid, r: e.r, at: e.at }));
  return { ok: true, items: items, settings: peerSettings(p), purged: getPurged(p), reactions: rx, now: Date.now() };
}
function peerUpsert(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  let added = 0, changed = 0, removed = 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet();
    /* xóa hẳn: hợp danh sách hai bên, xóa các dòng tương ứng */
    const purged = addPurged(Array.isArray(body.purged) ? body.purged : []), gone = {};
    purged.forEach(x => gone[x] = 1);
    {
      const last = sh.getLastRow();
      if (last >= 2) {
        const ids = sh.getRange(2, 1, last - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) if (gone[String(ids[i][0])]) { sh.deleteRow(i + 2); removed++; }
      }
    }
    if (items.length) {
      const last = sh.getLastRow();
      const local = {};
      if (last >= 2) sh.getRange(2, 1, last - 1, COL.updated).getValues().forEach((r, i) => {
        if (r[0]) local[String(r[0])] = { row: i + 2, updated: Number(r[8]) || (r[1] instanceof Date ? r[1].getTime() : 0) };
      });
      items.forEach(m => {
        const id = String(m.id || '');
        if (!/^[\w-]{1,40}$/.test(id) || !TYPE_LABELS[m.toType] || gone[id]) return;
        const vals = [
          TYPE_LABELS[m.toType], safeCell(clean(m.toDept, MAX_NAME)), safeCell(clean(m.toName, MAX_NAME)), safeCell(clean(m.text, MAX_TEXT)),
          m.approved === true, m.featured === true, Number(m.updated) || Date.now(), m.deleted === true,
          safeCell(clean(m.account, MAX_NAME)), safeCell(clean(m.prize, MAX_NAME)), Number(m.wonAt) || ''
        ];
        const l = local[id];
        if (!l) { sh.appendRow([id, new Date(m.time || Date.now())].concat(vals)); added++; }
        else if (Number(m.updated) > l.updated) { sh.getRange(l.row, 3, 1, vals.length).setValues([vals]); changed++; }
      });
    }
    /* cài đặt: bên nào đổi sau thì thắng */
    const s = body.settings || {}, props = PropertiesService.getScriptProperties(), cur = peerSettings(props.getProperties()), upd = {};
    const tx = s.TEXTS;   // chữ tùy chỉnh: lưu chia nhỏ, xử lý riêng
    if (tx && Number(tx.at) > cur.TEXTS.at && typeof tx.v === 'string') {
      let o = null; try { o = JSON.parse(tx.v); } catch (e) {}
      const r = cleanTexts(o);
      if (r.ok) { writeTexts(r.json, Number(tx.at)); upd.TEXTS_AT = String(Number(tx.at)); }
    }
    ['DEPARTMENTS', 'ACTIVE', 'PIN', 'ADMIN_PIN', 'ANON'].forEach(k => {
      const v = s[k];
      if (v && Number(v.at) > cur[k].at && typeof v.v === 'string' && v.v) { upd[k] = v.v; upd[k + '_AT'] = String(Number(v.at)); }
    });
    if (Object.keys(upd).length) props.setProperties(upd);
    CacheService.getScriptCache().removeAll(['props']);
    const rxn = rxMerge(body.reactions);
    if (added || changed || removed || upd.ANON) removeBig('approved_list');
    return { ok: true, added: added, changed: changed, removed: removed, reactions: rxn, settings: Object.keys(upd) };
  } finally {
    lock.releaseLock();
  }
}

/** Tự chạy khi bạn sửa Sheet (ví dụ tick "Đã duyệt"): ghi thời điểm sửa để đồng bộ sang Azure, xóa cache. */
function onEdit(e) {
  try {
    const r = e && e.range;
    if (r && r.getSheet().getName() === SHEET_NAME && r.getRow() >= 2 && r.getColumn() <= COL.deleted && r.getLastColumn() >= 3 && !(r.getColumn() === COL.updated && r.getNumColumns() === 1)) {
      const n = r.getNumRows(), now = Date.now();
      r.getSheet().getRange(r.getRow(), COL.updated, n, 1).setValues(Array.from({ length: n }, () => [now]));
    }
  } catch (err) {}
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
  if (!cache.get('sheet_ok3')) {
    if (sh.getRange(1, COL.wonAt).getValue() !== HEADERS[COL.wonAt - 1]) {   // sheet cũ thiếu cột mới
      sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#FDE8EC');
    }
    /* Ô tick sẵn cho 2 cột "Đã duyệt", "Tiêu biểu" để lúc gửi lời chúc chỉ cần 1 lệnh ghi */
    if (sh.getMaxRows() < MIN_ROWS) sh.insertRowsAfter(sh.getMaxRows(), MIN_ROWS - sh.getMaxRows());
    const cb = sh.getRange(2, COL.approved, sh.getMaxRows() - 1, 2);
    if (!sh.getRange(sh.getMaxRows(), COL.approved).getDataValidation()) {
      cb.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    }
    const del = sh.getRange(2, COL.deleted, sh.getMaxRows() - 1, 1);
    if (!sh.getRange(sh.getMaxRows(), COL.deleted).getDataValidation()) {
      del.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    }
    cache.put('sheet_ok3', '1', 21600);
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
