/**
 * CÂY TRI ÂN — Backend dự phòng trên Azure (Functions + Table Storage)
 * Cùng giao thức với Code.gs (Google Apps Script): POST JSON {action, pin, adminPin, ...}.
 *
 * Cài đặt (Function App → Settings → Environment variables):
 *   PIN           mã PIN để vào trang
 *   ADMIN_PIN     mã PIN quản trị
 *   AUTO_APPROVE  "true" = lời chúc lên cây ngay (mặc định), "false" = chờ duyệt
 *   GOOGLE_URL    địa chỉ máy chủ Google (…/exec) để đồng bộ 2 chiều
 *   SYNC_KEY      khóa bí mật, đặt giống thuộc tính SYNC_KEY bên Google
 * Dữ liệu nằm trong Storage account của Function App: bảng LoiChuc (lời chúc), CaiDat
 * (phòng ban, máy chủ đang dùng, mốc đồng bộ) và SaoLuu (các bản sao lưu tự động).
 *
 * Đồng bộ: hàm "sync" chạy 2 phút/lần (thư mục sync/), lấy thay đổi từ Google rồi gửi thay đổi
 * của Azure sang. Mỗi lời chúc có cùng mã ở 2 nơi; bên nào sửa sau (trường updated) thì thắng.
 */
const crypto = require('crypto');

const TYPES = { company: 'Cả công ty', dept: 'Phòng ban', person: 'Đồng nghiệp' };
const DEFAULTS = { PIN: 'VinRobotics2026', ADMIN_PIN: 'VRAdmin2026', AUTO_APPROVE: 'true' };
const MAX_TEXT = 500, MAX_NAME = 60;
const ACCOUNT_RE = /^[A-Za-z0-9._@\-]{2,60}$/;
const LIST_TTL = 10e3, CFG_TTL = 30e3;
const FAIL_MAX = 15, FAIL_WINDOW = 10 * 60e3;   // sai PIN quá 15 lần/10 phút trên 1 địa chỉ IP thì chặn IP đó

