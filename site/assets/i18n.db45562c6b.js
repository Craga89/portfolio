// On-device translation for craigthompson.dev, with the browser's built-in Translator API
// (Chrome and Edge on desktop). Nothing is sent anywhere: the language model runs on the
// visitor's computer. Loaded only when it's needed: the visitor's browser prefers a supported
// language, they chose one before, or they pick one from a language menu.
//
// How the page is translated: text is grouped into "units" (a paragraph, a list item, a
// button...). Each unit's inline markup (links, bold, glossary terms, file names) becomes
// numbered tokens, {0}text{/0}, so the translator sees whole sentences and the markup goes back
// round the translated words, in whatever order the language needs. If the tokens don't come
// back intact, each text run is translated on its own instead. Results are cached per language
// in the visitor's browser.
//
// The home page is rendered by the design runtime, which re-renders from its English template
// (tabs, the clock, ask.sh...). So there the translation is a render step: every render is
// translated from the cache before it's patched in, and nothing flickers back to English.
// Static pages (the CV and the file pages) are translated in place.

export const LANGS = ['ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'es', 'fi', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh', 'zh-Hant'];
const RTL = new Set(['ar', 'he']);

// The offer, written in each language: [question, accept, decline]. It has to be readable
// before any language model is on the device, so it can't be machine-translated here.
const OFFER = {
  ar: ['قراءة هذه الصفحة بالعربية؟', 'ترجمة', 'لا، شكرًا'],
  bg: ['Да прочетете тази страница на български?', 'Преведи', 'Не, благодаря'],
  bn: ['এই পৃষ্ঠাটি বাংলায় পড়বেন?', 'অনুবাদ করুন', 'না, ধন্যবাদ'],
  cs: ['Přečíst tuto stránku v češtině?', 'Přeložit', 'Ne, děkuji'],
  da: ['Vil du læse siden på dansk?', 'Oversæt', 'Nej tak'],
  de: ['Diese Seite auf Deutsch lesen?', 'Übersetzen', 'Nein, danke'],
  el: ['Να διαβάσετε αυτή τη σελίδα στα ελληνικά;', 'Μετάφραση', 'Όχι, ευχαριστώ'],
  es: ['¿Leer esta página en español?', 'Traducir', 'No, gracias'],
  fi: ['Luetaanko tämä sivu suomeksi?', 'Käännä', 'Ei kiitos'],
  fr: ['Lire cette page en français ?', 'Traduire', 'Non merci'],
  he: ['לקרוא את הדף הזה בעברית?', 'תרגום', 'לא, תודה'],
  hi: ['यह पेज हिंदी में पढ़ें?', 'अनुवाद करें', 'नहीं, धन्यवाद'],
  hr: ['Pročitati ovu stranicu na hrvatskom?', 'Prevedi', 'Ne, hvala'],
  hu: ['Elolvassa ezt az oldalt magyarul?', 'Fordítás', 'Nem, köszönöm'],
  id: ['Baca halaman ini dalam bahasa Indonesia?', 'Terjemahkan', 'Tidak, terima kasih'],
  it: ['Leggere questa pagina in italiano?', 'Traduci', 'No, grazie'],
  ja: ['このページを日本語で読みますか？', '翻訳する', 'いいえ'],
  kn: ['ಈ ಪುಟವನ್ನು ಕನ್ನಡದಲ್ಲಿ ಓದುವುದೇ?', 'ಅನುವಾದಿಸಿ', 'ಬೇಡ, ಧನ್ಯವಾದಗಳು'],
  ko: ['이 페이지를 한국어로 읽으시겠어요?', '번역하기', '괜찮아요'],
  lt: ['Skaityti šį puslapį lietuviškai?', 'Versti', 'Ne, ačiū'],
  mr: ['हे पान मराठीत वाचायचे?', 'भाषांतर करा', 'नको, धन्यवाद'],
  nl: ['Deze pagina in het Nederlands lezen?', 'Vertalen', 'Nee, bedankt'],
  no: ['Vil du lese siden på norsk?', 'Oversett', 'Nei takk'],
  pl: ['Przeczytać tę stronę po polsku?', 'Przetłumacz', 'Nie, dziękuję'],
  pt: ['Ler esta página em português?', 'Traduzir', 'Agora não'],
  ro: ['Citiți această pagină în română?', 'Traduceți', 'Nu, mulțumesc'],
  ru: ['Прочитать эту страницу на русском?', 'Перевести', 'Нет, спасибо'],
  sk: ['Prečítať túto stránku v slovenčine?', 'Preložiť', 'Nie, ďakujem'],
  sl: ['Želite to stran prebrati v slovenščini?', 'Prevedi', 'Ne, hvala'],
  sv: ['Vill du läsa sidan på svenska?', 'Översätt', 'Nej tack'],
  ta: ['இந்தப் பக்கத்தைத் தமிழில் படிக்கவா?', 'மொழிபெயர்', 'வேண்டாம், நன்றி'],
  te: ['ఈ పేజీని తెలుగులో చదవాలా?', 'అనువదించు', 'వద్దు, ధన్యవాదాలు'],
  th: ['อ่านหน้านี้เป็นภาษาไทยไหม', 'แปล', 'ไม่ ขอบคุณ'],
  tr: ['Bu sayfayı Türkçe okumak ister misiniz?', 'Çevir', 'Hayır, teşekkürler'],
  uk: ['Прочитати цю сторінку українською?', 'Перекласти', 'Ні, дякую'],
  vi: ['Đọc trang này bằng tiếng Việt?', 'Dịch', 'Không, cảm ơn'],
  zh: ['用中文阅读此页面？', '翻译', '不用了，谢谢'],
  'zh-Hant': ['用中文閱讀此頁面？', '翻譯', '不用了，謝謝'],
};

