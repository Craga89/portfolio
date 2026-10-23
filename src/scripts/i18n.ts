// On-device translation (src/i18n.js, with the browser's built-in Translator API), loaded only
// when it's needed: the visitor's browser prefers a language before English, they chose one
// before, or they pick one from the language menu.
import { $$, store } from './dom';
import { LANGS } from '../../shared/langs.js';

if ('Translator' in self) {
  const L = LANGS as readonly string[];
  const norm = (t: string) => {
    t = String(t || '').toLowerCase();
    if (/^zh-(tw|hk|mo)|^zh-hant/.test(t)) return 'zh-Hant';
    const b = ({ nb: 'no', nn: 'no', iw: 'he', in: 'id' } as Record<string, string>)[t.split('-')[0]] ?? t.split('-')[0];
    return L.includes(b) ? b : null;
  };
  let p: Promise<typeof import('../i18n.js')> | null = null;
  const I = (window.CRAGA_I18N = { langs: L, load: () => (p ??= import('../i18n.js')) });
  const saved = store.get('craga-lang');
  const no = store.get('craga-lang-no');
  const want = saved && saved !== 'en' ? norm(saved) : null;
  let offer: string | null = null;
  if (!saved) {
    for (const l of navigator.languages ?? [navigator.language]) {
      if (/^en(-|$)/i.test(l)) break;
      const n = norm(l);
      if (n) {
        offer = n;
        break;
      }
    }
  }
  if (offer === no) offer = null;

  // The language menus, filled in only where translation works.
  const name = (c: string) => {
    try {
      const n = new Intl.DisplayNames([c], { type: 'language' }).of(c)!;
      return n.charAt(0).toLocaleUpperCase(c) + n.slice(1);
    } catch {
      return c;
    }
  };
  const menus = $$<HTMLSelectElement>('[data-tr-menu]');
  for (const s of menus) {
    for (const c of ['en', ...L]) s.append(Object.assign(document.createElement('option'), { value: c, lang: c, textContent: c === 'en' ? 'English' : name(c) }));
    s.value = want || 'en';
    (s.closest<HTMLElement>('[data-lang]') ?? s).hidden = false;
    s.addEventListener('change', () => I.load().then((m) => m.setLanguage(s.value)));
  }
  addEventListener('craga:lang', (e) => {
    const lang = (e as CustomEvent<{ lang: string }>).detail.lang;
    for (const s of menus) s.value = lang;
    for (const mt of $$('[data-lang-mt]')) mt.hidden = lang === 'en';
  });
  if (want || offer) I.load().then((m) => m.boot({ lang: (want || offer)!, saved: !!want }), (e) => console.warn('translation unavailable:', e));
}