function createCore(tables, env = process.env, deps = {}) {
  const { wishes, settings } = tables;
  let ready = null, listCache = null, cfgCache = null;
  const fails = new Map();

  /* PIN đổi trong Quản trị (bảng CaiDat) được ưu tiên hơn biến môi trường */
  let pinCfg = {};
  const setting = k => (pinCfg[k] ? String(pinCfg[k]) : env[k] != null && env[k] !== '' ? String(env[k]) : DEFAULTS[k]);
  const clean = (v, max) => String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

  function ensure() {
    if (!ready) ready = Promise.all([wishes, settings, tables.backups].filter(Boolean).map(t => t.createTable().catch(e => { if (e.statusCode !== 409) throw e; })))
      .catch(e => { ready = null; throw e; });
    return ready;
  }

  async function getCfg(fresh) {
    if (!fresh && cfgCache && Date.now() - cfgCache.at < CFG_TTL) return cfgCache.v;
    const v = {};
    for await (const e of settings.listEntities({ queryOptions: { filter: "PartitionKey eq 'cfg'" } })) v[e.rowKey] = e.value;
    cfgCache = { at: Date.now(), v };
    return v;
  }
  async function setCfg(key, value) {
    await settings.upsertEntity({ partitionKey: 'cfg', rowKey: key, value: String(value) }, 'Replace');
    cfgCache = null;
  }
  /* cài đặt có dấu thời gian để đồng bộ: bên nào đổi sau thì thắng */
  async function setCfgStamped(key, value, at) {
    await setCfg(key, value);
    await setCfg(key + '_AT', String(at || Date.now()));
  }
  async function depts() {
    const v = (await getCfg()).DEPARTMENTS;
    try { const a = JSON.parse(v || 'null'); return Array.isArray(a) && a.length ? a : null; } catch (e) { return null; }
  }
  async function active() { return (await getCfg()).ACTIVE || null; }
  /* chữ hiển thị do Ban tổ chức sửa trong Quản trị → Nội dung (chỉ lưu những chữ khác mặc định) */
  const TEXTS_MAX = 30000;
  function cleanTexts(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'Dữ liệu không hợp lệ.' };
    const out = {};
    for (const k of Object.keys(o).slice(0, 400)) {
      const v = o[k];
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) || typeof v !== 'string') continue;
      out[k] = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').slice(0, 2000);
    }
    const json = JSON.stringify(out);
    if (json.length > TEXTS_MAX) return { ok: false, error: 'Nội dung quá dài, bạn rút gọn bớt nhé.' };
    return { ok: true, obj: out, json };
  }
  const textsObj = c => { try { const o = JSON.parse(c.TEXTS || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  async function setTexts(b) {
    const r = cleanTexts(b.texts);
    if (!r.ok) return r;
    const at = Date.now();
    await setCfgStamped('TEXTS', r.json, at);
    return { ok: true, tv: String(at), texts: r.obj };
  }
  async function withTexts(out, b) {
    const c = await getCfg(), tv = String(Number(c.TEXTS_AT || 0));
    out.tv = tv;
    if (String((b && b.tv) || '') !== tv) out.texts = textsObj(c);
    return out;
  }
  async function anonMode() { return (await getCfg()).ANON === 'true'; }
  async function setAnon(b) {
    if (typeof b.anon !== 'boolean') return { ok: false, error: 'Giá trị không hợp lệ.' };
    await setCfgStamped('ANON', String(b.anon));
    listCache = null;
    return { ok: true, anon: b.anon };
  }

  const stamp = n => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(15, '0');
  const toItem = e => ({
    id: e.rowKey, time: e.time, toType: TYPES[e.toType] ? e.toType : 'company',
    toDept: e.toDept || '', toName: e.toName || '', text: e.text || '',
    approved: e.approved === true, featured: e.featured === true,
    updated: Number(e.updatedS) || Date.parse(e.time) || 0, deleted: e.deleted === true,
    account: e.account || '', prize: e.prize || '', wonAt: Number(e.wonAtS) || 0
  });
  const publicItem = m => ({ id: m.id, time: m.time, toType: m.toType, toDept: m.toDept, toName: m.toName, text: m.text, approved: m.approved, featured: m.featured });
  async function all() {
    const out = [];
    for await (const e of wishes.listEntities({ queryOptions: { filter: "PartitionKey eq 'w'" } })) out.push(toItem(e));
    return out.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }
  async function approved() {
    if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.v;
    const anon = await anonMode();   // không ẩn danh: hiện account người gửi (trường "from")
    const v = (await all()).filter(m => m.approved && !m.deleted).map(m => { const p = publicItem(m); if (!anon && m.account) p.from = m.account; return p; });
    listCache = { at: Date.now(), v };
    return v;
  }

  const hashItems = items => crypto.createHash('md5').update(JSON.stringify(items), 'utf8').digest('base64url').slice(0, 22);
  /* chỉ gửi phần thay đổi: không đổi → {same}, chỉ thêm mới → phần mới, còn lại → cả danh sách */
  async function listDelta(b) {
    const items = await approved(), ver = hashItems(items);
    const out = await withTexts({ ok: true, ver, depts: await depts(), active: await active(), anon: await anonMode() }, b);
    const since = String(b.since || ''), after = String(b.after || '');
    if (since && since === ver) { out.same = true; return out; }
    if (since && after) {
      const old = [], added = [];
      items.forEach(m => (String(m.time) <= after ? old : added).push(m));
      if (hashItems(old) === since) { out.partial = true; out.items = added; return out; }
    }
    out.items = items;
    return out;
  }

  async function submit(b) {
    const toType = TYPES[b.toType] ? b.toType : null;
    if (!toType) return { ok: false, error: 'Vui lòng chọn người nhận.' };
    const toDept = clean(b.toDept, MAX_NAME), toName = clean(b.toName, MAX_NAME), text = clean(b.text, MAX_TEXT);
    if (toType === 'dept' && !toDept) return { ok: false, error: 'Vui lòng chọn phòng ban.' };
    if (toType === 'person' && !toName) return { ok: false, error: 'Vui lòng nhập tên người nhận.' };
    if (text.length < 5) return { ok: false, error: 'Lời chúc cần ít nhất 5 ký tự.' };
    const anon = await anonMode();   // chế độ ẩn danh: không nhận, không lưu account
    const account = anon ? '' : clean(b.account, MAX_NAME);
    if (!anon && !ACCOUNT_RE.test(account)) return { ok: false, error: 'Vui lòng nhập Account VGR hợp lệ (không dấu, không khoảng trắng).' };
    const ok = setting('AUTO_APPROVE').toLowerCase() === 'true';
    const id = crypto.randomBytes(4).toString('hex');
    await wishes.createEntity({
      partitionKey: 'w', rowKey: id, time: new Date().toISOString(), toType,
      toDept: toType === 'company' ? '' : toDept, toName: toType === 'person' ? toName : '',
      text, approved: ok, featured: false, updatedS: stamp(Date.now()), deleted: false, account, prize: '', wonAtS: ''
    });
    if (ok) listCache = null;
    return { ok: true, id, approved: ok };
  }

  async function adminSet(b) {
    const id = String(b.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, error: 'Thiếu mã lời chúc.' };
    let e;
    try { e = await wishes.getEntity('w', id); } catch (err) { if (err.statusCode === 404) return { ok: false, error: 'Không tìm thấy lời chúc.' }; throw err; }
    const p = { partitionKey: 'w', rowKey: id };
    if (typeof b.featured === 'boolean') { p.featured = b.featured; if (b.featured) p.approved = true; }
    if (typeof b.approved === 'boolean') { p.approved = b.approved; if (!b.approved) p.featured = false; }
    if (typeof b.deleted === 'boolean') { p.deleted = b.deleted; if (b.deleted) p.featured = false; }
    if (typeof b.prize === 'string') { const pz = clean(b.prize, MAX_NAME); p.prize = pz; p.wonAtS = pz ? stamp(Number(b.wonAt) || Date.now()) : ''; }
    p.updatedS = stamp(Date.now());
    await wishes.updateEntity(p, 'Merge');
    listCache = null;
    const pick = k => (p[k] != null ? p[k] : e[k] === true);
    return { ok: true, approved: pick('approved'), featured: pick('featured'), deleted: pick('deleted'), prize: p.prize != null ? p.prize : (e.prize || ''), wonAt: Number(p.wonAtS != null ? p.wonAtS : e.wonAtS) || 0 };
  }

  async function setDepts(b) {
    const list = Array.isArray(b.depts) ? b.depts : [], seen = {}, out = [];
    for (const d of list) {
      if (out.length >= 40) break;
      const name = clean(d && d.name, MAX_NAME), color = String((d && d.color) || ''), k = name.toLowerCase();
      if (!name || seen[k]) continue;
      seen[k] = 1; out.push(/^#[0-9a-fA-F]{6}$/.test(color) ? { name, color } : { name });
    }
    if (!out.length) return { ok: false, error: 'Cần ít nhất một phòng ban.' };
    await setCfgStamped('DEPARTMENTS', JSON.stringify(out));
    const renames = b.renames && typeof b.renames === 'object' ? b.renames : {};
    if (Object.keys(renames).length) {
      for await (const e of wishes.listEntities({ queryOptions: { filter: "PartitionKey eq 'w'" } })) {
        const to = renames[e.toDept];
        if (to) await wishes.updateEntity({ partitionKey: 'w', rowKey: e.rowKey, toDept: clean(to, MAX_NAME), updatedS: stamp(Date.now()) }, 'Merge');
      }
    }
    listCache = null;
    return { ok: true, depts: out };
  }

  async function setActive(b) {
    const v = String(b.active || '');
    if (!/^(google|azure)$/.test(v)) return { ok: false, error: 'Máy chủ không hợp lệ.' };
    await setCfgStamped('ACTIVE', v);
    return { ok: true, active: v };
  }

  /* ---------- sao lưu / khôi phục ----------
     Tự sao lưu (thư mục backup/, chạy mỗi giờ): chỉ chụp khi dữ liệu đã đổi so với bản trước, và cách bản trước
     ít nhất 3 giờ; quanh ngày sinh nhật (từ 18 giờ trước đến 30 giờ sau) thì 1 giờ; sau sự kiện 6 giờ.
     Giữ 24 bản gần nhất + 1 bản/ngày trong 45 ngày. Mỗi bản ~300 KB với 1.000 lời chúc → vài chục MB, gần như 0 đồng. */
  const BK_CHUNK = 30000, BK_KEEP = 24, BK_DAYS = 45;
  const BIRTHDAY0 = Date.parse(env.BIRTHDAY || '2026-11-21T00:00:00+07:00');
  const bdayOf = c => { const v = Date.parse(textsObj(c).birthday || ''); return Number.isFinite(v) ? v : BIRTHDAY0; };   // ngày đổi trong Quản trị → Nội dung
  const backups = tables.backups;
  function bkInterval(now, B) {
    const BIRTHDAY = Number.isFinite(B) ? B : BIRTHDAY0;
    if (now >= BIRTHDAY - 18 * 3600e3 && now <= BIRTHDAY + 30 * 3600e3) return 3600e3;
    return now > BIRTHDAY + 30 * 3600e3 ? 6 * 3600e3 : 3 * 3600e3;
  }
  async function snapshotData() {
    const c = await getCfg(true);
    return { format: 'cay-tri-an-backup', v: 1, at: new Date().toISOString(), source: 'azure', items: await all(),
      settings: { DEPARTMENTS: c.DEPARTMENTS || '', ANON: c.ANON || '', TEXTS: c.TEXTS || '' } };
  }
  async function bkIndex() {
    const out = [];
    for await (const e of backups.listEntities({ queryOptions: { filter: "PartitionKey eq 'idx'" } })) out.push(e);
    return out.sort((a, b) => String(b.rowKey).localeCompare(String(a.rowKey)));
  }
  async function bkDelete(e) {
    for (let i = 0; i < Number(e.chunks || 0); i++) { try { await backups.deleteEntity('s' + e.rowKey, String(i).padStart(3, '0')); } catch (x) { if (x.statusCode !== 404) throw x; } }
    try { await backups.deleteEntity('idx', e.rowKey); } catch (x) { if (x.statusCode !== 404) throw x; }
  }
  async function bkPrune() {
    const list = await bkIndex(), keep = new Set(), days = new Set(), now = Date.now();
    list.forEach((e, i) => {
      const at = Number(e.atS) || 0, day = new Date(at + 7 * 3600e3).toISOString().slice(0, 10);
      if (i < BK_KEEP) keep.add(e.rowKey);
      if (!days.has(day) && now - at < BK_DAYS * 864e5) { days.add(day); keep.add(e.rowKey); }
    });
    let removed = 0;
    for (const e of list) if (!keep.has(e.rowKey)) { await bkDelete(e); removed++; }
    return removed;
  }
  async function bkSave(kind, data) {
    data = data || await snapshotData();
    const json = JSON.stringify(data), hash = crypto.createHash('md5').update(JSON.stringify([data.items, data.settings]), 'utf8').digest('hex');
    const at = Date.now(), id = stamp(at), parts = [];
    for (let i = 0; i < json.length; i += BK_CHUNK) parts.push(json.slice(i, i + BK_CHUNK));
    for (let i = 0; i < parts.length; i++) await backups.upsertEntity({ partitionKey: 's' + id, rowKey: String(i).padStart(3, '0'), v: parts[i] }, 'Replace');
    const n = (data.items || []).length;
    await backups.upsertEntity({ partitionKey: 'idx', rowKey: id, atS: String(at), n, live: (data.items || []).filter(m => !m.deleted).length, chunks: parts.length, size: json.length, hash, kind }, 'Replace');
    const pruned = await bkPrune();
    return { ok: true, id, at, n, size: json.length, pruned };
  }
  async function autoBackup() {
    await ensure();
    const now = Date.now(), last = (await bkIndex())[0], B = bdayOf(await getCfg(true));
    if (last && now - Number(last.atS || 0) < bkInterval(now, B) - 5 * 60e3) return { ok: true, skipped: 'chưa đến giờ' };
    const data = await snapshotData();
    const hash = crypto.createHash('md5').update(JSON.stringify([data.items, data.settings]), 'utf8').digest('hex');
    if (last && last.hash === hash) return { ok: true, skipped: 'dữ liệu không đổi' };
    return bkSave('auto', data);
  }
  async function bkList() {
    const list = (await bkIndex()).map(e => ({ id: e.rowKey, at: Number(e.atS) || 0, n: Number(e.n) || 0, live: Number(e.live) || 0, size: Number(e.size) || 0, kind: e.kind || 'auto' }));
    return { ok: true, backups: list, everyMin: Math.round(bkInterval(Date.now(), bdayOf(await getCfg())) / 60e3), keep: BK_KEEP, days: BK_DAYS };
  }
  async function bkGet(b) {
    const id = String(b.id || '');
    if (!/^\d{15}$/.test(id)) return { ok: false, error: 'Mã bản sao lưu không hợp lệ.' };
    const parts = [];
    for await (const e of backups.listEntities({ queryOptions: { filter: `PartitionKey eq 's${id}'` } })) parts.push(e);
    if (!parts.length) return { ok: false, error: 'Không tìm thấy bản sao lưu.' };
    parts.sort((x, y) => String(x.rowKey).localeCompare(String(y.rowKey)));
    try { return { ok: true, data: JSON.parse(parts.map(e => e.v || '').join('')) }; } catch (e) { return { ok: false, error: 'Bản sao lưu bị hỏng.' }; }
  }
  /* khôi phục: "merge" = chỉ thêm lại lời chúc bị mất; "replace" = đưa về đúng bản sao lưu (lời chúc không có trong bản → Ẩn đi, không xóa) */
  async function restore(b) {
    const data = b.data || {}, items = Array.isArray(data.items) ? data.items.slice(0, 5000) : null, mode = b.mode === 'replace' ? 'replace' : 'merge';
    if (!items) return { ok: false, error: 'File sao lưu không hợp lệ.' };
    const safety = await bkSave('before-restore');   // luôn chụp lại hiện trạng trước khi khôi phục
    const cur = new Map((await all()).map(m => [m.id, m])), gone = new Set(purgedOf(await getCfg(true)));
    const now = Date.now(), inFile = new Set();
    let added = 0, changed = 0, hidden = 0;
    for (const raw of items) {
      if (!raw || !/^[\w-]{1,40}$/.test(String(raw.id || ''))) continue;
      const m = Object.assign({}, raw, { updated: now });
      if (gone.has(String(m.id))) { const base = String(m.id).slice(0, 36); let k = 1; while (gone.has(base + 'r' + k)) k++; m.id = base + 'r' + k; }   // đã xóa hẳn → mã mới, giống nhau ở 2 máy chủ
      inFile.add(String(m.id));
      const l = cur.get(String(m.id));
      if (!l) { await wishes.upsertEntity(entityOf(m), 'Replace'); added++; }
      else if (mode === 'replace') { await wishes.upsertEntity(entityOf(m), 'Replace'); changed++; }
    }
    if (mode === 'replace') for (const [id, l] of cur) if (!inFile.has(id) && !l.deleted) {
      await wishes.updateEntity({ partitionKey: 'w', rowKey: id, deleted: true, featured: false, updatedS: stamp(now) }, 'Merge'); hidden++;
    }
    const done = [];
    if (b.withSettings && data.settings) {
      const s = data.settings;
      try { const d = JSON.parse(s.DEPARTMENTS || 'null'); if (Array.isArray(d) && d.length) { await setCfgStamped('DEPARTMENTS', JSON.stringify(d), now); done.push('DEPARTMENTS'); } } catch (e) {}
      if (s.ANON === 'true' || s.ANON === 'false') { await setCfgStamped('ANON', s.ANON, now); done.push('ANON'); }
      if (typeof s.TEXTS === 'string' && s.TEXTS) { let o = null; try { o = JSON.parse(s.TEXTS); } catch (e) {} const r = cleanTexts(o); if (r.ok) { await setCfgStamped('TEXTS', r.json, now); done.push('TEXTS'); } }
    }
    listCache = null;
    return { ok: true, mode, added, changed, hidden, settings: done, safety: safety.id };
  }

  /* ---------- xóa hẳn (chỉ lời chúc đã "Ẩn đi"); mã được ghi vào PURGED để Google cũng xóa ---------- */
  const PURGED_MAX = 2000;
  const purgedOf = c => { try { const a = JSON.parse(c.PURGED || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } };
  async function addPurged(ids) {
    const cur = purgedOf(await getCfg(true)), seen = new Set(cur);
    const add = ids.map(String).filter(x => /^[\w-]{1,40}$/.test(x) && !seen.has(x));
    if (!add.length) return cur;
    const out = cur.concat(add).slice(-PURGED_MAX);
    await setCfg('PURGED', JSON.stringify(out));
    return out;
  }
  async function adminPurge(b) {
    const id = String(b.id || '');
    if (!/^[\w-]{1,40}$/.test(id)) return { ok: false, error: 'Thiếu mã lời chúc.' };
    let e = null;
    try { e = await wishes.getEntity('w', id); } catch (err) { if (err.statusCode !== 404) throw err; }
    if (e && e.deleted !== true) return { ok: false, error: 'Hãy "Ẩn đi" lời chúc trước khi xóa hẳn.' };
    if (e) { try { await wishes.deleteEntity('w', id); } catch (err) { if (err.statusCode !== 404) throw err; } }
    await addPurged([id]);
    listCache = null;
    return { ok: true, purged: id, found: !!e };
  }

  /* ---------- đồng bộ với Google ---------- */
  async function peer(body) {
    if (deps.peer) return deps.peer(body);
    const r = await fetch(env.GOOGLE_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow', signal: AbortSignal.timeout(40000) });
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { throw new Error('Google trả về không phải JSON: ' + t.slice(0, 120)); }
  }
  const entityOf = m => ({
    partitionKey: 'w', rowKey: String(m.id), time: String(m.time || new Date().toISOString()),
    toType: TYPES[m.toType] ? m.toType : 'company', toDept: clean(m.toDept, MAX_NAME), toName: clean(m.toName, MAX_NAME),
    text: clean(m.text, MAX_TEXT), approved: m.approved === true, featured: m.featured === true,
    updatedS: stamp(m.updated), deleted: m.deleted === true,
    account: clean(m.account, MAX_NAME), prize: clean(m.prize, MAX_NAME), wonAtS: Number(m.wonAt) ? stamp(m.wonAt) : ''
  });
  const settingsOf = c => ({
    DEPARTMENTS: { v: c.DEPARTMENTS || '', at: Number(c.DEPARTMENTS_AT || 0) },
    ACTIVE: { v: c.ACTIVE || '', at: Number(c.ACTIVE_AT || 0) },
    PIN: { v: c.PIN || '', at: Number(c.PIN_AT || 0) },
    ADMIN_PIN: { v: c.ADMIN_PIN || '', at: Number(c.ADMIN_PIN_AT || 0) },
    ANON: { v: c.ANON || '', at: Number(c.ANON_AT || 0) },
    TEXTS: { v: c.TEXTS || '', at: Number(c.TEXTS_AT || 0) }
  });
  let syncing = null;
  function sync() { return syncing || (syncing = runSync().finally(() => { syncing = null; })); }
  async function runSync() {
    const key = String(env.SYNC_KEY || '');
    if (!env.GOOGLE_URL || key.length < 16) return { ok: false, error: 'Chưa cài GOOGLE_URL / SYNC_KEY.' };
    const started = Date.now();
    await ensure();
    const cfg = await getCfg(true);
    const overlap = 10 * 60e3;
    let pulled = { added: 0, changed: 0 }, pushed = null, err = '';
    try {
      /* 1. lấy thay đổi của Google */
      const dump = await peer({ action: 'peerDump', key, since: Math.max(0, Number(cfg.SYNC_PULL || 0) - overlap) });
      if (!dump || !dump.ok) throw new Error((dump && dump.error) || 'Google không trả lời');
      const local = new Map((await all()).map(m => [m.id, m]));
      /* xóa hẳn: hợp danh sách hai bên rồi xóa ở Azure */
      const purged = await addPurged(Array.isArray(dump.purged) ? dump.purged : []), gone = new Set(purged);
      for (const id of [...local.keys()]) if (gone.has(id)) {
        try { await wishes.deleteEntity('w', id); } catch (e) { if (e.statusCode !== 404) throw e; }
        local.delete(id); pulled.removed = (pulled.removed || 0) + 1;
      }
      let maxSeen = Number(cfg.SYNC_PULL || 0);
      for (const m of dump.items || []) {
        if (!m || !/^[\w-]{1,40}$/.test(String(m.id || ''))) continue;
        if (gone.has(String(m.id))) continue;
        maxSeen = Math.max(maxSeen, Number(m.updated) || 0);
        const l = local.get(String(m.id));
        if (!l) {
          try { await wishes.createEntity(entityOf(m)); } catch (e) { if (e.statusCode !== 409) throw e; await wishes.updateEntity(entityOf(m), 'Merge'); }
          pulled.added++; local.set(String(m.id), m);
        } else if (Number(m.updated) > l.updated) {
          await wishes.updateEntity(entityOf(m), 'Merge'); pulled.changed++; local.set(String(m.id), m);
        }
      }
      const gs = dump.settings || {}, ls = settingsOf(cfg);
      for (const k of ['DEPARTMENTS', 'ACTIVE', 'PIN', 'ADMIN_PIN', 'ANON', 'TEXTS']) {
        const v = gs[k];
        if (v && v.v && Number(v.at) > ls[k].at) { await setCfgStamped(k, v.v, Number(v.at)); ls[k] = { v: v.v, at: Number(v.at) }; if (k === 'ANON') listCache = null; }
      }
      if (pulled.added || pulled.changed || pulled.removed) listCache = null;
      /* 2. gửi thay đổi của Azure sang Google */
      const pushSince = Math.max(0, Number(cfg.SYNC_PUSH || 0) - overlap);
      const items = [...local.values()].filter(m => Number(m.updated) >= pushSince);
      pushed = await peer({ action: 'peerUpsert', key, items, settings: ls, purged });
      if (!pushed || !pushed.ok) throw new Error((pushed && pushed.error) || 'Google không nhận dữ liệu');
      await setCfg('SYNC_PULL', String(maxSeen));
      await setCfg('SYNC_PUSH', String(started));
    } catch (e) { err = String(e && e.message || e); }
    await setCfg('SYNC_AT', String(Date.now()));
    await setCfg('SYNC_OK', err ? 'Lỗi: ' + err.slice(0, 200) : 'ok');
    return { ok: !err, error: err || undefined, pulled, pushed: pushed && { added: pushed.added, changed: pushed.changed, removed: pushed.removed || 0 }, ms: Date.now() - started };
  }
  /* đổi PIN: lưu vào bảng CaiDat, có dấu thời gian để đồng bộ sang Google */
  async function setPins(b) {
    const pin = String(b.newPin || '').trim(), ap = String(b.newAdminPin || '').trim();
    if (!pin && !ap) return { ok: false, error: 'Chưa nhập mã PIN mới.' };
    if (pin && (pin.length < 4 || pin.length > 40)) return { ok: false, error: 'PIN nhân viên cần 4–40 ký tự.' };
    if (ap && (ap.length < 8 || ap.length > 60)) return { ok: false, error: 'PIN quản trị cần 8–60 ký tự.' };
    if ((pin || setting('PIN')) === (ap || setting('ADMIN_PIN'))) return { ok: false, error: 'PIN nhân viên và PIN quản trị phải khác nhau.' };
    const at = Number(b.at) || Date.now();
    if (pin) await setCfgStamped('PIN', pin, at);
    if (ap) await setCfgStamped('ADMIN_PIN', ap, at);
    pinCfg = await getCfg(true);
    return { ok: true, pin: !!pin, adminPin: !!ap };
  }
  async function syncStatus() { const c = await getCfg(); return { at: Number(c.SYNC_AT || 0), status: c.SYNC_OK || '' }; }

  /** Xử lý 1 yêu cầu. ip dùng để chặn dò PIN theo từng máy, không lưu lại. */
  async function handle(raw, ip) {
    let body;
    try { body = JSON.parse(raw || '{}'); } catch (e) { return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' }; }
    const now = Date.now(), f = fails.get(ip);
    if (f && now - f.at > FAIL_WINDOW) fails.delete(ip);
    if (f && f.n >= FAIL_MAX && now - f.at <= FAIL_WINDOW) return { ok: false, error: 'Nhập sai PIN quá nhiều lần. Vui lòng thử lại sau 10 phút.' };

    try { await ensure(); pinCfg = await getCfg(); } catch (e) { console.error(e); }
    const action = String(body.action || ''), isAdmin = action.indexOf('admin') === 0;
    const given = String((isAdmin ? body.adminPin : body.pin) || '').trim();
    const okPin = isAdmin ? given === setting('ADMIN_PIN') : (given === setting('PIN') || given === setting('ADMIN_PIN'));
    if (!okPin) {
      const g = fails.get(ip) || { n: 0, at: now }; g.n++; fails.set(ip, g);
      if (fails.size > 5000) fails.clear();
      return { ok: false, error: 'Mã PIN không đúng.', code: isAdmin ? 'BAD_ADMIN_PIN' : 'BAD_PIN' };
    }
    try {
      await ensure();
      switch (action) {
        case 'verify':        return await withTexts({ ok: true, active: await active(), anon: await anonMode() }, body);
        case 'list':          return await listDelta(body);
        case 'submit':        return await submit(body);
        case 'adminVerify':   return { ok: true, active: await active(), anon: await anonMode() };
        case 'adminList':     return { ok: true, items: await all(), depts: await depts(), active: await active(), anon: await anonMode(), texts: textsObj(await getCfg()), tv: String(Number((await getCfg()).TEXTS_AT || 0)), sync: await syncStatus(), staffPin: setting('PIN') };
        case 'adminSetPins':  return await setPins(body);
        case 'adminSyncNow':  return Object.assign(await sync(), { sync: await syncStatus() });
        case 'adminSet':      return await adminSet(body);
        case 'adminPurge':    return await adminPurge(body);
        case 'adminSetDepts': return await setDepts(body);
        case 'adminSetActive':return await setActive(body);
        case 'adminSetAnon':  return await setAnon(body);
        case 'adminSetTexts': return await setTexts(body);
        case 'adminBackups':  return await bkList();
        case 'adminBackupGet':return await bkGet(body);
        case 'adminBackupNow':return await bkSave('manual');
        case 'adminRestore':  return await restore(body);
        default:              return { ok: false, error: 'Thao tác không hợp lệ.' };
      }
    } catch (err) {
      console.error(err);
      return { ok: false, error: 'Máy chủ đang bận, bạn thử lại sau ít phút nhé.' };
    }
  }

  return { handle, sync, autoBackup };
}

module.exports = { createCore };