// Banner text, machine-translated once the language pack is ready.
const UI = {
  done: 'Machine-translated on your device from the English original.',
  original: 'Show original',
  language: 'Language',
  failed: "Translation isn't available in this browser right now.",
};

const INLINE = new Set('a abbr b bdi bdo cite data dfn em i mark q s small span strong sub sup time u var button label'.split(' '));
const SKIP = 'script,style,noscript,template,code,pre,kbd,samp,svg,math,textarea,input,select,option,canvas,iframe,video,audio,[translate="no"],[contenteditable],.c-cursor';
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
const LETTER = /\p{L}/u;
const TOKEN = /\{(\/?)(\d+)\}/g;
const STORE = 'craga-tr-';
// Never translated, wherever they appear: the name, email addresses, domains and file names.
const KEEP = /Craig Michael Thompson|Craig Thompson|[\w.+-]+@[\w-]+\.[\w.]*[a-z]|\b(?:[\w-]+\.)+(?:dev|com|io|org|net)(?:\/[\w./-]*)?|(?:\.\/)?\b[\w/-]+\.(?:md|log|txt|json|pdf|sh|vcf)\b/g;

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

export function langName(code, inLang) {
  try {
    const n = new Intl.DisplayNames([inLang || code], { type: 'language' }).of(code === 'zh-Hant' ? 'zh-Hant' : code);
    return n ? n.charAt(0).toLocaleUpperCase(code) + n.slice(1) : code;
  } catch (e) { return code; }
}

// The visitor's preferred language, if it's one we can translate to and it comes before English.
export function preferred(list) {
  for (const raw of list || []) {
    const l = String(raw).toLowerCase();
    if (/^en(-|$)/.test(l)) return null;
    const n = normalise(l);
    if (n) return n;
  }
  return null;
}
export function normalise(l) {
  l = String(l || '').toLowerCase();
  if (/^zh-(tw|hk|mo)|^zh-hant/.test(l)) return 'zh-Hant';
  let b = l.split('-')[0];
  b = { nb: 'no', nn: 'no', iw: 'he', in: 'id' }[b] || b;
  return LANGS.includes(b) ? b : null;
}

// ---------- units: what gets translated as one piece ----------

const blocked = (el) => !!(el.closest && el.closest(SKIP));
const hasText = (el) => Array.prototype.some.call(el.childNodes, (c) => c.nodeType === 3 && LETTER.test(c.data));

