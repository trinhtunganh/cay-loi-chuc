/**
 * Client tối giản cho Azure Table Storage (REST + Shared Key Lite), không cần thư viện ngoài.
 * Chỉ có các thao tác core.js dùng: createTable, listEntities, createEntity, getEntity,
 * updateEntity (Merge), upsertEntity (Replace).
 */
const https = require('https');
const crypto = require('crypto');

function parseConn(conn) {
  const o = {};
  String(conn || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  if (!o.AccountName || !o.AccountKey) throw new Error('Thiếu chuỗi kết nối Storage (AzureWebJobsStorage).');
  return { account: o.AccountName, key: Buffer.from(o.AccountKey, 'base64'), host: `${o.AccountName}.table.${o.EndpointSuffix || 'core.windows.net'}` };
}

const keyPart = v => String(v).replace(/'/g, "''");
const entityPath = (table, pk, rk) => `${table}(PartitionKey='${encodeURIComponent(keyPart(pk))}',RowKey='${encodeURIComponent(keyPart(rk))}')`;

function makeError(status, text) {
  const e = new Error(`Table storage ${status}: ${String(text).slice(0, 300)}`);
  e.statusCode = status;
  return e;
}

function tableClient(conn, table) {
  const c = parseConn(conn);

  /** path: phần sau dấu "/" (không có query); query: chuỗi query đã mã hóa, không có "?" */
  function call(method, path, { query = '', body = null, headers = {} } = {}) {
    const date = new Date().toUTCString();
    const resource = `/${c.account}/${path}`;
    const sig = crypto.createHmac('sha256', c.key).update(`${date}\n${resource}`, 'utf8').digest('base64');
    const data = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const h = Object.assign({
      'x-ms-date': date,
      'x-ms-version': '2019-02-02',
      'Authorization': `SharedKeyLite ${c.account}:${sig}`,
      'Accept': 'application/json;odata=nometadata',
      'DataServiceVersion': '3.0;NetFx',
      'MaxDataServiceVersion': '3.0;NetFx'
    }, headers);
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = data.length; }
    return new Promise((resolve, reject) => {
      const req = https.request({ host: c.host, method, path: '/' + path + (query ? '?' + query : ''), headers: h, timeout: 15000 }, res => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) return reject(makeError(res.statusCode, text));
          resolve({ status: res.statusCode, headers: res.headers, json: text ? JSON.parse(text) : null });
        });
      });
      req.on('timeout', () => req.destroy(new Error('Table storage timeout')));
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  const clean = e => { const o = Object.assign({}, e); o.partitionKey = o.PartitionKey; o.rowKey = o.RowKey; delete o.PartitionKey; delete o.RowKey; delete o.Timestamp; return o; };
  const toWire = e => { const o = Object.assign({}, e); o.PartitionKey = String(o.partitionKey); o.RowKey = String(o.rowKey); delete o.partitionKey; delete o.rowKey; return o; };

  return {
    async createTable() { await call('POST', 'Tables', { body: { TableName: table }, headers: { Prefer: 'return-no-content' } }); },
    async *listEntities(opts) {
      const filter = opts && opts.queryOptions && opts.queryOptions.filter;
      let next = null;
      do {
        const q = [];
        if (filter) q.push('$filter=' + encodeURIComponent(filter));
        if (next) { q.push('NextPartitionKey=' + encodeURIComponent(next.pk)); if (next.rk) q.push('NextRowKey=' + encodeURIComponent(next.rk)); }
        const r = await call('GET', `${table}()`, { query: q.join('&') });
        for (const e of (r.json && r.json.value) || []) yield clean(e);
        const pk = r.headers['x-ms-continuation-nextpartitionkey'];
        next = pk ? { pk, rk: r.headers['x-ms-continuation-nextrowkey'] } : null;
      } while (next);
    },
    async createEntity(e) { await call('POST', table, { body: toWire(e), headers: { Prefer: 'return-no-content' } }); },
    async getEntity(pk, rk) { return clean((await call('GET', entityPath(table, pk, rk))).json); },
    async updateEntity(e) { await call('MERGE', entityPath(table, e.partitionKey, e.rowKey), { body: toWire(e), headers: { 'If-Match': '*' } }); },
    async upsertEntity(e) { await call('PUT', entityPath(table, e.partitionKey, e.rowKey), { body: toWire(e) }); },
    async deleteEntity(pk, rk) { await call('DELETE', entityPath(table, pk, rk), { headers: { 'If-Match': '*' } }); }
  };
}

module.exports = { tableClient, parseConn };
