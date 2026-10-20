// The search-and-jump palette (Ctrl/⌘+K, or /) on the pages other than the home page: the file
// pages, the blog and the CV. The home page has its own, built into the page. This module loads
// only when someone asks for it; the build fills in ITEMS and serves it from /assets/.

/**
 * @typedef {{ icon: string, label: string, kind: string, path?: string, action?: 'email' | 'theme', kw?: string }} Item
 * `path` is relative to the site's root.
 */

/** @type {Item[]} */
const ITEMS = /*ITEMS*/ [];

const EMAIL = 'craga89@gmail.com';
/** Links are relative to this module (in /assets/), so they work wherever the site is served. */
const url = (/** @type {string} */ path) => new URL('../' + path, import.meta.url).href;

// Its own styles, so it looks right on any page. The colours come from the page's theme: the
// portfolio's tokens, or the plain CV's.
const CSS = `
.c-pal{--p-bg:var(--panel,var(--cv-page,#fff));--p-bg2:var(--panel2,var(--cv-call,#f4f4f2));--p-line:var(--line3,var(--cv-rule,#ccc));--p-line2:var(--line2,var(--cv-rule,#ddd));
--p-text:var(--text2,var(--cv-ink,#111));--p-head:var(--head,var(--cv-ink,#000));--p-dim:var(--dim,var(--cv-mute,#555));--p-acc:var(--acc,var(--cv-acc,#8a4b00));--p-acc-bg:var(--acc-bg,var(--cv-call,#f6f1e8));
--p-mono:var(--f-mono,ui-monospace,Menlo,monospace);
box-sizing:border-box;width:min(580px,calc(100vw - 24px));max-height:min(560px,calc(100dvh - 48px));margin:min(14vh,120px) auto auto;padding:0;
border:1px solid var(--p-line);border-radius:12px;background:var(--p-bg);color:var(--p-text);font-family:var(--f-body,system-ui,sans-serif);
box-shadow:0 24px 60px -20px rgba(0,0,0,.6);overflow:hidden}
.c-pal[open]{display:flex;flex-direction:column}
.c-pal::backdrop{background:rgba(8,14,11,.5);backdrop-filter:blur(3px)}
.c-pal .c-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.c-pal-in{display:flex;align-items:center;gap:10px;padding:6px 14px;border-bottom:1px solid var(--p-line2);color:var(--p-dim)}
.c-pal-in:focus-within{box-shadow:inset 0 -2px 0 var(--p-acc)}
.c-pal-in svg{display:block}
.c-pal-field{all:unset;box-sizing:border-box;flex:1;min-width:0;min-height:48px;font-family:var(--p-mono);font-size:16px;color:var(--p-head);caret-color:var(--p-acc)}
.c-pal-field::placeholder{color:var(--p-dim)}
.c-pal-list{list-style:none;margin:0;padding:6px;overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0}
.c-pal-o{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:42px;padding:0 10px;border-radius:7px;cursor:pointer;font-size:14.5px}
.c-pal-o:hover{background:var(--p-bg2)}
.c-pal-o[aria-selected="true"]{background:var(--p-acc-bg);color:var(--p-head);box-shadow:inset 2px 0 0 var(--p-acc)}
.c-pal-i{font-family:var(--p-mono);font-size:13px;color:var(--p-dim);text-align:center}
.c-pal-o[aria-selected="true"] .c-pal-i{color:var(--p-acc)}
.c-pal-l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-pal-l mark{background:none;color:var(--p-acc);font-weight:700}
.c-pal-k{font-family:var(--p-mono);font-size:11.5px;color:var(--p-dim)}
.c-pal-foot{display:flex;flex-wrap:wrap;gap:6px 16px;padding:10px 14px;border-top:1px solid var(--p-line2);background:var(--p-bg2);font-size:12px;color:var(--p-dim)}
.c-pal-foot kbd{display:inline-block;min-width:1.5em;padding:0 4px;margin-inline-end:2px;border:1px solid var(--p-line);border-bottom-width:2px;border-radius:4px;font-family:var(--p-mono);font-size:.85em;text-align:center}
@media (forced-colors:active){.c-pal{border:1px solid CanvasText}.c-pal-o[aria-selected="true"]{forced-color-adjust:none;background:Highlight;color:HighlightText}}
@media (prefers-reduced-motion:no-preference){.c-pal[open]{animation:c-pal-in .16s ease both}@keyframes c-pal-in{from{opacity:0;transform:translateY(-8px) scale(.985)}}}
`;

