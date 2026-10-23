// The explorer and the menu mark the section in view (aria-current). A click on one of them
// marks that one straight away, until the visitor scrolls themselves.
import { $$ } from './dom';

const links = $$<HTMLAnchorElement>('[data-spy]');
const ids = [...new Set(links.map((a) => a.dataset.spy!))];
const sections = ids.map((id) => [id, id === 'top' ? document.querySelector('section[aria-label="Introduction"]') : document.getElementById(id)] as const).filter((x): x is [string, Element] => !!x[1]);

let lock: string | null = null;
let raf = 0;
let current = '';

export const currentSection = () => current;

function pick() {
  raf = 0;
  let cur = 'top';
  if (lock) cur = lock;
  else {
    const line = Math.min(160, innerHeight * 0.3);
    for (const [id, el] of sections) if (id !== 'top' && el.getBoundingClientRect().top - line <= 0) cur = id;
    // At the very bottom, the last section counts even if it's short.
    const se = document.scrollingElement!;
    if (se.scrollHeight > innerHeight + 50 && se.scrollTop + innerHeight >= se.scrollHeight - 4) cur = sections.at(-1)![0];
  }
  if (cur === current) return;
  current = cur;
  for (const a of links) a.setAttribute('aria-current', String(a.dataset.spy === cur));
  dispatchEvent(new CustomEvent('craga:section', { detail: cur }));
}
const soon = () => {
  if (!raf) raf = requestAnimationFrame(pick);
};

if (sections.length) {
  addEventListener('scroll', soon, { passive: true, capture: true });
  addEventListener('resize', soon);
  for (const t of ['wheel', 'touchstart', 'keydown']) {
    addEventListener(
      t,
      () => {
        if (lock) {
          lock = null;
          soon();
        }
      },
      { passive: true },
    );
  }
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-spy]');
      if (!a) return;
      lock = a.dataset.spy!;
      soon();
    },
    true,
  );
  soon();
}
