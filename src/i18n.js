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

import { LANGS, RTL } from '../shared/langs.js';

export { LANGS };

// The offer, written in each language: [question, accept, decline, note]. It has to be readable
// before any language model is on the device, so it can't be machine-translated here. The note
// says plainly that this is machine translation by the browser, not a person's; the banner
// repeats it once the page is translated, in words a person wrote rather than the model.
/** @type {Record<string, [question: string, accept: string, decline: string, note: string]>} */
const OFFER = {
  ar: ['قراءة هذه الصفحة بالعربية؟', 'ترجمة', 'لا، شكرًا', 'ترجمة آلية يجريها متصفحك على جهازك، ولم يراجعها أي شخص.'],
  bg: [
    'Да прочетете тази страница на български?',
    'Преведи',
    'Не, благодаря',
    'Машинен превод от браузъра ви, на вашето устройство. Не е проверен от човек.',
  ],
  bn: [
    'এই পৃষ্ঠাটি বাংলায় পড়বেন?',
    'অনুবাদ করুন',
    'না, ধন্যবাদ',
    'আপনার ব্রাউজার আপনার ডিভাইসেই যন্ত্রের মাধ্যমে অনুবাদ করে। কোনো মানুষ এটি যাচাই করেনি।',
  ],
  cs: [
    'Přečíst tuto stránku v češtině?',
    'Přeložit',
    'Ne, děkuji',
    'Strojový překlad provádí váš prohlížeč přímo ve vašem zařízení. Nikdo ho nekontroloval.',
  ],
  da: [
    'Vil du læse siden på dansk?',
    'Oversæt',
    'Nej tak',
    'Maskinoversættelse fra din browser, på din enhed. Ikke gennemgået af et menneske.',
  ],
  de: [
    'Diese Seite auf Deutsch lesen?',
    'Übersetzen',
    'Nein, danke',
    'Maschinelle Übersetzung durch Ihren Browser, direkt auf Ihrem Gerät. Nicht von Menschen geprüft.',
  ],
  el: [
    'Να διαβάσετε αυτή τη σελίδα στα ελληνικά;',
    'Μετάφραση',
    'Όχι, ευχαριστώ',
    'Αυτόματη μετάφραση από το πρόγραμμα περιήγησής σας, στη συσκευή σας. Δεν έχει ελεγχθεί από άνθρωπο.',
  ],
  es: [
    '¿Leer esta página en español?',
    'Traducir',
    'No, gracias',
    'Traducción automática de tu navegador, en tu dispositivo. Ninguna persona la ha revisado.',
  ],
  fi: [
    'Luetaanko tämä sivu suomeksi?',
    'Käännä',
    'Ei kiitos',
    'Selaimesi konekääntämä, laitteellasi. Ihminen ei ole tarkistanut sitä.',
  ],
  fr: [
    'Lire cette page en français ?',
    'Traduire',
    'Non merci',
    'Traduction automatique par votre navigateur, sur votre appareil. Non relue par une personne.',
  ],
  he: ['לקרוא את הדף הזה בעברית?', 'תרגום', 'לא, תודה', 'תרגום מכונה של הדפדפן שלך, במכשיר שלך. אף אדם לא בדק אותו.'],
  hi: [
    'यह पेज हिंदी में पढ़ें?',
    'अनुवाद करें',
    'नहीं, धन्यवाद',
    'आपके ब्राउज़र द्वारा आपके डिवाइस पर मशीनी अनुवाद। किसी व्यक्ति ने इसकी जाँच नहीं की है।',
  ],
  hr: [
    'Pročitati ovu stranicu na hrvatskom?',
    'Prevedi',
    'Ne, hvala',
    'Strojni prijevod vašeg preglednika, na vašem uređaju. Nije ga provjerila osoba.',
  ],
  hu: [
    'Elolvassa ezt az oldalt magyarul?',
    'Fordítás',
    'Nem, köszönöm',
    'Gépi fordítás a böngészőjétől, az Ön eszközén. Ember nem ellenőrizte.',
  ],
  id: [
    'Baca halaman ini dalam bahasa Indonesia?',
    'Terjemahkan',
    'Tidak, terima kasih',
    'Terjemahan mesin oleh browser Anda, di perangkat Anda. Belum diperiksa oleh manusia.',
  ],
  it: [
    'Leggere questa pagina in italiano?',
    'Traduci',
    'No, grazie',
    'Traduzione automatica del tuo browser, sul tuo dispositivo. Non rivista da una persona.',
  ],
  ja: [
    'このページを日本語で読みますか？',
    '翻訳する',
    'いいえ',
    'ブラウザがお使いの端末上で機械翻訳します。人による確認はしていません。',
  ],
  kn: [
    'ಈ ಪುಟವನ್ನು ಕನ್ನಡದಲ್ಲಿ ಓದುವುದೇ?',
    'ಅನುವಾದಿಸಿ',
    'ಬೇಡ, ಧನ್ಯವಾದಗಳು',
    'ನಿಮ್ಮ ಬ್ರೌಸರ್ ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಮಾಡುವ ಯಂತ್ರ ಅನುವಾದ. ಯಾರೂ ಇದನ್ನು ಪರಿಶೀಲಿಸಿಲ್ಲ.',
  ],
  ko: [
    '이 페이지를 한국어로 읽으시겠어요?',
    '번역하기',
    '괜찮아요',
    '브라우저가 기기에서 직접 하는 기계 번역입니다. 사람이 검토하지 않았습니다.',
  ],
  lt: [
    'Skaityti šį puslapį lietuviškai?',
    'Versti',
    'Ne, ačiū',
    'Mašininis vertimas jūsų naršyklėje, jūsų įrenginyje. Žmogus jo netikrino.',
  ],
  mr: [
    'हे पान मराठीत वाचायचे?',
    'भाषांतर करा',
    'नको, धन्यवाद',
    'तुमच्या ब्राउझरने तुमच्या डिव्हाइसवर केलेले यांत्रिक भाषांतर. कोणीही ते तपासलेले नाही.',
  ],
  nl: [
    'Deze pagina in het Nederlands lezen?',
    'Vertalen',
    'Nee, bedankt',
    'Machinevertaling door je browser, op je apparaat. Niet door een mens nagekeken.',
  ],
  no: [
    'Vil du lese siden på norsk?',
    'Oversett',
    'Nei takk',
    'Maskinoversettelse fra nettleseren din, på enheten din. Ikke gjennomgått av et menneske.',
  ],
  pl: [
    'Przeczytać tę stronę po polsku?',
    'Przetłumacz',
    'Nie, dziękuję',
    'Tłumaczenie maszynowe wykonane przez przeglądarkę na Twoim urządzeniu. Nikt go nie sprawdzał.',
  ],
  pt: [
    'Ler esta página em português?',
    'Traduzir',
    'Agora não',
    'Tradução automática do seu navegador, no seu dispositivo. Não foi revista por uma pessoa.',
  ],
  ro: [
    'Citiți această pagină în română?',
    'Traduceți',
    'Nu, mulțumesc',
    'Traducere automată făcută de browserul dvs., pe dispozitivul dvs. Nu a fost verificată de un om.',
  ],
  ru: [
    'Прочитать эту страницу на русском?',
    'Перевести',
    'Нет, спасибо',
    'Машинный перевод от вашего браузера, прямо на устройстве. Человек его не проверял.',
  ],
  sk: [
    'Prečítať túto stránku v slovenčine?',
    'Preložiť',
    'Nie, ďakujem',
    'Strojový preklad vášho prehliadača priamo vo vašom zariadení. Nikto ho nekontroloval.',
  ],
  sl: [
    'Želite to stran prebrati v slovenščini?',
    'Prevedi',
    'Ne, hvala',
    'Strojni prevod vašega brskalnika, na vaši napravi. Človek ga ni pregledal.',
  ],
  sv: [
    'Vill du läsa sidan på svenska?',
    'Översätt',
    'Nej tack',
    'Maskinöversättning från din webbläsare, på din enhet. Inte granskad av en människa.',
  ],
  ta: [
    'இந்தப் பக்கத்தைத் தமிழில் படிக்கவா?',
    'மொழிபெயர்',
    'வேண்டாம், நன்றி',
    'உங்கள் உலாவி உங்கள் சாதனத்திலேயே செய்யும் இயந்திர மொழிபெயர்ப்பு. யாரும் இதைச் சரிபார்க்கவில்லை.',
  ],
  te: ['ఈ పేజీని తెలుగులో చదవాలా?', 'అనువదించు', 'వద్దు, ధన్యవాదాలు', 'మీ బ్రౌజర్ మీ పరికరంలోనే చేసే యంత్ర అనువాదం. దీన్ని ఎవరూ తనిఖీ చేయలేదు.'],
  th: ['อ่านหน้านี้เป็นภาษาไทยไหม', 'แปล', 'ไม่ ขอบคุณ', 'แปลด้วยเครื่องโดยเบราว์เซอร์บนอุปกรณ์ของคุณ ยังไม่มีคนตรวจทาน'],
  tr: [
    'Bu sayfayı Türkçe okumak ister misiniz?',
    'Çevir',
    'Hayır, teşekkürler',
    'Tarayıcınızın cihazınızda yaptığı makine çevirisi. Bir insan tarafından kontrol edilmedi.',
  ],
  uk: [
    'Прочитати цю сторінку українською?',
    'Перекласти',
    'Ні, дякую',
    'Машинний переклад від вашого браузера, просто на пристрої. Людина його не перевіряла.',
  ],
  vi: [
    'Đọc trang này bằng tiếng Việt?',
    'Dịch',
    'Không, cảm ơn',
    'Bản dịch máy do trình duyệt thực hiện trên thiết bị của bạn. Chưa được người kiểm tra.',
  ],
  zh: ['用中文阅读此页面？', '翻译', '不用了，谢谢', '由你的浏览器在设备上进行机器翻译，未经人工审校。'],
  'zh-Hant': ['用中文閱讀此頁面？', '翻譯', '不用了，謝謝', '由你的瀏覽器在裝置上進行機器翻譯，未經人工審校。'],
};