/** @type {HTMLDialogElement | null} */
let dialog = null;
let index = 0;
/** @type {Item[]} */
let shown = [];

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {(Node | string)[]} [kids]
 */
function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

/** Items matching the query, best first, with "ask ask.sh" last. @param {string} q */
function search(q) {
  const ql = q.trim().toLowerCase();
  const words = ql.split(/\s+/).filter(Boolean);
  if (!words.length) return ITEMS;
  const found = ITEMS.map((o, i) => {
    const kw = (o.label + ' ' + o.kind + ' ' + (o.kw || '')).toLowerCase();
    if (!words.every((w) => kw.includes(w))) return null;
    const l = o.label.toLowerCase();
    const score = l.startsWith(ql) ? 4 : l.split(/[\s/.(]+/).some((w) => w.startsWith(ql)) ? 3 : l.includes(ql) ? 2 : 1;
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
      path: '?ask=' + encodeURIComponent(q.trim()) + '#ask',
    },
  ];
}

/** The label with the matched part marked. @param {string} label @param {string} q */
function marked(label, q) {
  const ql = q.trim().toLowerCase();
  const at = ql ? label.toLowerCase().indexOf(ql) : -1;
  if (at < 0) return [label];
  return [label.slice(0, at), el('mark', {}, [label.slice(at, at + ql.length)]), label.slice(at + ql.length)];
}

function render() {
  if (!dialog) return;
  const field = /** @type {HTMLInputElement} */ (dialog.querySelector('.c-pal-field'));
  const list = /** @type {HTMLElement} */ (dialog.querySelector('.c-pal-list'));
  shown = search(field.value);
  index = Math.min(index, Math.max(0, shown.length - 1));
  list.replaceChildren(
    ...shown.map((o, i) => {
      const li = el(
        'li',
        { id: 'c-pal-o' + i, role: 'option', class: 'c-pal-o', 'aria-selected': String(i === index) },
        [
          el('span', { class: 'c-pal-i', 'aria-hidden': 'true' }, [o.icon]),
          el('span', { class: 'c-pal-l' }, marked(o.label, field.value)),
          el('span', { class: 'c-pal-k' }, [o.kind]),
        ],
      );
      li.addEventListener('click', () => run(o));
      return li;
    }),
  );
  field.setAttribute('aria-activedescendant', shown.length ? 'c-pal-o' + index : '');
}

/** @param {Item | undefined} o */
function run(o) {
  if (!o) return;
  dialog?.close();
  if (o.path != null) location.href = url(o.path);
  else if (o.action === 'email') navigator.clipboard.writeText(EMAIL).catch(() => (location.href = 'mailto:' + EMAIL));
  else if (o.action === 'theme')
    /** @type {HTMLElement | null} */ (document.querySelector('#sp-theme, .v-theme'))?.click();
}

function build() {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const field = el('input', {
    class: 'c-pal-field',
    type: 'text',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': 'c-pal-list',
    'aria-autocomplete': 'list',
    'aria-label': 'Search sections, files and actions',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Jump to a section or file, or ask a question…',
  });
  const icon = el('span', { 'aria-hidden': 'true' });
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';
  const d = /** @type {HTMLDialogElement} */ (
    el('dialog', { id: 'c-pal', class: 'c-pal', 'aria-labelledby': 'c-pal-t' }, [
      el('h2', { id: 'c-pal-t', class: 'c-sr' }, ['Search and jump']),
      el('div', { class: 'c-pal-in' }, [icon, field]),
      el('ul', { id: 'c-pal-list', class: 'c-pal-list', role: 'listbox', 'aria-label': 'Results' }),
      el('div', { class: 'c-pal-foot', 'aria-hidden': 'true' }, [
        el('span', {}, [el('kbd', {}, ['↑']), el('kbd', {}, ['↓']), ' move']),
        el('span', {}, [el('kbd', {}, ['↵']), ' open']),
        el('span', {}, [el('kbd', {}, ['esc']), ' close']),
      ]),
    ])
  );
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
      document.getElementById('c-pal-o' + index)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(shown[index]);
    }
  });
  // A click on the backdrop closes it.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  (document.querySelector('.c-root') || document.body).append(d);
  return d;
}

/** Open the palette, or close it if it's open. */
export function toggle() {
  dialog ??= build();
  if (dialog.open) {
    dialog.close();
    return;
  }
  const field = /** @type {HTMLInputElement} */ (dialog.querySelector('.c-pal-field'));
  field.value = '';
  index = 0;
  render();
  dialog.showModal();
  field.focus();
}