// The element whose text is translated together with this one's: the nearest block, unless that
// block has no text of its own (a row of chips), in which case the outermost inline element.
function unitFor(el) {
  let u = el;
  while (INLINE.has(u.localName) && u.parentElement) {
    const p = u.parentElement;
    if (INLINE.has(p.localName) || hasText(p)) u = p; else break;
  }
  return u;
}

export function unitsIn(root) {
  const out = [];
  const seen = new Set();
  const doc = root.ownerDocument || document;
  const tw = doc.createTreeWalker(root, 4 /* text */);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!LETTER.test(n.data)) continue;
    const p = n.parentElement;
    if (!p || blocked(p)) continue;
    const u = unitFor(p);
    if (u === root || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

const atomic = (c) => !INLINE.has(c.localName) || (c.matches && c.matches(SKIP)) || !LETTER.test(c.textContent || '');
// Braces in the page's own text would read as tokens, so they're swapped out while translating.
const hideBraces = (t) => t.replace(/\{/g, '').replace(/\}/g, '');
const showBraces = (t) => t.replace(//g, '{').replace(//g, '}');

// A unit as a string with numbered tokens for its inline elements.
export function encode(unit) {
  const doc = unit.ownerDocument || document;
  const nodes = [];
  const parent = [];
  const paired = [];
  // Protected text becomes a token too, standing for a text node of its own.
  const protect = (t, pi) => hideBraces(t).replace(KEEP, (m) => { const i = nodes.length; nodes.push(doc.createTextNode(m)); parent.push(pi); paired.push(false); return '{' + i + '}'; });
  const walk = (el, pi) => {
    let s = '';
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { s += protect(c.data, pi); continue; }
      if (c.nodeType !== 1) continue;
      const i = nodes.length;
      nodes.push(c);
      parent.push(pi);
      if (atomic(c)) { paired.push(false); s += '{' + i + '}'; } else { paired.push(true); s += '{' + i + '}' + walk(c, i) + '{/' + i + '}'; }
    }
    return s;
  };
  const raw = walk(unit, -1);
  const key = raw.replace(/\s+/g, ' ').trim();
  const lead = /^\s/.test(raw) ? ' ' : '';
  const trail = /\s$/.test(raw) ? ' ' : '';
  return { key, nodes, parent, paired, lead, trail, translatable: LETTER.test(key.replace(TOKEN, '')) };
}

// Tokens as the translator may hand them back: full-width braces, stray spaces.
const tidy = (t) => String(t).replace(/[{｛]\s*(\/?)\s*(\d+)\s*[}｝]/g, '{$1$2}');

// Do the tokens in a translation still describe the same markup?
export function fits(out, meta) {
  const seen = new Array(meta.nodes.length).fill(0);
  const closed = new Array(meta.nodes.length).fill(0);
  const stack = [-1];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(out))) {
    const i = +m[2];
    if (i >= meta.nodes.length) return false;
    if (m[1]) {
      if (!meta.paired[i] || stack[stack.length - 1] !== i) return false;
      stack.pop();
      closed[i]++;
    } else {
      if (meta.parent[i] !== stack[stack.length - 1]) return false;
      seen[i]++;
      if (meta.paired[i]) stack.push(i);
    }
  }
  return stack.length === 1 && seen.every((n) => n === 1) && closed.every((n, i) => n === (meta.paired[i] ? 1 : 0));
}

// Put a translation into a unit, reusing its original inline elements.
export function rebuild(unit, out, meta, stash) {
  const doc = unit.ownerDocument || document;
  const clear = (el) => { if (stash) stash(el); while (el.firstChild) el.removeChild(el.firstChild); };
  clear(unit);
  const stack = [unit];
  const text = (t) => { if (t) stack[stack.length - 1].appendChild(doc.createTextNode(showBraces(t))); };
  let last = 0;
  let m;
  const s = meta.lead + out + meta.trail;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(s))) {
    text(s.slice(last, m.index));
    last = TOKEN.lastIndex;
    const i = +m[2];
    if (m[1]) { stack.pop(); continue; }
    const el = meta.nodes[i];
    if (meta.paired[i]) clear(el);
    stack[stack.length - 1].appendChild(el);
    if (meta.paired[i]) stack.push(el);
  }
  text(s.slice(last));
}