/** @typedef {{ done: string, about: string, aboutText: string, original: string, language: string, failed: string }} Strings */
// Banner text, machine-translated once the language pack is ready.
/** @type {Strings} */
const UI = {
  done: 'Machine translation by your browser, on your device. Not reviewed by a person.',
  about: 'About this translation',
  aboutText:
    'Your browser translated this page on your device, using its built-in translation model. No person has reviewed it, so some wording may be wrong or read oddly. Names and technical terms stay in English. The English original is the version to rely on.',
  original: 'Show original',
  language: 'Language',
  failed: "Translation isn't available in this browser right now.",
};

const INLINE = new Set(
  'a abbr b bdi bdo cite data dfn em i mark q s small span strong sub sup time u var button label'.split(' '),
);
const SKIP =
  'script,style,noscript,template,code,pre,kbd,samp,svg,math,textarea,input,select,option,canvas,iframe,video,audio,[translate="no"],[contenteditable],.c-cursor';
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
const LETTER = /\p{L}/u;
const TOKEN = /\{(\/?)(\d+)\}/g;
const STORE = 'craga-tr-';
// Never translated, wherever they appear: the name, email addresses, domains and file names.
const KEEP =
  /Craig Michael Thompson|Craig Thompson|[\w.+-]+@[\w-]+\.[\w.]*[a-z]|\b(?:[\w-]+\.)+(?:dev|com|io|org|net)(?:\/[\w./-]*)?|(?:\.\/)?\b[\w/-]+\.(?:md|log|txt|json|pdf|sh|vcf)\b/g;

