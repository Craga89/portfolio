// ask.sh, in the section and the chat (one conversation, shown in both). A question goes to the
// Worker, which answers with an AI model from this site's content; if it can't (offline, over
// the day's free allowance), the closest passage from the site's own search index answers
// instead. A few shell commands are answered here. Answers can be shared, read aloud, and the
// question dictated.
import { $, $$, el } from './dom';
import { copyText } from './copy';
import { note } from './toast';
import { speak, stopSpeaking, speaking } from './speak';
import { dictate, canDictate } from './dictate';
import { shell, isShell } from './shell';
import { prepareIndex, bestAnswer } from '../../shared/agent-tools.js';
import { ASK_ENDPOINT } from '../site';

type Passage = { id: string; kind: string; key?: string; title: string; text: string; href: string };
type Index = { passages: Passage[]; byId: Record<string, Passage> };
type Mode = 'ai' | 'search' | 'shell' | 'error';
interface Entry {
  q: string;
  pending: boolean;
  shell: boolean;
  answer?: string;
  sources?: Passage[];
  mode?: Mode;
  note?: string;
  /** The question's language, when it wasn't English and the answer was translated back. */
  lang?: string;
  answerEn?: string;
}

const ASK_LOG = $('[data-ask-log]');
const CHAT_LOG = $('[data-chat-log]');
const INDEX_URL = '/assets/ask-index.json';

let log: Entry[] = [];
let busy = false;

// ---------- the site's search index, and the file names answers can link ----------

let indexP: Promise<Index> | null = null;
let links: { map: Record<string, { href: string; open?: string }>; re: RegExp } | null = null;

