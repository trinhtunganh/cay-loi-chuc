const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { createCore } = require('../core');

const CONN = process.env.TABLES_CONNECTION || process.env.AzureWebJobsStorage;
const core = createCore({
  wishes: TableClient.fromConnectionString(CONN, 'LoiChuc'),
  settings: TableClient.fromConnectionString(CONN, 'CaiDat')
});

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

app.http('cay', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'cay',
  handler: async (request) => {
    if (request.method === 'OPTIONS') return { status: 204, headers: HEADERS };
    if (request.method === 'GET') return { status: 200, headers: HEADERS, body: JSON.stringify({ ok: true, message: 'Cây Tri Ân API (Azure) đang chạy.' }) };
    const ip = String(request.headers.get('x-forwarded-for') || request.headers.get('client-ip') || '').split(',')[0].split(':')[0].trim();
    const out = await core.handle(await request.text(), ip);
    return { status: 200, headers: HEADERS, body: JSON.stringify(out) };
  }
});