// The visitor's choices and the translation cache. Storage can be unavailable (private
// browsing, blocked cookies); then nothing is remembered, and everything still works.
const ls = {
  /** @param {string} k */
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  /** @param {string} k @param {string} v */
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Not remembered this time.
    }
  },
};

/**
 * A language's own name for itself ("Deutsch"), or in another language.
 * @param {string} code
 * @param {string} [inLang]
 */
export function langName(code, inLang) {
  try {
    const n = new Intl.DisplayNames([inLang || code], { type: 'language' }).of(code);
    return n ? n.charAt(0).toLocaleUpperCase(code) + n.slice(1) : code;
  } catch {
    return code; // a code Intl doesn't know
  }
}

// The visitor's preferred language, if it's one we can translate to and it comes before English.
/** @param {readonly string[] | undefined} list the browser's languages, most preferred first */
export function preferred(list) {
  for (const raw of list || []) {
    const l = String(raw).toLowerCase();
    if (/^en(-|$)/.test(l)) return null;
    const n = normalise(l);
    if (n) return n;
  }
  return null;
}
/** Old and regional codes for the same languages. @type {Record<string, string>} */
const ALIASES = { nb: 'no', nn: 'no', iw: 'he', in: 'id' };
/**
 * A browser language tag as one of LANGS, or null.
 * @param {unknown} tag
 */
export function normalise(tag) {
  const l = String(tag || '').toLowerCase();
  if (/^zh-(tw|hk|mo)|^zh-hant/.test(l)) return 'zh-Hant';
  const base = l.split('-')[0];
  const b = ALIASES[base] || base;
  return LANGS.includes(b) ? b : null;
}

// ---------- units: what gets translated as one piece ----------

/** @param {Element} el */
const blocked = (el) => !!el.closest(SKIP);
/** @param {Element} el */
const hasText = (el) => Array.from(el.childNodes).some((c) => c instanceof Text && LETTER.test(c.data));

// The element whose text is translated together with this one's: the nearest block, unless that
// block has no text of its own (a row of chips), in which case the outermost inline element.
/** @param {Element} el */
function unitFor(el) {
  let u = el;
  while (INLINE.has(u.localName) && u.parentElement) {
    const p = u.parentElement;
    if (INLINE.has(p.localName) || hasText(p)) u = p;
    else break;
  }
  return u;
}

/**
 * The elements under root whose text is translated as one piece each.
 * @param {Element} root
 */
