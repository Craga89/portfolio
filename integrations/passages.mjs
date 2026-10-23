// What ask.sh searches: the home page's content as short passages, read from the built page in a
// browser. Both functions run in the page (so they must not use anything from outside themselves).

/** @typedef {{ id: string, title: string, text: string, href: string, kind: string, key: string }} Passage */

/** The home page, one passage per section, role, file and FAQ answer. @returns {Passage[]} */
export function homePassages() {
  const clean = (/** @type {string} */ t) =>
    String(t || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?)])/g, '$1')
      .trim();
  const INLINE = new Set(['a', 'b', 'strong', 'em', 'i', 'code', 'mark', 'small', 'abbr', 'sup', 'sub', 'u', 'span', 'kbd', 'time']);
  const SKIP = new Set(['script', 'style', 'svg', 'canvas', 'input', 'template', 'select']);
  /** Text with a space between block-level pieces, so words don't run together. @param {Node | null} n @returns {string} */
  const txt = (n) => {
    if (!n) return '';
    if (n.nodeType === 3) return /** @type {Text} */ (n).data;
    if (n.nodeType !== 1) return '';
    const e = /** @type {Element} */ (n);
    // Controls aren't content, but a jargon term (a button that opens its definition) is.
    if (SKIP.has(e.localName) || e.matches('[aria-hidden="true"], .c-sr, .print-only, button:not(.c-term)')) return '';
    let out = '';
    for (const c of e.childNodes) out += txt(c);
    return INLINE.has(e.localName) ? out : ' ' + out + ' ';
  };
  /** @type {Passage[]} */
  const out = [];
  const add = (/** @type {string} */ id, /** @type {string} */ title, /** @type {string} */ text, /** @type {string} */ href, kind = 'link', key = '') => {
    // Drop the terminal decoration ($ cat file.txt, # comments, → bullets) so passages read as prose.
    text = clean(
      String(text || '')
        .replace(/\$ (?:cat|ls|grep -ri|git log|\.\/[\w.-]+)(?: [^\s#]+)?/g, ' ')
        .replace(/(^|\s)# [a-z][\w ./-]*?(?=\s{2}|\s[A-Z0-9→$]|$)/g, ' ')
        .replace(/\s*→\s*/g, '; ')
        .replace(/^[;\s]+/, ''),
    );
    if (text.length > 1800) text = text.slice(0, 1800).replace(/\s\S*$/, '') + '…';
    if (text) out.push({ id, title: clean(title), text, href, kind, key });
  };
  const q = (/** @type {string} */ sel, /** @type {ParentNode} */ root = document) => root.querySelector(sel);
  const qa = (/** @type {string} */ sel, /** @type {ParentNode} */ root = document) => [...root.querySelectorAll(sel)];

  const intro = q('section[aria-label="Introduction"]');
  if (intro) add('intro', 'About Craig', [q('h1', intro), q('.st', intro), q('#about', intro)].map(txt).join(' '), '#top');
  const id = q('.side .id');
  if (id) add('profile', 'Profile', txt(id) + '. Contact: craga89@gmail.com, github.com/Craga89, linkedin.com/in/craigmichaelthompson.', '#top');
  qa('#career article.job').forEach((a, i) => {
    const h = q('h3', a);
    add('career-' + (i + 1), h ? txt(h) : a.getAttribute('aria-label') || 'Career', txt(a), '#career');
  });
  for (const [sel, kind, section, prefix] of /** @type {const} */ ([
    ['#responsibilities [role="tabpanel"][id^="rp-"]', 'resp', '#responsibilities', 'resp-'],
    ['#case-studies [role="tabpanel"][id^="cp-"]', 'case', '#case-studies', 'case-'],
  ]))
    for (const p of qa(sel)) {
      const key = p.id.slice(3);
      const h = q('h3', p);
      // A responsibility's text starts at its summary: its title and position are in the passage's title.
      const body = /** @type {Element} */ (p.cloneNode(true));
      if (kind === 'resp') body.querySelectorAll('.top, .kicker, h3, summary').forEach((n) => n.remove());
      add(prefix + key, (p.getAttribute('aria-label') || key) + (h ? ': ' + clean(txt(h)) : ''), txt(body), section, kind, key);
    }
  const rows = qa('#stack details.row').map((r) => clean(txt(q('.tg', r))) + ' ' + qa('.chips li', r).map((li) => clean(txt(li))).join(', '));
  if (rows.length) add('stack', 'Skills and tools (stack)', rows.join('. '), '#stack');
  for (const [sec, title] of [
    ['oss', 'Open source'],
    ['recommendations', 'Recommendations'],
  ]) {
    const n = q('#' + sec);
    // Recognition and education sit inside the recommendations section; they get their own passage.
    const c = /** @type {Element | undefined} */ (n?.cloneNode(true));
    c?.querySelector('section[aria-labelledby="c-awards"]')?.remove();
    if (c) add(sec, title, txt(c), '#' + sec);
  }
  const aw = q('section[aria-labelledby="c-awards"]');
  if (aw)
    add(
      'recognition',
      'Recognition and education',
      clean(txt(aw))
        .replace(/\$ cat recognition\.txt\s*;?\s*/, 'Recognition: ')
        .replace(/\s*\$ cat education\.txt\s*(# education)?\s*/, '. Education: '),
      '#recommendations',
    );
  qa('#faq details').forEach((d, i) => {
    const sum = q('summary', d);
    // The question is the title; the text is just the answer, so it isn't read back to the visitor.
    const answer = [...d.childNodes].filter((n) => n !== sum).map(txt).join(' ');
    add('faq-' + (i + 1), 'FAQ: ' + (sum ? clean(txt(sum)) : ''), answer, '#faq');
  });
  return out;
}

/** A blog post, briefly: what it's about and where to read it. @returns {Passage} */
export function postPassage() {
  const clean = (/** @type {string} */ t) => t.replace(/\s+/g, ' ').trim();
  const slug = location.pathname.split('/').filter(Boolean).pop() || '';
  const title = clean(document.querySelector('.post h1')?.textContent || slug);
  const date = document.querySelector('.post time')?.getAttribute('datetime') || '';
  const tags = [...document.querySelectorAll('.post .tags li')].map((li) => clean(li.textContent || ''));
  const body = /** @type {Element} */ (document.querySelector('.post .b')?.cloneNode(true));
  body?.querySelectorAll('pre, img, figure').forEach((n) => n.remove());
  const text = `A post Craig wrote on his old blog (craigsworks.com) on ${date}${tags.length ? `, about ${tags.join(', ')}` : ''}. ${clean(body?.textContent || '')}`;
  return {
    id: 'blog-' + slug,
    title: `${slug}.md: ${title} (blog post, ${date.slice(0, 4)})`,
    text: text.length > 1200 ? text.slice(0, 1200).replace(/\s\S*$/, '') + '…' : text,
    href: 'blog/' + slug + '/',
    kind: 'blog',
    key: slug,
  };
}
