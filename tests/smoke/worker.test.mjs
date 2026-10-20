// Smoke tests for the deployed ask.sh worker, run by CI after each deploy.
//   WORKER_URL=https://craga-ask.craga89.workers.dev node --test tests/smoke/
//   SMOKE_AI=1 also asks real questions and reads one aloud, which spends some of the day's AI
//   test allowance; CI does that only when the worker's code changed.
// Requests carry x-craga-test, so they're charged to the test share and not logged.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = (process.env.WORKER_URL || 'https://craga-ask.craga89.workers.dev').replace(/\/$/, '');
const AI = process.env.SMOKE_AI === '1';
const SITE = 'https://craigthompson.dev';
const TEST = { 'x-craga-test': '1' };
const META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'ci', version: '1' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

/** @param {string} path @param {unknown} body @param {Record<string, string>} [headers] */
const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

/**
 * A refusal because the day's AI test allowance is used (several deploys in a day) is the
 * worker doing its job, so it passes, with a note.
 * @param {Response} r
 * @param {import('node:test').TestContext} t
 */
async function overBudget(r, t) {
  if (r.status !== 503) return false;
  const body = await r.clone().text();
  if (!body.includes('"budget"')) return false;
  t.diagnostic("today's AI test allowance is used up; the worker refused, as it should");
  return true;
}

describe('ask.sh', { skip: !AI && 'set SMOKE_AI=1 to ask real questions' }, () => {
  for (const q of ['Has he been through an acquisition?', 'Where did he study?', 'What roles is he looking for?']) {
    it(q, async (t) => {
      const r = await post('/ask', { q }, { origin: SITE, ...TEST });
      if (await overBudget(r, t)) return;
      assert.equal(r.status, 200, await r.clone().text());
      const d = await r.json();
      assert.ok(d.answer.length > 0);
      t.diagnostic(`${d.answer.replace(/\n/g, ' ')} [sources: ${d.sources.join(', ')}] [${d.model}]`);
    });
  }

  it('reads an answer aloud', async (t) => {
    const r = await post('/speak', { text: 'Hello from ask.sh.' }, { origin: SITE, ...TEST });
    if (await overBudget(r, t)) return;
    assert.equal(r.status, 200, await r.clone().text());
    const bytes = (await r.arrayBuffer()).byteLength;
    assert.ok(bytes > 1000, `${bytes} bytes`);
    t.diagnostic(`voice ${r.headers.get('x-voice')}, ${bytes} bytes`);
  });
});

describe('/mcp over HTTP', () => {
  it('initialize (protocol 2025-11-25)', async () => {
    const r = await post(
      '/mcp',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'ci', version: '1' } },
      },
      TEST,
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).result.serverInfo.name, 'craigthompson-dev');
  });

  it('server/discover (protocol 2026-07-28)', async () => {
    const r = await post(
      '/mcp',
      { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: META } },
      { ...TEST, 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'server/discover' },
    );
    assert.equal(r.status, 200);
    const { result } = await r.json();
    assert.equal(result.resultType, 'complete');
    assert.ok(result.supportedVersions.includes('2026-07-28'));
  });

  it('tools/call get_open_source (protocol 2026-07-28)', async (t) => {
    const r = await post(
      '/mcp',
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_open_source', arguments: {}, _meta: META } },
      { ...TEST, 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'tools/call', 'mcp-name': 'get_open_source' },
    );
    assert.equal(r.status, 200);
    const merged = (await r.json()).result.structuredContent.merged_pull_requests;
    assert.ok(merged > 0);
    t.diagnostic(`${merged} merged pull requests`);
  });
});

describe('/mcp with the official MCP SDK client', () => {
  const client = new Client({ name: 'craga-smoke', version: '1.0.0' });
  after(() => client.close());

  it('connects and lists the tools', async () => {
    await client.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers: TEST } }));
    assert.equal(client.getServerVersion()?.name, 'craigthompson-dev');
    const names = (await client.listTools()).tools.map((t) => t.name);
    assert.equal(names.length, 8, names.join(', '));
    assert.ok(names.includes('read_file'));
  });

  it('reads a file and searches the site', async () => {
    const file = await client.callTool({ name: 'read_file', arguments: { file: 'monorepo.md' } });
    assert.ok(!file.isError && /** @type {any} */ (file.structuredContent).text.length > 200);
    const search = await client.callTool({ name: 'search_site', arguments: { query: 'AWS cost', limit: 3 } });
    assert.ok(!search.isError && /** @type {any} */ (search.structuredContent).results.length > 0);
  });

  it('returns bad arguments as an error result', async () => {
    const bad = await client.callTool({ name: 'read_file', arguments: {} });
    assert.equal(bad.isError, true);
  });
});

describe('other origins', () => {
  it('are refused on /ask and /mcp', async () => {
    assert.equal((await post('/ask', { q: 'hi' }, { origin: 'https://example.com' })).status, 403);
    assert.equal(
      (await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { origin: 'https://example.com' })).status,
      403,
    );
  });
});