export function unitsIn(root) {
  /** @type {Element[]} */
  const out = [];
  const seen = new Set();
  const doc = root.ownerDocument || document;
  const tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = /** @type {Text | null} */ (tw.nextNode()); n; n = /** @type {Text | null} */ (tw.nextNode())) {
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

/** An inline element translated as a whole (a token), not as text inside a pair of tokens. @param {Element} c */
const atomic = (c) => !INLINE.has(c.localName) || c.matches(SKIP) || !LETTER.test(c.textContent || '');
// Braces in the page's own text would read as tokens, so they're swapped out while translating.
/** @param {string} t */
const hideBraces = (t) => t.replace(/\{/g, '').replace(/\}/g, '');
/** @param {string} t */
const showBraces = (t) => t.replace(//g, '{').replace(//g, '}');

/**
 * A unit encoded for the translator.
 * @typedef {object} Meta
 * @property {string} key the text with numbered tokens: {i} for an atomic node, {i}…{/i} around a pair's text
 * @property {Node[]} nodes the node each token number stands for
 * @property {number[]} parent each token's enclosing pair (-1 at the top level)
 * @property {boolean[]} paired whether each token has a closing {/i}
 * @property {string} lead whitespace before the text, kept outside the translation
 * @property {string} trail whitespace after it
 * @property {boolean} translatable whether there's any text besides the tokens
 */

/**
 * A unit as a string with numbered tokens for its inline elements.
 * @param {Element} unit
 * @returns {Meta}
 */
export function encode(unit) {
  const doc = unit.ownerDocument || document;
  /** @type {Node[]} */
  const nodes = [];
  /** @type {number[]} */
  const parent = [];
  /** @type {boolean[]} */
  const paired = [];
  // Protected text becomes a token too, standing for a text node of its own.
  /** @param {string} t @param {number} pi */
  const protect = (t, pi) =>
    hideBraces(t).replace(KEEP, (m) => {
      const i = nodes.length;
      nodes.push(doc.createTextNode(m));
      parent.push(pi);
      paired.push(false);
      return '{' + i + '}';
    });
  /** @param {Element} el @param {number} pi @returns {string} */
  const walk = (el, pi) => {
    let s = '';
    for (const c of el.childNodes) {
      if (c instanceof Text) {
        s += protect(c.data, pi);
        continue;
      }
      if (!(c instanceof Element)) continue;
      const i = nodes.length;
      nodes.push(c);
      parent.push(pi);
      if (atomic(c)) {
        paired.push(false);
        s += '{' + i + '}';
      } else {
        paired.push(true);
        s += '{' + i + '}' + walk(c, i) + '{/' + i + '}';
      }
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
/** @param {unknown} t */
const tidy = (t) => String(t).replace(/[{｛]\s*(\/?)\s*(\d+)\s*[}｝]/g, '{$1$2}');

/**
 * Do the tokens in a translation still describe the same markup?
 * @param {string} out
 * @param {Pick<Meta, 'nodes' | 'parent' | 'paired'>} meta
 */
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

/**
 * Put a translation into a unit, reusing its original inline elements.
 * @param {Element} unit
 * @param {string} out a translation that fits(meta)
 * @param {Meta} meta
 * @param {((el: Node) => void) | null} [stash] called with each element before it's emptied
 */
export function rebuild(unit, out, meta, stash) {
  const doc = unit.ownerDocument || document;
  /** @param {Node} el */
  const clear = (el) => {
    if (stash) stash(el);
    while (el.firstChild) el.removeChild(el.firstChild);
  };
  clear(unit);
  /** @type {Node[]} */
  const stack = [unit];
  /** @param {string} t */
  const text = (t) => {
    if (t) stack[stack.length - 1].appendChild(doc.createTextNode(showBraces(t)));
  };
  let last = 0;
  let m;
  const s = meta.lead + out + meta.trail;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(s))) {
    text(s.slice(last, m.index));
    last = TOKEN.lastIndex;
    const i = +m[2];
    if (m[1]) {
      stack.pop();
      continue;
    }
    const el = meta.nodes[i];
    if (meta.paired[i]) clear(el);
    stack[stack.length - 1].appendChild(el);
    if (meta.paired[i]) stack.push(el);
  }
  text(s.slice(last));
}

// ---------- the translator ----------

/** An element whose original content is kept for "Show original" on a static page. @typedef {Element & { __trOrig?: Node[], __trAttr?: Record<string, string> }} Stashed */

const state = {
  lang: 'en',
  /** @type {TranslatorInstance | null} */
  translator: null,
  /** Translations by key. @type {Map<string, string>} */
  cache: new Map(),
  /** Keys waiting to be translated, nearest the viewport first. @type {string[]} */
  queue: [],
  /** @type {Set<string>} */
  queued: new Set(),
  done: 0,
  total: 0,
  running: false,
  /** @type {CragaApp | null} */
  app: null,
  active: false,
  /** @type {HTMLElement | null} */
  ui: null,
  /** The banner's text in the page's language, once translated. @type {Strings | null} */
  strings: null,
  /** @type {HTMLElement | null} */
  offerEl: null,
  /** @type {Stashed[]} */
  stashes: [],
  /** Text nodes whose arrows were swapped, with their original text. @type {[Text, string][]} */
  texts: [],
  /** @type {WeakSet<Text>} */
  swapped: new WeakSet(),
  /** @type {string | null} */
  title: null,
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  saveT: undefined,
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  flushT: undefined,
  /** The encoded unit behind each key (null for an attribute). @type {Map<string, Meta | null>} */
  metas: new Map(),
  /** The original text of each attribute key. @type {Map<string, string>} */
  attrSrc: new Map(),
};

/** @param {string} lang @returns {Map<string, string>} */
function loadCache(lang) {
  try {
    return new Map(Object.entries(JSON.parse(ls.get(STORE + lang) || '{}')));
  } catch {
    return new Map(); // a damaged cache is just started again
  }
}
function saveCache() {
  clearTimeout(state.saveT);
  state.saveT = setTimeout(() => {
    /** @type {Record<string, string>} */
    const o = {};
    let size = 0;
    for (const [k, v] of state.cache) {
      size += k.length + v.length;
      if (size > 1.5e6) break;
      o[k] = v;
    }
    ls.set(STORE + state.lang, JSON.stringify(o));
  }, 1500);
}

/** @param {string} key */
function enqueue(key) {
  if (!key || state.cache.has(key) || state.queued.has(key)) return;
  state.queued.add(key);
  state.queue.push(key);
  state.total++;
  pump();
}

/** @param {string} key */
async function translateKey(key) {
  const tr = state.translator;
  if (!tr) return null;
  const src = state.attrSrc.get(key);
  if (src != null) return tidy(await tr.translate(src));
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
      const key = /** @type {string} */ (state.queue.shift());
      /** @type {string | null} */
      let out = null;
      try {
        out = await translateKey(key);
      } catch (e) {
        console.warn('translation failed, left in English:', key.slice(0, 60), e);
      }
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
  if (state.lang === lang && !state.queue.length) {
    clearTimeout(state.flushT);
    state.flushT = undefined;
    flush();
    saveCache();
    progress();
  }
}

function flushSoon() {
  if (state.flushT) return;
  state.flushT = setTimeout(() => {
    state.flushT = undefined;
    flush();
  }, 250);
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
  if (out != null && fits(out, meta)) {
    rebuild(span, out, meta);
    document.title = span.textContent || state.title;
  } else enqueue(meta.key);
}

// Translate everything under root from the cache; anything not there yet is queued and marked
// as English for now (so screen readers pronounce it right).
const translatedUnits = new WeakSet();
/**
 * @param {Element} root
 * @param {boolean} live true for a static page (changes are stashed for "Show original"); false for a render
 */
export function apply(root, live) {
  for (const u of unitsIn(root)) {
    if (live && translatedUnits.has(u)) continue;
    const meta = encode(u);
    if (!meta.translatable) continue;
    if (!state.metas.has(meta.key)) state.metas.set(meta.key, meta);
    const out = state.cache.get(meta.key);
    if (out == null) {
      enqueue(meta.key);
      u.setAttribute('lang', 'en');
      continue;
    }
    // A cached translation whose tokens don't fit this markup (it changed) is redone.
    if (!fits(out, meta)) {
      state.cache.delete(meta.key);
      enqueue(meta.key);
      u.setAttribute('lang', 'en');
      continue;
    }
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
      if (t) {
        if (live) stashAttr(el, a, v);
        el.setAttribute(a, t);
      } else queueAttr(key, v);
    }
  });
  if (RTL.has(state.lang)) swapArrows(root, live);
}
/** @param {string} key @param {string} v */
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
/** @param {Element} root @param {boolean} live */
function swapArrows(root, live) {
  const doc = root.ownerDocument || document;
  const tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = /** @type {Text | null} */ (tw.nextNode()); n; n = /** @type {Text | null} */ (tw.nextNode())) {
    if (!/[→←]/.test(n.data) || (live && state.swapped.has(n))) continue;
    if (n.parentElement && n.parentElement.closest(NO_SWAP)) continue;
    if (live) {
      state.texts.push([n, n.data]);
      state.swapped.add(n);
    }
    n.data = n.data.replace(/[→←]/g, (c) => (c === '→' ? '←' : '→'));
  }
}

