// A hello for anyone who opens the console, and ask("…") to query ask.sh from there.
import { ASK_ENDPOINT, EMAIL, GITHUB, LINKEDIN, SITE, SOURCE } from '../site';

const BANNER =
  ' ██████╗ ██████╗   █████╗  ██╗  ██████╗ \n██╔════╝ ██╔══██╗ ██╔══██╗ ██║ ██╔════╝ \n██║      ██████╔╝ ███████║ ██║ ██║  ███╗\n██║      ██╔══██╗ ██╔══██║ ██║ ██║   ██║\n╚██████╗ ██║  ██║ ██║  ██║ ██║ ╚██████╔╝\n ╚═════╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═════╝ ';
const bg = 'background:#16271F;';
const pad = bg + 'padding:2px 14px;font-family:"Red Hat Mono",ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;';
const S = {
  art: bg + 'color:#8EC3E6;padding:14px 14px 6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.05;',
  cmd: pad + 'color:#B7D47A;',
  dim: pad + 'color:#99B0A5;',
  head: pad + 'color:#F6F8F4;font-weight:700;font-size:13px;',
  text: pad + 'color:#D9E4DD;',
  key: pad + 'color:#99B0A5;',
  link: pad + 'color:#8EC3E6;',
  end: bg + 'padding:0 14px 12px;color:#99B0A5;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;',
};
const parts: [keyof typeof S, string][] = [
  ['art', BANNER],
  ['cmd', '\n$ whoami'],
  ['head', '\nCraig Michael Thompson'],
  ['text', '\nHead of Engineering · hands-on, AI-first · Newcastle upon Tyne, UK'],
  ['dim', '\n● open to new roles'],
  ['cmd', '\n\n$ ls ./links'],
  ['key', '\nemail    '],
  ['link', EMAIL],
  ['key', '\ngithub   '],
  ['link', GITHUB],
  ['key', '\nlinkedin '],
  ['link', LINKEDIN],
  ['key', '\ncv       '],
  ['link', `${SITE}/cv/`],
  ['dim', ' (or /cv.json, JSON Resume)'],
  ['key', '\nsource   '],
  ['link', SOURCE],
  ['cmd', '\n\n$ ask("What roles is he looking for?")'],
  ['end', '\n# ask.sh works from here too: ask() any question about my experience.\n'],
];
console.log(parts.map((p) => '%c' + p[1]).join(''), ...parts.map((p) => S[p[0]]));

// (window.ask is the #ask section by default, so only skip it if a real function is there.)
const w = window as unknown as { ask?: unknown };
if (typeof w.ask !== 'function') {
  w.ask = (q: string) => {
    q = String(q || '').trim();
    if (!q) return 'Try: ask("Has he been through an acquisition?")';
    if (!ASK_ENDPOINT) return 'ask.sh is only connected on the live site.';
    fetch(ASK_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { answer: string; sources?: string[] }) => {
        const src = d.sources?.length ? `%c\n# sources: ${d.sources.join(', ')}` : '%c';
        console.log(`%c$ ./ask.sh ${JSON.stringify(q)}%c\n${d.answer}${src}`, S.cmd + 'padding-top:10px;', S.text + `padding-bottom:${d.sources?.length ? '2px' : '12px'};`, S.end);
      })
      .catch(() => console.log('%cask.sh is busy right now. The ask.sh section on the page can still search the site.', S.end + 'padding-top:12px;'));
    return 'Asking ask.sh…';
  };
}
