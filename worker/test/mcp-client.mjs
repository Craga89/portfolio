// Smoke test for the deployed /mcp with the official MCP TypeScript SDK client (run in CI after deploy):
//   npm i @modelcontextprotocol/sdk@1 && node mcp-client.mjs https://…/mcp
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2];
const note = (title, msg) => console.log(`::notice title=${title}::${msg}`);
const fail = (title, msg) => { console.log(`::error title=${title}::${msg}`); process.exitCode = 1; };
const client = new Client({ name: 'craga-smoke', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { 'x-craga-test': '1' } } }));
  const v = client.getServerVersion();
  note('MCP SDK client', `connected to ${v && v.name} ${v && v.version}`);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  if (names.length !== 8 || !names.includes('read_file')) fail('MCP tools/list', names.join(', ')); else note('MCP tools/list', names.join(', '));
  const r = await client.callTool({ name: 'read_file', arguments: { file: 'monorepo.md' } });
  const d = r.structuredContent || JSON.parse(r.content[0].text);
  if (r.isError || !d.text || d.text.length < 200) fail('MCP read_file', JSON.stringify(r).slice(0, 300)); else note('MCP read_file', `${d.title} · ${d.url}`);
  const s = await client.callTool({ name: 'search_site', arguments: { query: 'AWS cost', limit: 3 } });
  const sr = s.structuredContent || JSON.parse(s.content[0].text);
  if (s.isError || !sr.results.length) fail('MCP search_site', JSON.stringify(s).slice(0, 300)); else note('MCP search_site', sr.results.map((x) => x.title).join(' | '));
  const bad = await client.callTool({ name: 'read_file', arguments: {} });
  if (!bad.isError) fail('MCP bad arguments', 'expected an isError result'); else note('MCP bad arguments', bad.content[0].text);
} catch (e) {
  fail('MCP SDK client', (e && e.stack) || String(e));
} finally {
  try { await client.close(); } catch (e) {}
}