// Static pages: remember what was there so "Show original" can put it back.
/** @param {Node} node */
function stash(node) {
  const el = /** @type {Stashed} */ (node);
  if (el && !el.__trOrig) {
    el.__trOrig = Array.from(el.childNodes);
    state.stashes.push(el);
  }
}
/** @param {Stashed} el @param {string} a @param {string} v */
function stashAttr(el, a, v) {
  el.__trAttr = el.__trAttr || {};
  if (!(a in el.__trAttr)) {
    el.__trAttr[a] = v;
    state.stashes.push(el);
  }
}
function restoreStatic() {
  for (const [n, d] of state.texts) n.data = d;
  state.texts = [];
  for (let i = state.stashes.length - 1; i >= 0; i--) {
    const el = state.stashes[i];
    if (el.__trOrig) {
      el.replaceChildren(...el.__trOrig);
      delete el.__trOrig;
    }
    if (el.__trAttr) {
      for (const [a, v] of Object.entries(el.__trAttr)) el.setAttribute(a, v);
      delete el.__trAttr;
    }
    if (el.getAttribute('lang') === 'en') el.removeAttribute('lang');
  }
  document.querySelectorAll('[lang="en"]').forEach((el) => {
    if (el !== document.documentElement) el.removeAttribute('lang');
  });
  state.stashes = [];
}