// ---------- the translator ----------

const state = {
  lang: 'en', translator: null, cache: new Map(), queue: [], queued: new Set(), done: 0, total: 0,
  running: false, app: null, active: false, ui: null, strings: null, offerEl: null, stashes: [], texts: [], swapped: new WeakSet(), title: null, saveT: 0, flushT: 0,
  metas: new Map(), attrSrc: new Map(),
};

function loadCache(lang) {
  const m = new Map();
  try { const d = JSON.parse(ls.get(STORE + lang) || '{}'); Object.keys(d).forEach((k) => m.set(k, d[k])); } catch (e) {}
  return m;
}
function saveCache() {
  clearTimeout(state.saveT);
  state.saveT = setTimeout(() => {
    const o = {};
    let size = 0;
    for (const [k, v] of state.cache) { size += k.length + v.length; if (size > 1.5e6) break; o[k] = v; }
    ls.set(STORE + state.lang, JSON.stringify(o));
  }, 1500);
}

function enqueue(key) {
  if (!key || state.cache.has(key) || state.queued.has(key)) return;
  state.queued.add(key);
  state.queue.push(key);
  state.total++;
  pump();
}

async function translateKey(key) {
  const tr = state.translator;
  if (state.attrSrc.has(key)) return tidy(await tr.translate(state.attrSrc.get(key)));
  const meta = state.metas.get(key);
  const out = tidy(await tr.translate(key));
  if (!meta || fits(out, meta)) return out;
  // Tokens lost or moved out of place: translate each piece of text between them on its own.
  const parts = key.split(/(\{\/?\d+\})/);
  for (let i = 0; i < parts.length; i += 2) {
    const p = parts[i];
    if (!LETTER.test(p)) continue;
    const lead = /^\s/.test(p) ? ' ' : '';
    const trail = /\s$/.test(p) ? ' ' : '';
    parts[i] = lead + tidy(await tr.translate(p.trim())).replace(TOKEN, '') + trail;
  }
  return parts.join('');
}

async function pump() {
  if (state.running) return;
  state.running = true;
  const lang = state.lang;
  try {
    while (state.queue.length && state.lang === lang && state.translator) {
      const key = state.queue.shift();
      let out = null;
      try { out = await translateKey(key); } catch (e) { out = null; }
      if (state.lang !== lang) break;
      state.queued.delete(key);
      state.done++;
      if (out != null) state.cache.set(key, out);
      flushSoon();
      progress();
    }
  } finally {
    state.running = false;
  }
  if (state.lang === lang && !state.queue.length) { clearTimeout(state.flushT); state.flushT = 0; flush(); saveCache(); progress(); }
}

function flushSoon() {
  if (state.flushT) return;
  state.flushT = setTimeout(() => { state.flushT = 0; flush(); }, 250);
}
function flush() {
  if (!state.active) return;
  if (state.app) state.app.schedule();
  else apply(document.body, true);
  translateTitle();
  saveCache();
}

// The page title, with the same protection as the page (the name stays as it is).
function translateTitle() {
  if (state.title == null) state.title = document.title;
  const span = document.createElement('span');
  span.textContent = state.title;
  const meta = encode(span);
  if (!meta.translatable) return;
  if (!state.metas.has(meta.key)) state.metas.set(meta.key, meta);
  const out = state.cache.get(meta.key);
  if (out != null && fits(out, meta)) { rebuild(span, out, meta); document.title = span.textContent; } else enqueue(meta.key);
}

