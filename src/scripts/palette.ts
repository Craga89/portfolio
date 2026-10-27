// Search and jump: filters /palette.json as you type, best match first, with "ask ask.sh" last.
// Loaded on first use (scripts/keys.ts).
import { movesPage } from './commands';
import { $, el } from './dom';
import { navigate } from './navigate';
import { copyText } from './copy';
import { note } from './toast';
import { theme, toggleTheme } from './theme';
import { motionOff, toggleMotion } from './motion';
import { EMAIL } from '../site';
import type { PaletteItem } from '../lib/palette';

const dialog = $<HTMLDialogElement>('#c-pal')!;
const field = $<HTMLInputElement>('#c-pal-field', dialog)!;
const list = $('#c-pal-list', dialog)!;
const count = $('[data-pal-count]', dialog);

let items: PaletteItem[] = [];
let shown: PaletteItem[] = [];
let index = 0;

const loaded = (async () => {
  try {
    const r = await fetch('/palette.json');
    const d: PaletteItem[] = r.ok ? await r.json() : [];
    items = d.filter((o) => o.action !== 'share' || typeof navigator.share === 'function');
  } catch {
    // Offline before it was cached: the palette still offers ask.sh.
  }
})();

/** The theme and motion items say what they'll do now. */
const label = (o: PaletteItem) =>
  o.action === 'theme'
    ? `Switch to ${theme() === 'light' ? 'dark' : 'light'} theme`
    : o.action === 'motion'
      ? motionOff()
        ? 'Play animations'
        : 'Pause animations'
      : o.label;

function search(q: string): PaletteItem[] {
  const ql = q.trim().toLowerCase();
  const words = ql.split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const found = items
    .map((o, i) => {
      const l = label(o).toLowerCase();
      if (!words.every((w) => `${l} ${o.kind} ${o.kw ?? ''}`.toLowerCase().includes(w))) return null;
      const score = l.startsWith(ql)
        ? 4
        : l.split(/[\s/.(]+/).some((w) => w.startsWith(ql))
          ? 3
          : l.includes(ql)
            ? 2
            : 1;
      return { o, i, score };
    })
    .filter((x) => x !== null)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.o);
  return [
    ...found,
    {
      icon: '$',
      label: `Ask ask.sh: “${q.trim()}”`,
      kind: 'ask',
      path: `/?ask=${encodeURIComponent(q.trim())}${movesPage(q) ? '' : '#ask'}`,
    },
  ];
}

function marked(text: string, q: string): (Node | string)[] {
  const ql = q.trim().toLowerCase();
  const at = ql ? text.toLowerCase().indexOf(ql) : -1;
  if (at < 0) return [text];
  return [text.slice(0, at), el('mark', { text: text.slice(at, at + ql.length) }), text.slice(at + ql.length)];
}

function render() {
  shown = search(field.value);
  index = Math.min(index, Math.max(0, shown.length - 1));
  list.replaceChildren(
    ...shown.map((o, i) =>
      el(
        'li',
        { id: `c-pal-o${i}`, role: 'option', class: 'o', 'aria-selected': String(i === index), onclick: () => run(o) },
        [
          el('span', { class: 'i', 'aria-hidden': 'true', text: o.icon }),
          el('span', { class: 'l' }, marked(label(o), field.value)),
          el('span', { class: 'k', text: o.kind }),
        ],
      ),
    ),
  );
  field.setAttribute('aria-activedescendant', shown.length ? `c-pal-o${index}` : '');
  if (count)
    count.textContent = field.value.trim() ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : '';
}

function run(o: PaletteItem | undefined) {
  if (!o) return;
  dialog.close();
  switch (o.action) {
    case 'email':
      copyText(EMAIL)
        .then(() => note('Email address copied', { show: true }))
        .catch(() => (location.href = 'mailto:' + EMAIL));
      return;
    case 'theme':
      return toggleTheme();
    case 'motion':
      return toggleMotion();
    case 'keys':
      return $<HTMLDialogElement>('#c-keys')?.showModal();
    case 'share':
      navigator.share({ title: document.title, url: location.origin + location.pathname }).catch(() => {});
      return;
  }
  const to = o.page && location.pathname !== '/' ? o.page : o.path;
  if (to) navigate(to);
}

field.addEventListener('input', () => {
  index = 0;
  render();
});
field.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!shown.length) return;
    index = (index + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
    render();
    document.getElementById(`c-pal-o${index}`)?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    run(shown[index]);
  }
});
// A click on the backdrop closes it.
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

/** Open it, or close it if it's open. */
export async function toggle() {
  if (dialog.open) {
    dialog.close();
    return;
  }
  field.value = '';
  index = 0;
  dialog.showModal();
  field.focus();
  await loaded;
  render();
}