/**
 * @param {string} source
 * @param {string} target
 * @param {(loaded: number) => void} [onProgress] the language pack's download, 0 to 1
 */
async function makeTranslator(source, target, onProgress) {
  return self.Translator.create({
    sourceLanguage: source,
    targetLanguage: target,
    monitor(m) {
      if (onProgress)
        m.addEventListener('downloadprogress', (e) => onProgress(/** @type {ProgressEvent} */ (e).loaded));
    },
  });
}

// ---------- page language ----------

/** @param {string} lang */
function setDocLang(lang) {
  const h = document.documentElement;
  if (lang === 'en') {
    h.setAttribute('lang', h.dataset.lang0 || 'en-GB');
    h.removeAttribute('dir');
    return;
  }
  if (!h.dataset.lang0) h.dataset.lang0 = h.getAttribute('lang') || 'en-GB';
  h.setAttribute('lang', lang);
  if (RTL.has(lang)) h.setAttribute('dir', 'rtl');
  else h.removeAttribute('dir');
}

function announce() {
  window.CRAGA_LANG = state.active ? state.lang : 'en';
  window.dispatchEvent(new CustomEvent('craga:lang', { detail: { lang: window.CRAGA_LANG } }));
}

/**
 * Translate the page into a language (downloading its pack if need be).
 * @param {string} code
 * @param {{ silent?: boolean }} [opts] silent: no banner if it can't (a returning visitor)
 * @returns {Promise<boolean | void>} whether it started
 */
