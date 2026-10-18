// /mcp: the site's agent tools (shared/agent-tools.js) as a public, read-only MCP server.
//
// Stateless Streamable HTTP: every request is a POST answered with one JSON response, and
// nothing is kept between requests. Both protocol eras are served on the same endpoint:
//   - modern (2026-07-28): no handshake; each request carries its protocol version in
//     params._meta and mirrors it, the method and the tool name in headers, which must match.
//   - legacy (2025-11-25 and earlier): an initialize handshake first, then plain requests.
//     No session id is issued, so nothing has to be remembered between them.
import { describeTools, callTool, hasTool, SERVER_INSTRUCTIONS } from '../../shared/agent-tools.js';

export const MODERN = ['2026-07-28'];
export const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const SERVER = { name: 'craigthompson-dev', title: 'Craig Michael Thompson (portfolio)', version: '1.0.0' };
const META = {
  version: 'io.modelcontextprotocol/protocolVersion',
  serverInfo: 'io.modelcontextprotocol/serverInfo',
};
const ERR = { parse: -32700, invalidRequest: -32600, notFound: -32601, invalidParams: -32602, headerMismatch: -32020, unsupportedVersion: -32022 };

const reply = (body, status, headers) => new Response(body == null ? null : JSON.stringify(body), {
  status,
  headers: Object.assign(body == null ? {} : { 'content-type': 'application/json; charset=utf-8' }, { 'cache-control': 'no-store' }, headers),
});
const rpcError = (id, code, message, data) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: Object.assign({ code, message }, data ? { data } : {}) });

// Mcp-Name and Mcp-Param-* values may arrive Base64-encoded as =?base64?…?=.
export function headerValue(v) {
  if (v == null) return null;
  const m = /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(v);
  if (!m) return v;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch (e) { return null; }
}

async function run(msg, era, src, signal) {
  const p = msg.params || {};
  const tools = () => describeTools('mcp', src);
  switch (msg.method) {
    case 'initialize': {
      if (era === 'modern') return { error: [ERR.notFound, 'initialize is not part of protocol ' + MODERN[0] + '; send requests directly'] };
      const asked = p.protocolVersion;
      return { result: { protocolVersion: LEGACY.includes(asked) ? asked : LEGACY[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: SERVER_INSTRUCTIONS } };
    }
    case 'server/discover':
      if (era !== 'modern') return { error: [ERR.notFound, 'Method not found: server/discover'] };
      return { result: { supportedVersions: MODERN.concat(LEGACY), capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS, ttlMs: 3600000, cacheScope: 'public' } };
    case 'ping':
      if (era === 'modern') return { error: [ERR.notFound, 'Method not found: ping'] };
      return { result: {} };
    case 'tools/list':
      return { result: era === 'modern' ? { tools: tools(), ttlMs: 3600000, cacheScope: 'public' } : { tools: tools() } };
    case 'tools/call': {
      if (typeof p.name !== 'string' || !hasTool(p.name, 'mcp')) return { error: [ERR.invalidParams, 'Unknown tool: ' + p.name], status: 200 };
      return { result: await callTool(p.name, p.arguments || {}, src, 'mcp', signal) };
    }
    default:
      return { error: [ERR.notFound, 'Method not found: ' + msg.method], status: era === 'modern' ? 404 : 200 };
  }
}

// One JSON-RPC message → [status, response body or null].
async function handle(msg, request, src) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return [400, rpcError(msg && msg.id, ERR.invalidRequest, 'Invalid JSON-RPC request')];
  const isNote = !('id' in msg);
  const meta = (msg.params && msg.params._meta) || null;
  const version = meta && meta[META.version];
  const era = version ? 'modern' : 'legacy';
  const hdr = (n) => request.headers.get(n);

  if (era === 'modern') {
    // Headers mirror the body so gateways can route on them; they must agree.
    const mismatch = (what) => [400, rpcError(msg.id, ERR.headerMismatch, 'Header mismatch: ' + what)];
    if (hdr('mcp-protocol-version') == null) return mismatch('MCP-Protocol-Version header is missing');
    if (hdr('mcp-protocol-version') !== version) return mismatch(`MCP-Protocol-Version header value '${hdr('mcp-protocol-version')}' does not match body value '${version}'`);
    if (!MODERN.includes(version)) return [400, rpcError(msg.id, ERR.unsupportedVersion, 'Unsupported protocol version', { supported: MODERN.concat(LEGACY), requested: version })];
    if (!isNote) {
      if (hdr('mcp-method') == null) return mismatch('Mcp-Method header is missing');
      if (hdr('mcp-method') !== msg.method) return mismatch(`Mcp-Method header value '${hdr('mcp-method')}' does not match body value '${msg.method}'`);
      if (msg.method === 'tools/call') {
        const name = headerValue(hdr('mcp-name'));
        if (name == null) return mismatch('Mcp-Name header is missing');
        if (name !== (msg.params || {}).name) return mismatch(`Mcp-Name header value '${name}' does not match body value '${(msg.params || {}).name}'`);
      }
    }
  } else {
    const v = hdr('mcp-protocol-version');
    if (v && !LEGACY.includes(v) && !MODERN.includes(v)) return [400, rpcError(msg.id, ERR.invalidRequest, 'Unsupported MCP-Protocol-Version: ' + v + '. Supported: ' + MODERN.concat(LEGACY).join(', '))];
  }

  if (isNote) return [202, null];
  const out = await run(msg, era, src, request.signal);
  if (out.error) return [out.status || (era === 'modern' && out.error[0] === ERR.notFound ? 404 : 200), rpcError(msg.id, out.error[0], out.error[1])];
  const result = era === 'modern' ? Object.assign({ resultType: 'complete' }, out.result, { _meta: { [META.serverInfo]: { name: SERVER.name, version: SERVER.version } } }) : out.result;
  return [200, { jsonrpc: '2.0', id: msg.id, result }];
}

export async function handleMcp(request, src, headers) {
  const h = Object.assign({}, headers);
  if (request.method === 'OPTIONS') return reply(null, 204, h);
  if (request.method !== 'POST') return reply(rpcError(null, ERR.invalidRequest, 'Use POST for MCP requests'), 405, Object.assign({ allow: 'POST, OPTIONS' }, h));
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return reply(rpcError(null, ERR.parse, 'Parse error'), 400, h); }
  // JSON-RPC batches (protocol 2025-03-26 only): answer each request, skip notifications.
  if (Array.isArray(body)) {
    if (!body.length) return reply(rpcError(null, ERR.invalidRequest, 'Empty batch'), 400, h);
    const out = [];
    for (const m of body) { const [, b] = await handle(m, request, src); if (b) out.push(b); }
    return out.length ? reply(out, 200, h) : reply(null, 202, h);
  }
  const [status, b] = await handle(body, request, src);
  return reply(b, status, h);
}
