// The home page's own links: /?case=<id> and /?resp=<id> open that file, /?focus=<view> adds a
// suggested reading order, /?ask=<question> asks ask.sh, and #<id> goes to a section. Links to a
// file's own page (data-open) open it here instead, and so does search and jump (craga:go).
import { $, $$ } from './dom';
import { goTo } from './anchors';
import { cases } from './cases';
import { tour, holdTour } from './deck';
import { movesPage } from './commands';
import { ask as askSh } from './ask';

function open(kind: string, id: string, scroll = true) {
  if (kind === 'case' && cases) {
    const i = cases.find(id);
    if (i < 0) return false;
    cases.select(i);
    if (scroll) goTo('case-studies');
    return true;
  }
  if (kind === 'resp' && tour) {
    const i = tour.find(id);
    if (i < 0) return false;
    holdTour();
    tour.select(i);
    if (scroll) goTo('responsibilities');
    return true;
  }
  return false;
}

function focusView(key: string | null) {
  let shown: HTMLElement | null = null;
  for (const v of $$('[data-focus]')) {
    v.hidden = v.dataset.focus !== key;
    if (!v.hidden) shown = v;
  }
  return shown;
}

/** Apply a home page address; true if it was handled here. */
function apply(u: URL, initial = false): boolean {
  const q = u.searchParams;
  let handled = false;
  const f = q.get('focus');
  const view = f ? focusView(f) : null;
  if (view) {
    // The view opens its first files' tabs too.
    const first = (kind: string) => $<HTMLAnchorElement>(`a[data-open^="${kind}/"]`, view)?.dataset.open!.split('/')[1];
    const c = first('case');
    const r = first('resp');
    if (c) open('case', c, false);
    if (r) open('resp', r, false);
    handled = true;
  }
  for (const kind of ['case', 'resp'] as const) {
    const id = q.get(kind);
    if (id && open(kind, id, false)) handled = true;
  }
  const ask = q.get('ask');
  if (ask) {
    void askSh(ask.slice(0, 300));
    handled = true;
  }
  // Asking goes to the answer, unless the command goes somewhere itself (search and jump's
  // "Ask ask.sh: bridge" would otherwise scroll down to ask.sh, then back up to the bridge).
  const hash = ask && movesPage(ask) ? '' : decodeURIComponent(u.hash.slice(1)) || (ask ? 'ask' : '');
  if (!initial) {
    if (hash) goTo(hash);
    else if (view) goTo('top');
    handled ||= !!hash || u.pathname === location.pathname;
  } else if (hash && handled) requestAnimationFrame(() => goTo(hash));
  if (!initial) history.replaceState(null, '', u.pathname + u.search + u.hash);
  return handled;
}

apply(new URL(location.href), true);

addEventListener('craga:go', (e) => {
  if (apply((e as CustomEvent<URL>).detail)) e.preventDefault();
});

// "show everything" clears the reading order.
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-focus-clear]')) {
    focusView(null);
    const u = new URL(location.href);
    u.searchParams.delete('focus');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
});

// A link to a file's own page opens it on this page instead.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-open]');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const [kind, id] = a.dataset.open!.split('/');
  if (open(kind, id)) e.preventDefault();
});
