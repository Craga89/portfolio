// /mcp: the shared agent tools as an MCP server, in both protocol eras.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../worker/src/index.js';
import { ORIGIN, env } from './helpers.mjs';

const MCP = 'https://craga-ask.example.workers.dev/mcp';
/** @type {(method: string, params: Record<string, any>, opts?: { id?: number | null, headers?: Record<string, string>, origin?: string }) => Request} */
const rpc = (method, params, { id = 1, headers = {}, origin } = {}) =>
  new Request(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(origin ? { origin } : {}),
      ...headers,
    },
    body: JSON.stringify(id == null ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }),
  });
const V = '2026-07-28';
const modernMeta = {
  'io.modelcontextprotocol/protocolVersion': V,
  'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' },
  'io.modelcontextprotocol/clientCapabilities': {},
};
/** @type {(method: string, params?: Record<string, any>, extra?: Record<string, string>) => Request} */
const modern = (method, params = {}, extra = {}) =>
  rpc(
    method,
    { ...params, _meta: modernMeta },
    {
      headers: {
        'mcp-protocol-version': V,
        'mcp-method': method,
        ...(params.name ? { 'mcp-name': params.name } : {}),
        ...extra,
      },
    },
  );
const LIVE = {
  oss: {
    prs: 59,
    repos: 35,
    since: 2012,
    qtip: { stars: 1970, forks: 458, commits: 1384 },
    timeline: [{ y: 2014, q: 2, n: 7, repos: ['BlueSpire/Durandal'] }],
    at: '2026-10-17',
  },
  lighthouse: { mobile: { performance: 97 }, desktop: { performance: 100 } },
  build: { sha: 'abc123', at: '2026-10-18T00:00:00Z' },
};
const realFetch = globalThis.fetch;
/** @type {string[]} */
const liveFetches = [];
let liveDown = false;
// The tools read live.json from the site: answered here.
before(() => {
  globalThis.fetch = async (u, opts) => {
    if (!String(u).endsWith('/live.json')) return realFetch(u, opts);
    liveFetches.push(String(u));
    if (liveDown) return new Response('not found', { status: 404 });
    return Response.json(LIVE);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});
const call = async (/** @type {Request} */ r, /** @type {Record<string, unknown>} */ bindings = {}) => {
  const res = await worker.fetch(r, env(bindings));
  const t = await res.text();
  return { status: res.status, headers: res.headers, body: t ? JSON.parse(t) : null };
};
const toolData = (/** @type {any} */ b) => JSON.parse(b.result.content[0].text);

describe('/mcp', () => {
  it('legacy: initialize negotiates a version, no session', async () => {
    const r = await call(
      rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }),
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.result.protocolVersion, '2025-06-18');
    assert.deepEqual(r.body.result.capabilities, { tools: { listChanged: false } });
    assert.equal(r.body.result.serverInfo.name, 'craigthompson-dev');
    assert.ok(r.body.result.instructions.length > 50);
    assert.equal(r.headers.get('mcp-session-id'), null);
    const old = await call(rpc('initialize', { protocolVersion: '2024-01-01' }));
    assert.equal(old.body.result.protocolVersion, '2025-11-25');
    const note = await call(rpc('notifications/initialized', {}, { id: null }));
    assert.equal(note.status, 202);
    assert.equal(note.body, null);
    assert.deepEqual((await call(rpc('ping', {}))).body.result, {});
  });

  it('tools/list: the shared tools, minus page-only ones', async () => {
    const { body } = await call(rpc('tools/list', {}));
    const names = body.result.tools.map((t) => t.name);
    assert.deepEqual(names, [
      'get_profile',
      'get_career',
      'list_files',
      'read_file',
      'search_site',
      'ask',
      'get_open_source',
      'get_site_report',
    ]);
    const read = body.result.tools.find((t) => t.name === 'read_file');
    assert.deepEqual(Object.keys(read.inputSchema.properties), ['file']);
    assert.deepEqual(read.inputSchema.required, ['file']);
    assert.ok(
      body.result.tools.every(
        (t) => t.description.length > 40 && t.annotations.readOnlyHint === true && t.inputSchema.type === 'object',
      ),
    );
    assert.ok(!/on the page for the person/.test(read.description));
  });

  it('tools/call: profile, files, search and errors', async () => {
    const p = await call(rpc('tools/call', { name: 'get_profile', arguments: {} }));
    assert.equal(p.body.result.structuredContent.name, 'Craig Michael Thompson');
    assert.equal(toolData(p.body).links.cv_pdf, 'https://craigthompson.dev/cv.pdf');
    const list = await call(rpc('tools/call', { name: 'list_files', arguments: { section: 'case-studies' } }));
    assert.ok(list.body.result.structuredContent.files.length >= 12);
    const f = await call(rpc('tools/call', { name: 'read_file', arguments: { file: 'ai/platform.md' } }));
    assert.equal(f.body.result.structuredContent.url, 'https://craigthompson.dev/case-studies/ai-platform/');
    assert.ok(f.body.result.structuredContent.text.length > 200);
    const blog = await call(rpc('tools/call', { name: 'list_files', arguments: { section: 'blog' } }));
    const posts = toolData(blog.body).files;
    assert.ok(
      posts.length > 10 && posts.every((p) => /\/blog\/[\w-]+\/$/.test(p.url)),
      'blog posts are listed with their pages',
    );
    const post = await call(rpc('tools/call', { name: 'read_file', arguments: { file: 'blog/' + posts[0].file } }));
    assert.ok(toolData(post.body).text.length > 100);
    const miss = await call(rpc('tools/call', { name: 'read_file', arguments: { file: 'nope.md' } }));
    assert.equal(miss.body.result.isError, true);
    assert.match(miss.body.result.content[0].text, /monorepo\.md/);
    const s = await call(rpc('tools/call', { name: 'search_site', arguments: { query: 'ISO 27001', limit: 2 } }));
    assert.equal(s.body.result.structuredContent.results.length, 2);
    assert.match(s.body.result.structuredContent.results[0].title, /compliance\.md/);
    const bad = await call(rpc('tools/call', { name: 'search_site', arguments: { query: 'x', limit: 50 } }));
    assert.equal(bad.body.result.isError, true);
    const unknown = await call(rpc('tools/call', { name: 'show_section', arguments: { section: 'faq' } }));
    assert.equal(unknown.body.error.code, -32602);
  });

  it('ask: answers from the model, logs as mcp, and respects the limit', async () => {
    const logged = [];
    const env = {
      AI: { run: async () => ({ response: 'Yes, he has owned the AWS budget. See budget.md.\nSOURCES: resp-bud' }) },
      DB: {
        prepare: (sql) => ({
          bind: (...a) => ({
            first: async () => null,
            run: async () => {
              if (!/ai_budget/.test(sql)) logged.push(a);
            },
          }),
        }),
      },
      ASK_LIMITER: { limit: async () => ({ success: true }) },
    };
    const r = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Has he owned a budget?' } }), env);
    const d = r.body.result.structuredContent;
    assert.equal(d.via, 'ai');
    assert.match(d.answer, /AWS budget/);
    assert.match(d.sources[0], /^budget\.md/);
    assert.equal(logged.length, 1);
    assert.equal(logged[0][5], 'mcp');
    const limited = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Again?' } }), {
      ...env,
      ASK_LIMITER: { limit: async () => ({ success: false }) },
    });
    assert.equal(limited.body.result.isError, true);
    assert.match(limited.body.result.content[0].text, /Too many questions/);
    const down = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Where did he study?' } }), {
      AI: {
        run: async () => {
          throw new Error('quota');
        },
      },
    });
    assert.equal(down.body.result.structuredContent.via, 'search');
  });

  it('live data: open source falls back to the build snapshot when live.json is unreachable', async () => {
    liveDown = true;
    try {
      const o = await call(rpc('tools/call', { name: 'get_open_source', arguments: {} }));
      const d = o.body.result.structuredContent;
      assert.ok(d.merged_pull_requests > 0, 'merged count from the snapshot');
      assert.ok(d.by_quarter.length > 0);
    } finally {
      liveDown = false;
    }
  });
  it('live data: open source and site report read live.json from the site', async () => {
    liveFetches.length = 0;
    const o = await call(rpc('tools/call', { name: 'get_open_source', arguments: {} }), {
      SITE_URL: 'https://craigthompson.dev/',
    });
    const d = o.body.result.structuredContent;
    assert.equal(d.merged_pull_requests, 59);
    assert.equal(d.qtip2.stars, 1970);
    assert.equal(d.by_quarter[0].merged, 7);
    assert.ok(d.linked_projects.some((p) => p.url === 'https://github.com/qTip2/qTip2'));
    assert.deepEqual(liveFetches, ['https://craigthompson.dev/live.json']);
    const rep = await call(rpc('tools/call', { name: 'get_site_report', arguments: {} }));
    assert.equal(rep.body.result.structuredContent.deployed.commit, 'abc123');
    assert.equal(rep.body.result.structuredContent.lighthouse.mobile.performance, 97);
  });

  it('modern (2026-07-28): discover, per-request meta, header checks', async () => {
    const d = await call(modern('server/discover'));
    assert.equal(d.status, 200);
    assert.equal(d.body.result.resultType, 'complete');
    assert.deepEqual(d.body.result.supportedVersions.slice(0, 2), ['2026-07-28', '2025-11-25']);
    assert.equal(d.body.result._meta['io.modelcontextprotocol/serverInfo'].name, 'craigthompson-dev');
    assert.equal(d.body.result.cacheScope, 'public');
    const l = await call(modern('tools/list'));
    assert.equal(l.body.result.tools.length, 8);
    assert.equal(typeof l.body.result.ttlMs, 'number');
    const c = await call(modern('tools/call', { name: 'get_career', arguments: {} }));
    assert.equal(c.body.result.resultType, 'complete');
    assert.ok(c.body.result.structuredContent.work.length >= 3);
    // Base64-encoded Mcp-Name is decoded before comparing.
    const b64 = await call(
      modern(
        'tools/call',
        { name: 'get_career', arguments: {} },
        { 'mcp-name': '=?base64?' + btoa('get_career') + '?=' },
      ),
    );
    assert.equal(b64.status, 200);
    const noName = await call(
      rpc(
        'tools/call',
        { name: 'get_career', arguments: {}, _meta: modernMeta },
        { headers: { 'mcp-protocol-version': V, 'mcp-method': 'tools/call' } },
      ),
    );
    assert.equal(noName.status, 400);
    assert.equal(noName.body.error.code, -32020);
    const wrongName = await call(
      modern('tools/call', { name: 'get_career', arguments: {} }, { 'mcp-name': 'get_profile' }),
    );
    assert.equal(wrongName.body.error.code, -32020);
    const wrongMethod = await call(modern('tools/list', {}, { 'mcp-method': 'tools/call' }));
    assert.equal(wrongMethod.body.error.code, -32020);
    const noVersion = await call(rpc('tools/list', { _meta: modernMeta }, { headers: { 'mcp-method': 'tools/list' } }));
    assert.equal(noVersion.body.error.code, -32020);
    const future = { ...modernMeta, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' };
    const unsup = await call(
      rpc(
        'tools/list',
        { _meta: future },
        { headers: { 'mcp-protocol-version': '2099-01-01', 'mcp-method': 'tools/list' } },
      ),
    );
    assert.equal(unsup.status, 400);
    assert.equal(unsup.body.error.code, -32022);
    assert.equal(unsup.body.error.data.requested, '2099-01-01');
    assert.ok(unsup.body.error.data.supported.includes('2026-07-28'));
    const ping = await call(modern('ping'));
    assert.equal(ping.status, 404);
    assert.equal(ping.body.error.code, -32601);
    const init = await call(modern('initialize'));
    assert.equal(init.body.error.code, -32601);
  });

  it('transport: methods, origins, batches, rate limit', async () => {
    const get = await worker.fetch(new Request(MCP, { method: 'GET' }), env());
    assert.equal(get.status, 405);
    assert.equal((await worker.fetch(new Request(MCP, { method: 'DELETE' }), env())).status, 405);
    const foreign = await call(rpc('tools/list', {}, { origin: 'https://evil.example' }));
    assert.equal(foreign.status, 403);
    const site = await call(rpc('tools/list', {}, { origin: ORIGIN }));
    assert.equal(site.status, 200);
    assert.equal(site.headers.get('access-control-allow-origin'), ORIGIN);
    assert.match(site.headers.get('access-control-allow-headers') ?? '', /mcp-protocol-version/);
    const pre = await worker.fetch(new Request(MCP, { method: 'OPTIONS', headers: { origin: ORIGIN } }), env());
    assert.equal(pre.status, 204);
    const bad = await call(new Request(MCP, { method: 'POST', body: '{nope' }));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, -32700);
    const batch = await worker.fetch(
      new Request(MCP, {
        method: 'POST',
        body: JSON.stringify([
          { jsonrpc: '2.0', id: 1, method: 'ping' },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]),
      }),
      env(),
    );
    const out = await batch.json();
    assert.deepEqual(
      out.map((/** @type {any} */ x) => x.id),
      [1, 2],
    );
    const slow = await call(rpc('tools/list', {}), { MCP_LIMITER: { limit: async () => ({ success: false }) } });
    assert.equal(slow.status, 429);
    const wrongHeader = await call(rpc('tools/list', {}, { headers: { 'mcp-protocol-version': '1999-01-01' } }));
    assert.equal(wrongHeader.status, 400);
  });
});