// Translate everything under root from the cache; anything not there yet is queued and marked
// as English for now (so screen readers pronounce it right).
const translatedUnits = new WeakSet();
export function apply(root, live) {
  for (const u of unitsIn(root)) {
    if (live && translatedUnits.has(u)) continue;
    const meta = encode(u);
    if (!meta.translatable) continue;
    if (!state.metas.has(meta.key)) state.metas.set(meta.key, meta);
    const out = state.cache.get(meta.key);
    if (out == null) { enqueue(meta.key); u.setAttribute('lang', 'en'); continue; }
    // A cached translation whose tokens don't fit this markup (it changed) is redone.
    if (!fits(out, meta)) { state.cache.delete(meta.key); enqueue(meta.key); u.setAttribute('lang', 'en'); continue; }
    rebuild(u, out, meta, live ? stash : null);
    if (u.getAttribute('lang') === 'en') u.removeAttribute('lang');
    if (live) translatedUnits.add(u);
  }
  root.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach((el) => {
    if (el.closest('[translate="no"],script,style,noscript,template,svg,code,pre')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !LETTER.test(v)) continue;
      const key = '@' + v;
      const t = state.cache.get(key);
      if (t) { if (live) stashAttr(el, a, v); el.setAttribute(a, t); } else queueAttr(key, v);
    }
  });
  if (RTL.has(state.lang)) swapArrows(root, live);
}
function queueAttr(key, v) {
  if (state.cache.has(key) || state.queued.has(key)) return;
  state.metas.set(key, null);
  state.queued.add(key);
  state.queue.push(key);
  state.total++;
  state.attrSrc.set(key, v);
  pump();
}

// Arrows that point along the line of text point the other way in Arabic and Hebrew. (Arrows in
// diagrams are mirrored by CSS instead; code and commands stay left-to-right.)
const NO_SWAP = 'code,pre,kbd,samp,svg,.c-cmd,.c-ask-q,.c-ltr,[dir="ltr"],.c-arr,.c-arch-a,.c-mcp-a,.c-go';
function swapArrows(root, live) {
  const doc = root.ownerDocument || document;
  const tw = doc.createTreeWalker(root, 4);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!/[→←]/.test(n.data) || (live && state.swapped.has(n))) continue;
    if (n.parentElement && n.parentElement.closest(NO_SWAP)) continue;
    if (live) { state.texts.push([n, n.data]); state.swapped.add(n); }
    n.data = n.data.replace(/[→←]/g, (c) => (c === '→' ? '←' : '→'));
  }
}

// Static pages: remember what was there so "Show original" can put it back.
function stash(el) { if (el && !el.__trOrig) { el.__trOrig = Array.prototype.slice.call(el.childNodes); state.stashes.push(el); } }
function stashAttr(el, a, v) { el.__trAttr = el.__trAttr || {}; if (!(a in el.__trAttr)) { el.__trAttr[a] = v; state.stashes.push(el); } }
function restoreStatic() {
  for (const [n, d] of state.texts) n.data = d;
  state.texts = [];
  for (let i = state.stashes.length - 1; i >= 0; i--) {
    const el = state.stashes[i];
    if (el.__trOrig) { el.replaceChildren(...el.__trOrig); delete el.__trOrig; }
    if (el.__trAttr) { Object.keys(el.__trAttr).forEach((a) => el.setAttribute(a, el.__trAttr[a])); delete el.__trAttr; }
    if (el.getAttribute && el.getAttribute('lang') === 'en') el.removeAttribute('lang');
  }
  document.querySelectorAll('[lang="en"]').forEach((el) => { if (el !== document.documentElement) el.removeAttribute('lang'); });
  state.stashes = [];
}

async function makeTranslator(source, target, onProgress) {
  return self.Translator.create({
    sourceLanguage: source,
    targetLanguage: target,
    monitor(m) { if (onProgress) m.addEventListener('downloadprogress', (e) => onProgress(e.loaded)); },
  });
}

// ---------- page language ----------

function setDocLang(lang) {
  const h = document.documentElement;
  if (lang === 'en') { h.setAttribute('lang', h.dataset.lang0 || 'en-GB'); h.removeAttribute('dir'); return; }
  if (!h.dataset.lang0) h.dataset.lang0 = h.getAttribute('lang') || 'en-GB';
  h.setAttribute('lang', lang);
  if (RTL.has(lang)) h.setAttribute('dir', 'rtl'); else h.removeAttribute('dir');
}

function announce() {
  window.CRAGA_LANG = state.active ? state.lang : 'en';
  window.dispatchEvent(new CustomEvent('craga:lang', { detail: { lang: window.CRAGA_LANG } }));
}

