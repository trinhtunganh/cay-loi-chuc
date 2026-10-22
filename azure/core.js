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
 * Dữ liệu nằm trong Storage account của Function App: bảng LoiChuc (lời chúc) và CaiDat
 * (phòng ban, máy chủ đang dùng, mốc đồng bộ).
 *
 * Đồng bộ: hàm "sync" chạy 2 phút/lần (thư mục sync/), lấy thay đổi từ Google rồi gửi thay đổi
 * của Azure sang. Mỗi lời chúc có cùng mã ở 2 nơi; bên nào sửa sau (trường updated) thì thắng.
 */
const crypto = require('crypto');

const TYPES = { company: 'Cả công ty', dept: 'Phòng ban', person: 'Đồng nghiệp' };
const DEFAULTS = { PIN: 'VinRobotics2026', ADMIN_PIN: 'VRAdmin2026', AUTO_APPROVE: 'true' };
const MAX_TEXT = 500, MAX_NAME = 60;
const LIST_TTL = 10e3, CFG_TTL = 30e3;
const FAIL_MAX = 15, FAIL_WINDOW = 10 * 60e3;   // sai PIN quá 15 lần/10 phút trên 1 địa chỉ IP thì chặn IP đó

function createCore(tables, env = process.env, deps = {}) {
  const { wishes, settings } = tables;
  let ready = null, listCache = null, cfgCache = null;
  const fails = new Map();

  const setting = k => (env[k] != null && env[k] !== '' ? String(env[k]) : DEFAULTS[k]);
  const clean = (v, max) => String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

  function ensure() {
    if (!ready) ready = Promise.all([wishes, settings].map(t => t.createTable().catch(e => { if (e.statusCode !== 409) throw e; })))
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

  const stamp = n => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(15, '0');
  const toItem = e => ({
    id: e.rowKey, time: e.time, toType: TYPES[e.toType] ? e.toType : 'company',
    toDept: e.toDept || '', toName: e.toName || '', text: e.text || '',
    approved: e.approved === true, featured: e.featured === true,
    updated: Number(e.updatedS) || Date.parse(e.time) || 0, deleted: e.deleted === true
  });
  const publicItem = m => ({ id: m.id, time: m.time, toType: m.toType, toDept: m.toDept, toName: m.toName, text: m.text, approved: m.approved, featured: m.featured });
  async function all() {
    const out = [];
    for await (const e of wishes.listEntities({ queryOptions: { filter: "PartitionKey eq 'w'" } })) out.push(toItem(e));
    return out.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }
  async function approved() {
    if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.v;
    const v = (await all()).filter(m => m.approved && !m.deleted).map(publicItem);
    listCache = { at: Date.now(), v };
    return v;
  }

  const hashItems = items => crypto.createHash('md5').update(JSON.stringify(items), 'utf8').digest('base64url').slice(0, 22);
  /* chỉ gửi phần thay đổi: không đổi → {same}, chỉ thêm mới → phần mới, còn lại → cả danh sách */
  async function listDelta(b) {
    const items = await approved(), ver = hashItems(items);
    const out = { ok: true, ver, depts: await depts(), active: await active() };
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
    const ok = setting('AUTO_APPROVE').toLowerCase() === 'true';
    const id = crypto.randomBytes(4).toString('hex');
    await wishes.createEntity({
      partitionKey: 'w', rowKey: id, time: new Date().toISOString(), toType,
      toDept: toType === 'company' ? '' : toDept, toName: toType === 'person' ? toName : '',
      text, approved: ok, featured: false, updatedS: stamp(Date.now()), deleted: false
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
    p.updatedS = stamp(Date.now());
    await wishes.updateEntity(p, 'Merge');
    listCache = null;
    const pick = k => (p[k] != null ? p[k] : e[k] === true);
    return { ok: true, approved: pick('approved'), featured: pick('featured'), deleted: pick('deleted') };
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
    updatedS: stamp(m.updated), deleted: m.deleted === true
  });
  const settingsOf = c => ({
    DEPARTMENTS: { v: c.DEPARTMENTS || '', at: Number(c.DEPARTMENTS_AT || 0) },
    ACTIVE: { v: c.ACTIVE || '', at: Number(c.ACTIVE_AT || 0) }
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
      let maxSeen = Number(cfg.SYNC_PULL || 0);
      for (const m of dump.items || []) {
        if (!m || !/^[\w-]{1,40}$/.test(String(m.id || ''))) continue;
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
      for (const k of ['DEPARTMENTS', 'ACTIVE']) {
        const v = gs[k];
        if (v && v.v && Number(v.at) > ls[k].at) { await setCfgStamped(k, v.v, Number(v.at)); ls[k] = { v: v.v, at: Number(v.at) }; }
      }
      if (pulled.added || pulled.changed) listCache = null;
      /* 2. gửi thay đổi của Azure sang Google */
      const pushSince = Math.max(0, Number(cfg.SYNC_PUSH || 0) - overlap);
      const items = [...local.values()].filter(m => Number(m.updated) >= pushSince);
      pushed = await peer({ action: 'peerUpsert', key, items, settings: ls });
      if (!pushed || !pushed.ok) throw new Error((pushed && pushed.error) || 'Google không nhận dữ liệu');
      await setCfg('SYNC_PULL', String(maxSeen));
      await setCfg('SYNC_PUSH', String(started));
    } catch (e) { err = String(e && e.message || e); }
    await setCfg('SYNC_AT', String(Date.now()));
    await setCfg('SYNC_OK', err ? 'Lỗi: ' + err.slice(0, 200) : 'ok');
    return { ok: !err, error: err || undefined, pulled, pushed: pushed && { added: pushed.added, changed: pushed.changed }, ms: Date.now() - started };
  }
  async function syncStatus() { const c = await getCfg(); return { at: Number(c.SYNC_AT || 0), status: c.SYNC_OK || '' }; }

  /** Xử lý 1 yêu cầu. ip dùng để chặn dò PIN theo từng máy, không lưu lại. */
  async function handle(raw, ip) {
    let body;
    try { body = JSON.parse(raw || '{}'); } catch (e) { return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' }; }
    const now = Date.now(), f = fails.get(ip);
    if (f && now - f.at > FAIL_WINDOW) fails.delete(ip);
    if (f && f.n >= FAIL_MAX && now - f.at <= FAIL_WINDOW) return { ok: false, error: 'Nhập sai PIN quá nhiều lần. Vui lòng thử lại sau 10 phút.' };

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
        case 'verify':        return { ok: true, active: await active() };
        case 'list':          return await listDelta(body);
        case 'submit':        return await submit(body);
        case 'adminVerify':   return { ok: true, active: await active() };
        case 'adminList':     return { ok: true, items: await all(), depts: await depts(), active: await active(), sync: await syncStatus() };
        case 'adminSyncNow':  return Object.assign(await sync(), { sync: await syncStatus() });
        case 'adminSet':      return await adminSet(body);
        case 'adminSetDepts': return await setDepts(body);
        case 'adminSetActive':return await setActive(body);
        default:              return { ok: false, error: 'Thao tác không hợp lệ.' };
      }
    } catch (err) {
      console.error(err);
      return { ok: false, error: 'Máy chủ đang bận, bạn thử lại sau ít phút nhé.' };
    }
  }

  return { handle, sync };
}

module.exports = { createCore };
