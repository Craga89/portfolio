// The stack search: typing filters the areas and tools, marks the match, and opens every area
// with one. Matching also uses each area's own words (src/data/stack.yaml).
import { $, $$, el } from './dom';

const box = $('[data-stack]');
if (box) {
  const input = $<HTMLInputElement>('[data-stack-q]', box)!;
  const count = $('[data-stack-count]', box)!;
  const none = $('[data-stack-none]', box)!;
  const rows = $$<HTMLDetailsElement>('details.row', box).map((row) => ({
    row,
    words: row.dataset.keywords ?? '',
    n: $('[data-stack-n]', row)!,
    preview: $('.tp', row)!,
    hits: $$('.hit', row).map((h) => ({ h, text: h.textContent! })),
    wasOpen: false,
  }));

  input.addEventListener('input', () => {
    const raw = input.value.trim();
    const q = raw.toLowerCase();
    let total = 0;
    for (const r of rows) {
      const area = r.words.includes(q);
      let n = 0;
      for (const { h, text } of r.hits) {
        const at = q ? text.toLowerCase().indexOf(q) : -1;
        const show = !q || area || at >= 0;
        h.hidden = !show;
        if (show) n++;
        h.replaceChildren(
          ...(at < 0
            ? [text]
            : [text.slice(0, at), el('mark', { text: text.slice(at, at + q.length) }), text.slice(at + q.length)]),
        );
      }
      total += n;
      r.row.hidden = n === 0;
      r.n.textContent = String(n);
      r.preview.textContent = r.hits
        .filter(({ h }) => !h.hidden)
        .map(({ text }) => text)
        .join(', ');
      if (q && !r.row.hidden) r.row.open = true;
      else if (!q) r.row.open = false;
    }
    count.textContent = q ? `${total} match${total === 1 ? '' : 'es'} for "${raw}"` : box.dataset.summary!;
    none.hidden = total > 0;
  });
}