export function askIndex(): Promise<Index> {
  indexP ??= fetch(INDEX_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index ${r.status}`))))
    .then((raw) => {
      const d = prepareIndex(raw) as unknown as Index;
      const map: Record<string, { href: string; open?: string }> = {
        'readme.md': { href: '/#top' },
        whoami: { href: '/#top' },
        'career.log': { href: '/#career' },
        'responsibilities/': { href: '/#responsibilities' },
        'case-studies/': { href: '/#case-studies' },
        'faq.md': { href: '/#faq' },
        'recommendations.txt': { href: '/#recommendations' },
        'craigthompson.dev/cv': { href: '/cv/' },
        'stack/': { href: '/#stack' },
        'open-source/': { href: '/#oss' },
        'blog/': { href: '/#blog' },
        'ask.sh': { href: '/#ask' },
        'cv.json': { href: '/cv.json' },
        'cv.pdf': { href: '/cv.pdf' },
        'contact.vcf': { href: '/craig-thompson.vcf' },
      };
      for (const p of d.passages) {
        const target = {
          href: p.href,
          open: (p.kind === 'resp' || p.kind === 'case') && p.key ? `${p.kind}/${p.key}` : undefined,
        };
        const f = String(p.title).split(':')[0].trim().toLowerCase();
        if (target.open && /^[\w/-]+\.\w+$/.test(f)) map[f] = target;
        // In case an answer cites a passage id (faq-1.md, resp-bud) instead of its file.
        if (p.id.indexOf('-') > 0) map[p.id] = map[p.id + '.md'] = target;
      }
      const keys = Object.keys(map)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
      links = {
        map,
        re: new RegExp(`(?<![\\w./-])(?:${keys.join('|')})(?![\\w/-])|[\\w.+-]+@[\\w-]+\\.[\\w.]+[a-z]`, 'gi'),
      };
      return d;
    });
  indexP.catch(() => (indexP = null));
  return indexP;
}

/** A line of an answer, with file names and email addresses as links. */
function linked(text: string): (Node | string)[] {
  if (!links) return [text];
  const out: (Node | string)[] = [];
  let last = 0;
  text.replace(links.re, (m, at: number) => {
    const L = links!.map[m.toLowerCase()] ?? (m.includes('@') ? { href: 'mailto:' + m } : null);
    if (!L) return m;
    if (at > last) out.push(text.slice(last, at));
    out.push(el('a', { class: 'c-ask-ln', href: L.href, 'data-open': L.open, translate: 'no', text: m }));
    last = at + m.length;
    return m;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ---------- rendering, in both places ----------

const lines = (e: Entry) =>
  String(e.answer ?? '')
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const li = /^[-•*]\s+/.test(t);
      return el(
        'p',
        { class: li ? 'c-ask-li' : undefined, lang: e.lang, translate: e.lang ? 'no' : undefined },
        linked(li ? t.replace(/^[-•*]\s+/, '') : t),
      );
    });

function extras(e: Entry, i: number, short: boolean): Node[] {
  const out: Node[] = [];
  const meta = short
    ? (e.mode === 'ai'
        ? 'AI answer from this site · can be wrong'
        : e.mode === 'search'
          ? e.note
            ? 'AI unavailable · closest match'
            : 'Closest match from the site'
          : '') + (e.lang && e.answerEn ? ' · machine-translated' : '')
    : (e.mode === 'ai'
        ? 'Answered by an AI model using only this site. It can get things wrong, so check the linked sections.'
        : e.mode === 'search'
          ? e.note || 'Closest match from the site.'
          : '') + (e.lang && e.answerEn ? ' Machine-translated from English by your browser.' : '');
  const m = el('div', { class: short ? 'c-chat-meta' : 'c-ask-meta', text: meta });
  if (!e.shell && (e.mode === 'ai' || e.mode === 'search'))
    m.append(el('button', { type: 'button', class: 'c-ask-share', 'data-ask-share': String(i), text: 'copy link' }));
  if (!e.shell && e.answer && e.mode !== 'error') {
    const on = speaking() === i;
    m.append(
      el('button', { type: 'button', class: 'c-ask-share', 'data-ask-say': String(i), 'data-on': String(on) }, [
        sayIcon(),
        on ? 'stop' : 'listen',
        el('span', { class: 'c-sr', text: on ? ' reading this answer' : ' to this answer' }),
      ]),
    );
  }
  out.push(m);
  return out;
}

function sayIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', '13');
  s.setAttribute('height', '13');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2.2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML =
    '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
  return s;
}

const sourceLink = (s: Passage, short: boolean) =>
  el('a', {
    href: s.href,
    'data-open': (s.kind === 'resp' || s.kind === 'case') && s.key ? `${s.kind}/${s.key}` : undefined,
    title: short ? s.title : undefined,
    text: short && (s.kind === 'resp' || s.kind === 'case') ? String(s.title).split(':')[0] : s.title,
  });

function renderAsk() {
  if (!ASK_LOG) return;
  $('[data-ask-hint]', ASK_LOG)!.hidden = log.length > 0;
  $$('.c-ask-turn', ASK_LOG).forEach((n) => n.remove());
  log.forEach((e, i) => {
    const turn = el('div', { class: 'c-ask-turn' }, [
      el('div', { class: 'c-ask-q', translate: 'no' }, [
        el('span', { class: 'c-ask-p', text: '$' }),
        ' ' + (e.shell ? e.q : `./ask.sh "${e.q}"`),
      ]),
    ]);
    if (e.pending)
      turn.append(
        el('div', { class: 'c-ask-a c-ask-wait' }, [
          'thinking',
          el('span', { class: 'c-cursor', 'aria-hidden': 'true' }),
        ]),
      );
    else {
      const a = el('div', { class: 'c-ask-a', dir: 'auto', 'data-i': String(i) }, lines(e));
      if (e.sources?.length)
        a.append(
          el('div', { class: 'c-ask-src' }, [
            el('span', { text: '# sources' }),
            ...e.sources.map((s) => sourceLink(s, false)),
          ]),
        );
      a.append(...extras(e, i, false));
      turn.append(a);
    }
    ASK_LOG.append(turn);
  });
}

function renderChat() {
  if (!CHAT_LOG) return;
  $$('.c-chat-turn', CHAT_LOG).forEach((n) => n.remove());
  $('[data-chat-sugg]', CHAT_LOG)!.hidden = log.length > 0;
  for (const [i, e] of log.entries()) {
    CHAT_LOG.append(
      el('div', { class: 'c-chat-msg c-chat-me c-chat-turn', dir: 'auto', translate: 'no' }, [el('p', { text: e.q })]),
    );
    if (e.pending)
      CHAT_LOG.append(
        el(
          'div',
          { class: 'c-chat-msg c-chat-them c-chat-typing c-chat-turn', role: 'status', 'aria-label': 'Thinking' },
          [el('i'), el('i'), el('i')],
        ),
      );
    else {
      const m = el('div', { class: 'c-chat-msg c-chat-them c-chat-turn', dir: 'auto' }, lines(e));
      if (e.sources?.length)
        m.append(
          el(
            'div',
            { class: 'c-chat-src' },
            e.sources.map((s) => sourceLink(s, true)),
          ),
        );
      m.append(...extras(e, i, true));
      CHAT_LOG.append(m);
    }
  }
}

function render() {
  renderAsk();
  renderChat();
  for (const b of $$<HTMLButtonElement>(
    '[data-ask-q], [data-ask-form] [type="submit"], [data-chat-form] [type="submit"]',
  ))
    b.disabled = busy;
  const sub = $('[data-chat-sub]');
  if (sub) sub.textContent = busy ? 'thinking…' : 'Ask about my experience';
  // On a translated page, the new answers are translated too.
  if (window.CRAGA_LANG && window.CRAGA_LANG !== 'en')
    void i18n()?.then((m) => [ASK_LOG, CHAT_LOG].forEach((l) => l && m.refresh(l)));
  setTimeout(() => {
    for (const l of [ASK_LOG, CHAT_LOG]) if (l) l.scrollTop = l.scrollHeight;
  }, 30);
}

// ---------- asking ----------

const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
const i18n = () => (window.CRAGA_I18N ? window.CRAGA_I18N.load() : null);

let spokenQ: string | null = null;

export async function ask(raw: string) {
  const q = String(raw || '')
    .trim()
    .slice(0, 300);
  if (!q || busy) return;
  stopSpeaking();
  const spoken = !!spokenQ && spokenQ.trim().toLowerCase() === q.toLowerCase();
  spokenQ = null;
  const isCmd = isShell(q);
  log = [...log, { q, pending: true, shell: isCmd }].slice(-8);
  busy = true;
  render();
  const finish = (patch: Partial<Entry>) => {
    log[log.length - 1] = { ...log[log.length - 1], ...patch, pending: false };
    busy = false;
    render();
    if (spoken && patch.answer && patch.mode !== 'error') setTimeout(() => say(log.length - 1), 50);
  };
  // A question in another language: ask.sh works in English, so it's translated on the device,
  // and the answer translated back (unless the whole page is already in that language).
  const I: ReturnType<typeof i18n> = isCmd ? null : i18n();
  const toEn = I
    ? within(
        I.then((m) => m.toEnglish(q)).catch(() => null),
        8000,
      )
    : Promise.resolve(null);
  let index: Index;
  let tq: { text: string; lang?: string } | null | undefined;
  try {
    [index, tq] = await Promise.all([askIndex(), toEn]);
  } catch {
    finish({ answer: 'ask.sh needs the live site to run. Try it at craigthompson.dev.', sources: [], mode: 'error' });
    return;
  }
  if (isCmd) {
    const out = shell(q, index);
    if (out.clear) {
      log = [];
      busy = false;
      render();
      return;
    }
    finish({ answer: out.answer, sources: [], mode: 'shell' });
    return;
  }
  const qe = tq?.text || q;
  const lang = tq?.lang;
  const back = (patch: Partial<Entry>) => {
    if (!I || !lang || lang === (window.CRAGA_LANG || 'en') || !patch.answer) return finish(patch);
    within(
      I.then((m) => m.fromEnglish(patch.answer!, lang)),
      8000,
    )
      .then((t) => finish(typeof t === 'string' ? { ...patch, answer: t, answerEn: patch.answer, lang } : patch))
      .catch(() => finish(patch));
  };
  const viaSearch = (why = '') => {
    const r = bestAnswer(index as never, qe) as { answer: string; sources: Passage[] };
    back({ answer: r.answer, sources: r.sources, mode: 'search', note: why });
  };
  if (!ASK_ENDPOINT) return viaSearch();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(ASK_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: qe }),
      signal: ctl.signal,
    });
    const d = (await r.json().catch(() => ({}))) as { answer?: string; sources?: string[]; error?: string };
    if (!r.ok) throw new Error(d.error === 'budget' ? 'budget' : `ask ${r.status}`);
    if (!d.answer) throw new Error('empty');
    let src = (d.sources ?? []).map((id) => index.byId[id]).filter(Boolean);
    if (!src.length) src = (bestAnswer(index as never, qe) as { sources: Passage[] }).sources.slice(0, 2);
    back({ answer: d.answer, sources: src.slice(0, 3), mode: 'ai' });
  } catch (e) {
    viaSearch(
      e instanceof Error && e.message === 'budget'
        ? "ask.sh has used today's free AI allowance, so this is the closest match from the site. It resets at midnight UTC."
        : "The AI isn't available right now, so this is the closest match from the site.",
    );
  } finally {
    clearTimeout(timer);
  }
}

function say(i: number) {
  const e = log[i];
  if (!e?.answer) return;
  let text = e.answer;
  // Translated with the page: read what's on screen, in that language.
  const pageLang = window.CRAGA_LANG && window.CRAGA_LANG !== 'en' ? window.CRAGA_LANG : '';
  const lang = e.lang || pageLang;
  if (lang && !e.lang) {
    const box = $(`.c-ask-a[data-i="${i}"]`);
    const shown = box
      ? $$(':scope > p', box)
          .map((p) => p.textContent)
          .join(' ')
      : '';
    if (shown.trim()) text = shown;
  }
  speak(i, text.replace(/\s+/g, ' ').trim(), lang, render);
}

// ---------- wiring ----------

for (const [form, input] of [
  [$<HTMLFormElement>('[data-ask-form]'), $<HTMLInputElement>('#c-ask-field')],
  [$<HTMLFormElement>('[data-chat-form]'), $<HTMLInputElement>('#c-chat-field')],
] as const) {
  if (!form || !input) continue;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    ask(q);
  });
  const mic = $<HTMLButtonElement>('[data-mic]', form);
  if (mic && canDictate()) {
    mic.hidden = false;
    mic.addEventListener('click', () =>
      dictate(input, mic, (v) => {
        spokenQ = v;
      }),
    );
  }
}

document.addEventListener('click', (e) => {
  const t = e.target as Element;
  const sugg = t.closest<HTMLElement>('[data-ask-q]');
  if (sugg) return void ask(sugg.dataset.askQ!);
  const share = t.closest<HTMLElement>('[data-ask-share]');
  if (share) {
    const entry = log[Number(share.dataset.askShare)];
    if (!entry) return;
    void copyText(`${location.origin}${location.pathname}?ask=${encodeURIComponent(entry.q)}`).then(
      () => {
        share.textContent = 'link copied';
        note('Link to this answer copied');
        return setTimeout(() => (share.textContent = 'copy link'), 2500);
      },
      () => {},
    );
    return;
  }
  const sayB = t.closest<HTMLElement>('[data-ask-say]');
  if (sayB) say(Number(sayB.dataset.askSay));
  // "see the tests" opens them.
  if (t.closest('[data-open-tests]')) {
    const d = $<HTMLDetailsElement>('#c-tests');
    if (d) d.open = true;
  }
});

// ---------- the chat bar ----------

const chat = $('[data-chat]');
if (chat) {
  const bar = $<HTMLButtonElement>('[data-chat-toggle]', chat)!;
  const panel = $('#c-chat-panel', chat)!;
  const field = $<HTMLInputElement>('#c-chat-field', chat)!;
  const setOpen = (open: boolean) => {
    chat.dataset.open = String(open);
    bar.setAttribute('aria-expanded', String(open));
    bar.title = open ? 'Minimise' : 'Ask about my experience';
    panel.hidden = !open;
    if (open) {
      render();
      if (matchMedia('(pointer: fine)').matches) field.focus();
    }
  };
  bar.addEventListener('click', () => setOpen(chat.dataset.open !== 'true'));
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      bar.focus();
    }
  });
  // Out of the way while the ask.sh section itself is on screen.
  addEventListener('craga:section', (e) => {
    if (chat.dataset.open !== 'true') chat.dataset.hide = String((e as CustomEvent<string>).detail === 'ask');
  });
  // On a small screen, following a link in an answer closes the chat.
  chat.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a') && innerWidth <= 900) setTimeout(() => setOpen(false), 0);
  });
}
