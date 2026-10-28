// Dark and light: the visitor's choice, saved, or else their system's. The boot script in the head
// (inline.mjs) sets it before the page paints; this switches it.
import { $$, store, transition } from './dom';
import { note } from './toast';

export const theme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function setTheme(t: 'dark' | 'light') {
  const h = document.documentElement;
  // One cross-fade of the whole page, so every colour changes together.
  h.dataset.vtTheme = '';
  transition(() => {
    h.dataset.theme = t;
  });
  setTimeout(() => delete h.dataset.vtTheme, 600);
  store.set('theme', t);
  for (const m of $$<HTMLMetaElement>('meta[name="theme-color"]')) m.content = m.dataset[t] ?? m.content;
  // The favicon in the theme's colours (favicon-dark.svg or favicon-light.svg).
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = icon.href.replace(/favicon(-dark|-light)?\.svg/, `favicon-${t}.svg`);
  note(t === 'light' ? 'Light theme' : 'Dark theme');
}

export const toggleTheme = () => setTheme(theme() === 'light' ? 'dark' : 'light');

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-theme-toggle]')) toggleTheme();
});

// Following the system, until the visitor picks one.
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  if (!store.get('theme')) document.documentElement.dataset.theme = e.matches ? 'light' : 'dark';
});
