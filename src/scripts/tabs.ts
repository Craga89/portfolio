// Tab sets: the case studies (vertical tabs) and the responsibilities tour (one tab per file).
// One panel shows at a time; arrow keys move along the tabs (APG tabs pattern), and the "on its
// own page" link follows the open file.
import { $, $$, transition } from './dom';

export class Tabs {
  readonly tabs: HTMLElement[];
  private readonly onChange?: (i: number) => void;

  constructor(
    readonly root: HTMLElement,
    opts: { onChange?: (i: number) => void; perma?: HTMLAnchorElement | null } = {},
  ) {
    this.tabs = $$('[role="tab"]', root);
    this.onChange = (i) => {
      const perma = opts.perma;
      if (perma) {
        perma.href = this.tabs[i].dataset.page!;
        perma.firstChild!.textContent = `${this.tabs[i].getAttribute('aria-label') ?? this.tabs[i].textContent!.trim()} on its own page `;
      }
      opts.onChange?.(i);
    };
    const vertical = $('[role="tablist"]', root)?.getAttribute('aria-orientation') === 'vertical';
    root.addEventListener('click', (e) => {
      const t = (e.target as Element).closest<HTMLElement>('[role="tab"]');
      if (t && this.tabs.includes(t)) transition(() => this.select(this.tabs.indexOf(t)));
    });
    $('[role="tablist"]', root)?.addEventListener('keydown', (e) => {
      const rtl = document.documentElement.dir === 'rtl';
      const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
      const prev = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
      const i = this.index;
      const to =
        e.key === next
          ? i + 1
          : e.key === prev
            ? i - 1
            : e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? this.tabs.length - 1
                : null;
      if (to === null) return;
      e.preventDefault();
      transition(() => this.select((to + this.tabs.length) % this.tabs.length));
      this.tabs[this.index].focus();
    });
  }

  get index() {
    return Math.max(
      0,
      this.tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
    );
  }

  /** The tab whose panel has this id suffix (a file's short id: mono, lead…). */
  find(id: string) {
    return this.tabs.findIndex((t) => t.getAttribute('aria-controls')?.endsWith('-' + id));
  }

  select(i: number) {
    this.tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls')!);
      if (panel) panel.hidden = !on;
    });
    this.onChange?.(i);
  }

  step(by: number, dir = true) {
    const go = () => this.select((this.index + by + this.tabs.length) % this.tabs.length);
    if (dir) transition(go, by > 0 ? 'next' : 'prev');
    else go();
  }
}

/** Horizontal swipes on a touch screen step through the panels; vertical scrolling is left alone. */
export function swipe(area: HTMLElement | null, step: (by: number) => void) {
  if (!area) return;
  const scrollsX = (n: Element | null) => {
    for (; n && n !== area; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  let x0 = 0,
    y0 = 0,
    t0 = 0,
    id: number | null = null;
  area.addEventListener('pointerdown', (e) => {
    id = e.pointerType === 'touch' && !scrollsX(e.target as Element) ? e.pointerId : null;
    x0 = e.clientX;
    y0 = e.clientY;
    t0 = Date.now();
  });
  area.addEventListener('pointercancel', () => (id = null));
  area.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - t0 > 900) return;
    // Swiping towards the start of the line moves on.
    step(dx < 0 !== (document.documentElement.dir === 'rtl') ? 1 : -1);
  });
}
