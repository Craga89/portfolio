// WebMCP: tools an AI agent in the browser can call, instead of reading and clicking through the
// page. Only where the browser offers it (document.modelContext; navigator.modelContext before
// Chrome 150). The tools themselves are shared with the Worker's MCP server (shared/agent-tools.js);
// this is where they get their data on the page.
import { $ } from './dom';
import { askIndex } from './ask';
import { goTo } from './anchors';
import { navigate } from './navigate';
import * as A from '../../shared/agent-tools.js';
import { ASK_ENDPOINT } from '../site';

type ModelContext = { registerTool(tool: unknown, opts?: { signal: AbortSignal }): Promise<unknown> | unknown };

export function bindAgentTools() {
  const mc = ((document as unknown as { modelContext?: ModelContext }).modelContext ?? (navigator as unknown as { modelContext?: ModelContext }).modelContext) || null;
  if (!mc || typeof mc.registerTool !== 'function') return;
  const ctl = new AbortController();
  const getJson = (u: string) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: HTTP ${r.status}`))));
  let cv: Promise<unknown> | null = null;
  const sections = [...document.querySelectorAll('main section[id]')].map((s) => s.id);
  const src = {
    url: (p: string) => new URL(p, location.href).href,
    cv: () => (cv ??= getJson('/cv.json').catch((e) => ((cv = null), Promise.reject(e)))),
    index: () => askIndex(),
    live: () => getJson('/live.json').catch(() => ({})),
    projects: () => A.linkedProjects(document),
    build: () => {
      const b = $<HTMLAnchorElement>('[data-built]');
      return b ? { sha: b.href.split('/').pop(), at: b.dataset.built } : null;
    },
    ask: (q: string, signal?: AbortSignal) => {
      if (!ASK_ENDPOINT) return Promise.reject(new Error('no ask.sh service here'));
      return fetch(ASK_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q, via: 'webmcp' }), signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    },
    sections: () => sections,
    show: (f: { section: string; key: string; url: string }) => {
      if (f.section === 'blog') return void (location.href = f.url);
      navigate(`/?${f.section === 'case-studies' ? 'case' : 'resp'}=${f.key}#${f.section}`);
    },
    scroll: (id: string) => goTo(id),
  };
  const tools = A.describeTools('page', src as never) as { name: string }[];
  Promise.all(
    tools.map(async (t) => {
      try {
        await mc.registerTool({ ...t, execute: (input: unknown, opts?: { signal?: AbortSignal }) => A.callTool(t.name, input as never, src as never, 'page', opts?.signal) }, { signal: ctl.signal });
        return 1;
      } catch {
        return 0;
      }
    }),
  ).then((r) => {
    const n = r.reduce((a: number, x) => a + x, 0);
    const status = $('[data-webmcp-status]');
    if (status && n) {
      status.dataset.on = 'true';
      $('[data-webmcp-line]', status)!.textContent = `In this browser: WebMCP is on, with ${n} tools registered.`;
    }
  });
}