export async function start(lang, opts = {}) {
  lang = normalise(lang) || lang;
  if (!LANGS.includes(lang)) return stop();
  if (state.active && state.lang === lang) return;
  if (state.active) await stop({ keep: true });
  removeOffer();
  ui('downloading', lang, 0);
  let translator;
  try {
    // Progress events can still arrive after the pack is ready; by then the bar shows the translation.
    translator = await makeTranslator('en', lang, (p) => { if (!state.active) ui('downloading', lang, p); });
  } catch (e) {
    if (opts.silent) { removeUi(); return false; }
    ui('failed', lang);
    return false;
  }
  Object.assign(state, { lang, translator, cache: loadCache(lang), metas: new Map(), attrSrc: new Map(), queue: [], queued: new Set(), done: 0, total: 0, active: true, swapped: new WeakSet(), title: null });
  ls.set('craga-lang', lang);
  setDocLang(lang);
  try {
    const s = {};
    for (const k of Object.keys(UI)) s[k] = tidy(await translator.translate(UI[k]));
    state.strings = s;
  } catch (e) { state.strings = null; }
  const app = window.CRAGA_APP;
  if (app && typeof app.schedule === 'function') {
    state.app = app;
    // Queue what's on screen first, from the English page, then translate every render.
    app.transform = null;
    app.render();
    const near = unitsIn(app.root).map((u) => { const r = u.getBoundingClientRect(); return { u, d: r.bottom < 0 ? -r.bottom + 2000 : Math.max(0, r.top - innerHeight) }; }).sort((a, b) => a.d - b.d);
    for (const { u } of near) { const meta = encode(u); if (meta.translatable) { state.metas.set(meta.key, meta); enqueue(meta.key); } }
    app.transform = (holder) => apply(holder, false);
    app.render();
  } else {
    state.app = null;
    apply(document.body, true);
  }
  translateTitle();
  announce();
  progress();
  return true;
}

export async function stop(opts = {}) {
  const was = state.active;
  state.active = false;
  state.queue = [];
  state.queued = new Set();
  if (state.translator && state.translator.destroy) { try { state.translator.destroy(); } catch (e) {} }
  state.translator = null;
  if (state.app) { state.app.transform = null; state.app.render(); }
  else if (was) restoreStatic();
  if (state.title != null) document.title = state.title;
  state.title = null;
  if (!opts.keep) {
    setDocLang('en');
    ls.set('craga-lang', 'en');
    state.lang = 'en';
    removeUi();
    announce();
  }
}

export function setLanguage(lang) {
  return lang === 'en' || !lang ? stop() : start(lang);
}

// ---------- ask.sh ----------

const pairs = new Map();
async function pair(from, to) {
  const k = from + '>' + to;
  if (!pairs.has(k)) pairs.set(k, makeTranslator(from, to).catch((e) => { pairs.delete(k); throw e; }));
  return pairs.get(k);
}
let detector = null;

// A question typed in another language, in English for ask.sh, and the language it was in.
export async function toEnglish(text) {
  const letters = (String(text).match(/\p{L}/gu) || []).length;
  if (!('LanguageDetector' in self) || letters < 8) return { text };
  detector = detector || self.LanguageDetector.create();
  const res = await (await detector).detect(text);
  const top = res && res[0];
  if (!top || top.confidence < 0.7 || /^(en|und)/.test(top.detectedLanguage)) return { text };
  const lang = normalise(top.detectedLanguage);
  if (!lang) return { text };
  const tr = await pair(lang, 'en');
  return { text: tidy(await tr.translate(text)), lang };
}

// An English answer in the visitor's language, line by line (answers can be lists).
export async function fromEnglish(text, lang) {
  const tr = await pair('en', lang);
  const lines = String(text).split('\n');
  const out = [];
  for (const l of lines) {
    const m = l.match(/^(\s*[-•*]\s+)?(.*)$/);
    out.push(m[2] && LETTER.test(m[2]) ? (m[1] || '') + tidy(await tr.translate(m[2])) : l);
  }
  return out.join('\n');
}

// ---------- the offer and the banner ----------

