// Small DOM helpers shared by the page scripts.

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];

/** Whether motion is wanted: neither the system setting nor the site's "pause animations". */
export const motionOk = () =>
  document.documentElement.dataset.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Blocked storage: the choice lasts this visit.
    }
  },
};

/** Run once the page has loaded and gone quiet. */
export function whenIdle(fn: () => void) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1));
  if (document.readyState === 'complete') run();
  else addEventListener('load', run, { once: true });
}

/** An element: tag, attributes (class, text, on<event> handlers) and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined | ((e: Event) => void)> = {},
  kids: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'text') e.textContent = String(v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids);
  return e;
}

/** Cross-fade (or slide, for next/prev) a change with a view transition, where supported. */
export function transition(update: () => void, dir?: 'next' | 'prev') {
  if (!('startViewTransition' in document) || !motionOk()) {
    update();
    return;
  }
  const h = document.documentElement;
  if (dir) h.dataset.vtDir = dir;
  else delete h.dataset.vtDir;
  try {
    document.startViewTransition(update).finished.finally(() => delete h.dataset.vtDir);
  } catch {
    delete h.dataset.vtDir;
    update();
  }
}
