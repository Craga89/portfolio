// In-page links. The browser scrolls (smoothly, clear of the sticky header: see base.css); this
// flashes where they land, opens a disclosure that's linked to, and makes a section's # copy a
// link to it as well as going there.
import { $, $$ } from './dom';
import { copyText, flagDone } from './copy';
import { note } from './toast';

/** Briefly highlight an element (a section's heading row, for a section). */
export function flash(target: Element | null) {
  if (!target || target.id === 'top') return;
  const t = target.matches('section') ? (target.querySelector('.hrow') ?? target) : target;
  t.classList.remove('c-flash');
  void (t as HTMLElement).offsetWidth;
  t.classList.add('c-flash');
  setTimeout(() => t.classList.remove('c-flash'), 1600);
}

/** Scroll to an element by id, open it if it's a disclosure, move focus there, and flash it. */
export function goTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (target instanceof HTMLDetailsElement) target.open = true;
  target.scrollIntoView({ block: id === 'top' ? 'start' : target instanceof HTMLDetailsElement ? 'center' : 'start' });
  // Focus follows, so the next Tab carries on from here.
  const focusable = target instanceof HTMLDetailsElement ? target.querySelector('summary') : target;
  if (focusable) {
    if (!focusable.hasAttribute('tabindex') && focusable.tabIndex < 0) focusable.setAttribute('tabindex', '-1');
    focusable.focus({ preventScroll: true });
  }
  const done = () => flash(target);
  if ('onscrollend' in window) addEventListener('scrollend', done, { once: true });
  setTimeout(done, 700);
}

function landed() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  if (target instanceof HTMLDetailsElement) target.open = true;
  flash(target);
}
addEventListener('hashchange', landed);
if (location.hash) requestAnimationFrame(landed);

// A section heading's #: copy its address too.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a.c-anchor');
  if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = a.hash.slice(1);
  copyText(location.origin + location.pathname + '#' + id)
    .then(() => {
      flagDone(a, 1800);
      note(`Link to ${a.dataset.file ?? id} copied`);
    })
    .catch(() => {});
});

// The mobile menu (a <details>, so it works without script): close it after a jump, on Escape
// (focus back on its button), or on a tap outside it.
const menu = $<HTMLDetailsElement>('#v2-menu');
if (menu) {
  document.addEventListener(
    'click',
    (e) => {
      if (!menu.open) return;
      const t = e.target as Element;
      if (t.closest('#v2-menu nav a')) setTimeout(() => (menu.open = false), 0);
      else if (!menu.contains(t)) menu.open = false;
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
}

// The header's height, for scroll padding and sticky offsets (--hdr-h).
const hdr = $('#c-hdr');
if (hdr) {
  const set = () => document.documentElement.style.setProperty('--hdr-h', `${Math.ceil(hdr.getBoundingClientRect().height)}px`);
  set();
  new ResizeObserver(set).observe(hdr);
}

// Printing: open every FAQ answer, then close them again.
let opened: HTMLDetailsElement[] = [];
addEventListener('beforeprint', () => {
  opened = $$<HTMLDetailsElement>('#faq details:not([open])');
  for (const d of opened) d.open = true;
});
addEventListener('afterprint', () => {
  for (const d of opened) d.open = false;
  opened = [];
});
