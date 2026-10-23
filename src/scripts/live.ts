// The latest CI results and open-source counts (live.json, written by CI with each deploy),
// fetched once they're needed: when the sections that show them come near, or the visitor does
// anything. Until then the page shows what it was built with.
import { $, $$, el } from './dom';
import { fmt, stars } from '../lib/oss-format';

interface Live {
  lighthouse?: { mobile?: Scores; desktop?: Scores; at?: string; run?: string };
  a11y?: { pass: boolean; axeRuns: number; at?: string; run?: string };
  evals?: { passed: number; total: number; at?: string; run?: string; cases?: { q: string; expect: string; answer?: string; pass: boolean }[] };
  oss?: { prs: number; repos: number; since: number; qtip?: { stars: number; forks: number; commits: number } };
}
interface Scores {
  performance: number;
  accessibility: number;
  bestPractices: number;
}

const day = (iso?: string) => {
  try {
    return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : '';
  } catch {
    return '';
  }
};
const ran = (at?: string) => 'last run ' + (day(at) || 'recently');

function card(key: string, line: string, sub: string | null, at?: string, run?: string) {
  const c = $(`[data-live="${key}"]`);
  if (!c) return;
  $('[data-live-line]', c)!.textContent = line;
  const s = $('[data-live-sub]', c);
  if (s && sub) s.textContent = sub;
  $('[data-live-meta]', c)!.textContent = ran(at);
  const r = $('[data-live-run]', c);
  if (r && run) {
    r.querySelector('a')!.href = run;
    r.hidden = false;
  }
}

function show(d: Live) {
  const { lighthouse: lh, a11y: ax, evals: ev, oss } = d;
  if (lh?.mobile && lh.desktop) {
    const a = Math.min(lh.mobile.accessibility, lh.desktop.accessibility);
    const bp = Math.min(lh.mobile.bestPractices, lh.desktop.bestPractices);
    card('lh', `${lh.mobile.performance} · ${lh.desktop.performance}`, `performance on mobile · desktop; accessibility ${a}, best practices ${bp}`, lh.at, lh.run);
  }
  if (ax) card('a11y', ax.pass ? 'Passing' : 'Failing', `${ax.axeRuns} axe runs, plus keyboard, focus, reflow, spacing and motion checks`, ax.at, ax.run);
  if (ev) {
    card('ev', `${ev.passed} of ${ev.total} correct`, null, ev.at);
    const short = $('[data-live-ev-short]');
    if (short) short.textContent = `${ev.passed}/${ev.total} passing`;
    const list = $('[data-live-ev-cases]');
    if (list && ev.cases?.length) {
      list.replaceChildren(
        ...ev.cases.map((c) =>
          el('li', { class: 'c-test' }, [
            el('div', { class: 'c-test-q' }, [
              el('span', { class: 'c-test-r', 'data-pass': String(c.pass) }, [el('span', { 'aria-hidden': 'true', text: c.pass ? '✓' : '✗' }), el('span', { class: 'c-sr', text: c.pass ? 'Passed: ' : 'Failed: ' })]),
              el('span', { text: c.q }),
            ]),
            el('div', { class: 'c-test-e', text: c.expect }),
            el('div', { class: 'c-test-a', text: c.answer || '(no answer)' }),
          ]),
        ),
      );
      list.hidden = false;
      $('[data-live-ev-none]')?.setAttribute('hidden', '');
    }
  }
  const side = $('[data-live-side]');
  if (side && (ax || lh?.mobile)) side.textContent = [ax ? `WCAG 2.2 AA ${ax.pass ? '✓' : '✗'}` : '', lh?.mobile ? `Lighthouse ${lh.mobile.performance}` : ''].filter(Boolean).join(' · ');
  if (oss) {
    const v: Record<string, string> = { prs: fmt(oss.prs), repos: fmt(oss.repos), since: String(oss.since) };
    if (oss.qtip) Object.assign(v, { stars: stars(oss.qtip.stars), forks: fmt(oss.qtip.forks), commits: fmt(oss.qtip.commits) });
    for (const n of $$('[data-oss]')) if (v[n.dataset.oss!]) n.textContent = v[n.dataset.oss!];
  }
}

let started = false;
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
function load() {
  if (started) return;
  started = true;
  io.disconnect();
  for (const t of EVENTS) removeEventListener(t, load, true);
  fetch('/live.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d && typeof d === 'object' && show(d as Live))
    .catch(() => {});
}
for (const t of EVENTS) addEventListener(t, load, { capture: true, passive: true });
const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && load(), { rootMargin: '600px 0px' });
for (const id of ['case-studies', 'oss', 'ask']) {
  const s = document.getElementById(id);
  if (s) io.observe(s);
}
