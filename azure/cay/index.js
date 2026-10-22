/* Điểm vào HTTP: https://<tên-app>.azurewebsites.net/api/cay — không cần thư viện ngoài */
const { tableClient } = require('../tables');
const { createCore } = require('../core');

const CONN = process.env.TABLES_CONNECTION || process.env.AzureWebJobsStorage;
let core = null;
const getCore = () => core || (core = createCore({ wishes: tableClient(CONN, 'LoiChuc'), settings: tableClient(CONN, 'CaiDat') }));

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204, headers: HEADERS }; return; }
  if (req.method === 'GET') { context.res = { status: 200, headers: HEADERS, body: JSON.stringify({ ok: true, message: 'Cây Tri Ân API (Azure) đang chạy.' }) }; return; }
  const h = req.headers || {};
  const ip = String(h['x-forwarded-for'] || h['client-ip'] || '').split(',')[0].trim().replace(/:\d+$/, '');
  let raw = req.rawBody;
  if (raw == null) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  const out = await getCore().handle(String(raw), ip);
  context.res = { status: 200, headers: HEADERS, body: JSON.stringify(out) };
};