// Outside the page's own themed area, so it carries the site's colours for both themes.
const CSS = `
.tr-offer,.tr-bar{--tr-bg:#1C3127;--tr-bg2:#223A2E;--tr-fg:#F6F8F4;--tr-fg2:#D9E4DD;--tr-mute:#A7BFB2;--tr-line:#47685A;--tr-line2:#335041;--tr-acc:#8EC3E6;--tr-acc-fg:#16271F;font-family:'Public Sans','Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
html.t-light .tr-offer,html.t-light .tr-bar{--tr-bg:#FFFFFF;--tr-bg2:#E1E8E3;--tr-fg:#0F1D16;--tr-fg2:#26342D;--tr-mute:#4C5D53;--tr-line:#A8B8AD;--tr-line2:#C5D1C9;--tr-acc:#1D6590;--tr-acc-fg:#FFFFFF}
@media (prefers-color-scheme:light){html:not(.t-dark) .tr-offer,html:not(.t-dark) .tr-bar{--tr-bg:#FFFFFF;--tr-bg2:#E1E8E3;--tr-fg:#0F1D16;--tr-fg2:#26342D;--tr-mute:#4C5D53;--tr-line:#A8B8AD;--tr-line2:#C5D1C9;--tr-acc:#1D6590;--tr-acc-fg:#FFFFFF}}
.tr-offer{position:fixed;z-index:45;inset-inline-start:16px;bottom:16px;max-width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;border:1px solid var(--tr-acc);border-radius:12px;background:var(--tr-bg);color:var(--tr-fg);box-shadow:0 16px 40px -16px rgba(0,0,0,.45);font-size:15px;line-height:1.4;animation:tr-in .25s ease both}
.tr-offer p{margin:0 0 10px;font-weight:600}
.tr-offer small{display:block;margin:-6px 0 12px;color:var(--tr-mute);font-size:12.5px;font-weight:400}
.tr-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tr-btn{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid var(--tr-line);background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer}
.tr-btn.tr-go{background:var(--tr-acc);border-color:var(--tr-acc);color:var(--tr-acc-fg);font-weight:700}
.tr-btn:focus-visible,.tr-sel:focus-visible{outline:2px solid var(--tr-acc);outline-offset:2px}
.tr-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:8px 16px;background:var(--tr-bg2);border-bottom:1px solid var(--tr-line2);color:var(--tr-fg2);font-size:13.5px;line-height:1.4}
.tr-bar .tr-msg{flex:1 1 260px}
.tr-bar .tr-btn{min-height:32px;padding:0 10px;font-size:13px}
.tr-sel{min-height:32px;padding:0 8px;border-radius:8px;border:1px solid var(--tr-line);background:transparent;color:inherit;font:inherit;font-size:13px}
.tr-sel option{color:#1B2A22;background:#fff}
.tr-meter{flex:0 0 120px;height:6px;border-radius:3px;background:var(--tr-line2);overflow:hidden}
.tr-meter i{display:block;height:100%;width:var(--p,0%);background:var(--tr-acc);transition:width .2s ease}
@keyframes tr-in{from{opacity:0;transform:translateY(8px)}}
@media (max-width:600px){.tr-offer{inset-inline:8px;bottom:64px;max-width:none}}
@media (prefers-reduced-motion:reduce){.tr-offer{animation:none}.tr-meter i{transition:none}}
@media print{.tr-offer,.tr-bar{display:none!important}}
`;
function css() {
  if (document.getElementById('tr-css')) return;
  const s = document.createElement('style');
  s.id = 'tr-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}
const el = (tag, attrs, kids) => {
  const e = document.createElement(tag);
  Object.keys(attrs || {}).forEach((k) => { if (k === 'text') e.textContent = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
  (kids || []).forEach((c) => c && e.appendChild(c));
  return e;
};

function languageSelect(current) {
  const s = el('select', { class: 'tr-sel', translate: 'no', 'aria-label': (state.strings && state.strings.language) || UI.language, onchange: (e) => setLanguage(e.target.value) });
  [['en', 'English']].concat(LANGS.map((c) => [c, langName(c)])).forEach(([c, n]) => { const o = el('option', { value: c, lang: c, text: n }); if (c === current) o.selected = true; s.appendChild(o); });
  return s;
}

export function offer(lang) {
  if (!OFFER[lang] || state.offerEl) return;
  css();
  const [q, yes, no] = OFFER[lang];
  window.CRAGA_I18N_OFFER = 'shown';
  const id = 'tr-q';
  const box = el('div', { class: 'tr-offer', role: 'region', 'aria-labelledby': id, lang, dir: RTL.has(lang) ? 'rtl' : 'ltr', translate: 'no' }, [
    el('p', { id, text: q }),
    el('small', { lang: 'en', dir: 'ltr', text: 'Translated on your device by your browser. Nothing is sent anywhere.' }),
    el('div', { class: 'tr-row' }, [
      el('button', { type: 'button', class: 'tr-btn tr-go', text: yes, onclick: () => { window.CRAGA_I18N_OFFER = 'accepted'; start(lang); } }),
      el('button', { type: 'button', class: 'tr-btn', text: no, onclick: () => { window.CRAGA_I18N_OFFER = 'dismissed'; ls.set('craga-lang-no', lang); removeOffer(); } }),
    ]),
  ]);
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { window.CRAGA_I18N_OFFER = 'dismissed'; removeOffer(); } });
  state.offerEl = box;
  document.body.insertBefore(box, document.body.firstChild);
}
function removeOffer() { if (state.offerEl) { state.offerEl.remove(); state.offerEl = null; } }

function ui(kind, lang, p) {
  css();
  if (!state.ui) {
    state.ui = el('div', { class: 'tr-bar', role: 'region', 'aria-label': 'Translation', translate: 'no' });
    document.body.insertBefore(state.ui, document.body.firstChild);
  }
  const bar = state.ui;
  const pct = Math.round((p || 0) * 100);
  const busy = kind === 'downloading' || kind === 'translating';
  // Progress updates in place and isn't announced; only the finished state is.
  if (busy && bar.dataset.kind === 'busy') {
    bar.querySelector('.tr-msg').textContent = langName(lang) + ' · ' + pct + '%';
    bar.querySelector('.tr-meter').style.setProperty('--p', pct + '%');
    return;
  }
  bar.dataset.kind = busy ? 'busy' : kind;
  const s = state.strings || UI;
  bar.setAttribute('lang', kind === 'done' ? lang : 'en');
  bar.replaceChildren();
  if (busy) {
    bar.append(el('span', { class: 'tr-msg', lang, text: langName(lang) + ' · ' + pct + '%' }), el('span', { class: 'tr-meter', 'aria-hidden': 'true', style: '--p:' + pct + '%' }, [el('i')]));
  } else if (kind === 'failed') {
    bar.append(el('span', { class: 'tr-msg', role: 'status', lang: 'en', text: UI.failed }), el('button', { type: 'button', class: 'tr-btn', lang: 'en', text: 'OK', onclick: () => removeUi() }));
  } else {
    bar.append(el('span', { class: 'tr-msg', role: 'status', text: s.done }), el('button', { type: 'button', class: 'tr-btn', text: s.original, onclick: () => stop() }), languageSelect(lang));
  }
}
function removeUi() { if (state.ui) { state.ui.remove(); state.ui = null; } }
function progress() {
  if (!state.active) return;
  if (state.queue.length || state.running) ui('translating', state.lang, state.total ? state.done / state.total : 0);
  else ui('done', state.lang);
}

// ---------- boot ----------

// Called by the page once this module has loaded: start straight away for a returning visitor
// who chose a language before, otherwise offer it.
export async function boot({ lang, saved }) {
  if (!('Translator' in self)) return;
  if (saved) {
    try {
      if ((await self.Translator.availability({ sourceLanguage: 'en', targetLanguage: lang })) === 'available' && (await start(lang, { silent: true }))) return;
    } catch (e) {}
  }
  offer(lang);
}

// For tests and debugging.
export function status() {
  return { lang: state.lang, active: state.active, queued: state.queue.length, running: state.running, done: state.done, total: state.total, cached: state.cache.size, next: state.queue.slice(0, 3) };
}
