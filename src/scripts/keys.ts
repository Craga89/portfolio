// Keyboard shortcuts on every page: Ctrl/⌘ K for search and jump; / and ? as single keys, which
// can be turned off (WCAG 2.1.4); the Konami code lights up the Tyne Bridge on the home page.
import { $, $$, store } from './dom';
import { note } from './toast';

const palette = () => import('./palette').then((m) => m.toggle());
const keysDialog = () => $<HTMLDialogElement>('#c-keys');
const singleKeys = () => store.get('keys') !== 'off';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];
let k = 0;

document.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  k = key === KONAMI[k] ? k + 1 : key === KONAMI[0] ? 1 : 0;
  if (k === KONAMI.length) {
    k = 0;
    dispatchEvent(new CustomEvent('craga:bridge'));
    return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && key === 'k') {
    e.preventDefault();
    palette();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || !singleKeys()) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if ($('dialog[open]')) return;
  if (e.key === '/') {
    e.preventDefault();
    palette();
  } else if (e.key === '?' && keysDialog()) {
    e.preventDefault();
    keysDialog()!.showModal();
  }
});

document.addEventListener('click', (e) => {
  const b = (e.target as Element).closest('[data-palette]');
  if (!b) return;
  // From the mobile menu: close it first.
  const menu = b.closest('details');
  if (menu) menu.open = false;
  palette();
});

// The shortcut key names this platform uses.
if (/mac|iphone|ipad/i.test(navigator.platform))
  for (const n of $$('[data-mod-key]')) n.textContent = n.textContent!.replace('Ctrl', '⌘').replace('⌘ K', '⌘K');

// The keyboard shortcuts dialog: the single-key switch, and a click on the backdrop closes it.
const d = keysDialog();
if (d) {
  const box = $<HTMLInputElement>('[data-keys-single]', d)!;
  box.checked = singleKeys();
  box.addEventListener('change', () => {
    store.set('keys', box.checked ? 'on' : 'off');
    note(box.checked ? 'Single-key shortcuts on' : 'Single-key shortcuts off');
  });
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
}