export async function start(code, opts = {}) {
  const lang = normalise(code) || code;
  if (!LANGS.includes(lang)) return stop();
  if (state.active && state.lang === lang) return;
  if (state.active) await stop({ keep: true });
  removeOffer();
  ui('downloading', lang, 0);
  let translator;
  try {
    // Progress events can still arrive after the pack is ready; by then the bar shows the translation.
    translator = await makeTranslator('en', lang, (p) => {
      if (!state.active) ui('downloading', lang, p);
    });
  } catch (e) {
    if (opts.silent) {
      removeUi();
      return false;
    }
    ui('failed', lang);
    return false;
  }
  Object.assign(state, {
    lang,
    translator,
    cache: loadCache(lang),
    metas: new Map(),
    attrSrc: new Map(),
    queue: [],
    queued: new Set(),
    done: 0,
    total: 0,
    active: true,
    swapped: new WeakSet(),
    title: null,
  });
  ls.set('craga-lang', lang);
  setDocLang(lang);
  try {
    const s = /** @type {Strings} */ ({ ...UI });
    for (const k of /** @type {(keyof Strings)[]} */ (Object.keys(UI))) s[k] = tidy(await translator.translate(UI[k]));
    state.strings = s;
  } catch {
    state.strings = null; // the banner stays in English
  }
  const app = window.CRAGA_APP;
  if (app && typeof app.schedule === 'function') {
    state.app = app;
    // Queue what's on screen first, from the English page, then translate every render.
    app.transform = null;
    app.render();
    const near = unitsIn(app.root)
      .map((u) => {
        const r = u.getBoundingClientRect();
        return { u, d: r.bottom < 0 ? -r.bottom + 2000 : Math.max(0, r.top - innerHeight) };
      })
      .sort((a, b) => a.d - b.d);
    for (const { u } of near) {
      const meta = encode(u);
      if (meta.translatable) {
        state.metas.set(meta.key, meta);
        enqueue(meta.key);
      }
    }
    app.transform = (holder) => {
      apply(holder, false);
    };
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

/** @param {{ keep?: boolean }} [opts] keep: switching to another language, so leave the page language and banner */
export async function stop(opts = {}) {
  const was = state.active;
  state.active = false;
  state.queue = [];
  state.queued = new Set();
  try {
    state.translator?.destroy?.();
  } catch (e) {
    console.warn(e);
  }
  state.translator = null;
  if (state.app) {
    state.app.transform = null;
    state.app.render();
  } else if (was) restoreStatic();
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

/** @param {string} lang "en" for the original */
export function setLanguage(lang) {
  return lang === 'en' || !lang ? stop() : start(lang);
}

// ---------- ask.sh ----------

/** @type {Map<string, Promise<TranslatorInstance>>} */
const pairs = new Map();
/** @param {string} from @param {string} to */
async function pair(from, to) {
  const k = from + '>' + to;
  let p = pairs.get(k);
  if (!p) {
    p = makeTranslator(from, to).catch((e) => {
      pairs.delete(k);
      throw e;
    });
    pairs.set(k, p);
  }
  return p;
}
/** @type {Promise<LanguageDetectorInstance> | null} */
let detector = null;

// A question typed in another language, in English for ask.sh, and the language it was in.
/** @param {string} text @returns {Promise<{ text: string, lang?: string }>} */
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
/** @param {string} text @param {string} lang */
export async function fromEnglish(text, lang) {
  const tr = await pair('en', lang);
  const lines = String(text).split('\n');
  const out = [];
  for (const l of lines) {
    const m = /** @type {RegExpMatchArray} */ (l.match(/^(\s*[-•*]\s+)?(.*)$/));
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
@supports (appearance: base-select){.tr-sel,.tr-sel::picker(select){appearance:base-select}.tr-sel{display:inline-flex;align-items:center;gap:6px}.tr-sel::picker(select){box-sizing:border-box;max-block-size:min(60vh,26em);overflow:auto;margin-block:6px;padding:4px;border:1px solid var(--tr-line);border-radius:10px;background:var(--tr-bg);color:var(--tr-fg);box-shadow:0 18px 44px -18px rgba(0,0,0,.55)}.tr-sel option{min-block-size:32px;padding:4px 10px;border-radius:6px;background:transparent;color:var(--tr-fg2);font-size:13px}.tr-sel option:hover,.tr-sel option:focus-visible{background:var(--tr-bg2);color:var(--tr-fg);outline:none}.tr-sel option:checked{font-weight:600;color:var(--tr-fg)}.tr-sel option::checkmark{color:var(--tr-acc)}}
.tr-info{display:inline-grid;place-items:center;inline-size:20px;block-size:20px;margin-inline-start:8px;padding:0;border:1px solid var(--tr-line);border-radius:50%;background:transparent;color:inherit;font:italic 700 12px/1 Georgia,serif;cursor:pointer;vertical-align:-4px;position:relative;anchor-name:--tr-info}
.tr-info::after{content:'';position:absolute;inset:-12px}
.tr-info:focus-visible{outline:2px solid var(--tr-acc);outline-offset:2px}
.tr-about{max-inline-size:min(380px,calc(100vw - 32px));box-sizing:border-box;margin:auto;padding:12px 14px;border:1px solid var(--tr-acc);border-radius:10px;background:var(--tr-bg);color:var(--tr-fg);box-shadow:0 16px 40px -16px rgba(0,0,0,.45);font-size:13.5px;line-height:1.5}
@supports (anchor-name:--a){.tr-about{position-anchor:--tr-info;inset:auto;top:anchor(bottom);inset-inline-start:anchor(start);margin:8px 0 0;position-try-fallbacks:flip-inline}}
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
/**
 * A small element builder: attributes, `text`, and on* listeners.
 * @param {string} tag
 * @param {Record<string, string | ((e: any) => void)>} [attrs]
 * @param {(Node | null | undefined)[]} [kids]
 */
const el = (tag, attrs = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.appendChild(c);
  return e;
};

/** @param {string} current */
function languageSelect(current) {
  const s = el('select', {
    class: 'tr-sel',
    translate: 'no',
    'aria-label': (state.strings && state.strings.language) || UI.language,
    onchange: (/** @type {Event} */ e) => setLanguage(/** @type {HTMLSelectElement} */ (e.target).value),
  });
  for (const [c, n] of [['en', 'English'], ...LANGS.map((c) => [c, langName(c)])]) {
    const o = /** @type {HTMLOptionElement} */ (el('option', { value: c, lang: c, text: n }));
    if (c === current) o.selected = true;
    s.appendChild(o);
  }
  return s;
}

/** @param {string} lang */
export function offer(lang) {
  if (!OFFER[lang] || state.offerEl) return;
  css();
  const [q, yes, no, note] = OFFER[lang];
  window.CRAGA_I18N_OFFER = 'shown';
  const id = 'tr-q';
  const box = el(
    'div',
    {
      class: 'tr-offer',
      role: 'region',
      'aria-labelledby': id,
      lang,
      dir: RTL.has(lang) ? 'rtl' : 'ltr',
      translate: 'no',
    },
    [
      el('p', { id, text: q }),
      el('small', { text: note }),
      el('div', { class: 'tr-row' }, [
        el('button', {
          type: 'button',
          class: 'tr-btn tr-go',
          text: yes,
          onclick: () => {
            window.CRAGA_I18N_OFFER = 'accepted';
            start(lang);
          },
        }),
        el('button', {
          type: 'button',
          class: 'tr-btn',
          text: no,
          onclick: () => {
            window.CRAGA_I18N_OFFER = 'dismissed';
            ls.set('craga-lang-no', lang);
            removeOffer();
          },
        }),
      ]),
    ],
  );
  box.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape') {
      window.CRAGA_I18N_OFFER = 'dismissed';
      removeOffer();
    }
  });
  state.offerEl = box;
  document.body.insertBefore(box, document.body.firstChild);
}
function removeOffer() {
  if (state.offerEl) {
    state.offerEl.remove();
    state.offerEl = null;
  }
}

/**
 * The translation bar at the top of the page.
 * @param {'downloading' | 'translating' | 'done' | 'failed'} kind
 * @param {string} lang
 * @param {number} [p] progress, 0 to 1
 */
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
  const msg = bar.querySelector('.tr-msg'),
    meter = /** @type {HTMLElement | null} */ (bar.querySelector('.tr-meter'));
  if (busy && bar.dataset.kind === 'busy' && msg && meter) {
    msg.textContent = langName(lang) + ' · ' + pct + '%';
    meter.style.setProperty('--p', pct + '%');
    return;
  }
  bar.dataset.kind = busy ? 'busy' : kind;
  const s = state.strings || UI;
  bar.setAttribute('lang', kind === 'done' ? lang : 'en');
  bar.replaceChildren();
  if (busy) {
    bar.append(
      el('span', { class: 'tr-msg', lang, text: langName(lang) + ' · ' + pct + '%' }),
      el('span', { class: 'tr-meter', 'aria-hidden': 'true', style: '--p:' + pct + '%' }, [el('i')]),
    );
  } else if (kind === 'failed') {
    bar.append(
      el('span', { class: 'tr-msg', role: 'status', lang: 'en', text: UI.failed }),
      el('button', { type: 'button', class: 'tr-btn', lang: 'en', text: 'OK', onclick: () => removeUi() }),
    );
  } else {
    // The note a person wrote for this language, else the model's own translation of it.
    const note = (OFFER[lang] && OFFER[lang][3]) || s.done;
    const sl = state.strings ? lang : 'en';
    const about = el('div', {
      id: 'tr-about',
      class: 'tr-about',
      popover: '',
      role: 'note',
      lang: sl,
      dir: RTL.has(sl) ? 'rtl' : 'ltr',
      text: s.aboutText,
    });
    const info = el('button', {
      type: 'button',
      class: 'tr-info',
      popovertarget: 'tr-about',
      lang: sl,
      'aria-label': s.about,
      title: s.about,
      text: 'i',
    });
    bar.append(
      el('span', { class: 'tr-msg' }, [el('span', { role: 'status', text: note }), info]),
      about,
      el('button', { type: 'button', class: 'tr-btn', text: s.original, onclick: () => stop() }),
      languageSelect(lang),
    );
  }
}
function removeUi() {
  if (state.ui) {
    state.ui.remove();
    state.ui = null;
  }
}
function progress() {
  if (!state.active) return;
  if (state.queue.length || state.running) ui('translating', state.lang, state.total ? state.done / state.total : 0);
  else ui('done', state.lang);
}

// ---------- boot ----------

// Called by the page once this module has loaded: start straight away for a returning visitor
// who chose a language before, otherwise offer it.
/** @param {{ lang: string, saved?: boolean }} opts the language to offer or start; saved: the visitor chose it before */
export async function boot({ lang, saved }) {
  if (!('Translator' in self)) return;
  if (saved) {
    try {
      if (
        (await self.Translator.availability({ sourceLanguage: 'en', targetLanguage: lang })) === 'available' &&
        (await start(lang, { silent: true }))
      )
        return;
    } catch (e) {
      console.warn('could not restore the saved language', e);
    }
  }
  offer(lang);
}

// For tests and debugging.
export function status() {
  return {
    lang: state.lang,
    active: state.active,
    queued: state.queue.length,
    running: state.running,
    done: state.done,
    total: state.total,
    cached: state.cache.size,
    next: state.queue.slice(0, 3),
  };
}
