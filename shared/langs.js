// The languages the site can be translated into on the device (src/i18n.js), shared with the
// build (the language menus) and the worker (which records the language a visit was read in).

/** Language codes, as the Translator API names them. */
export const LANGS = /** @type {readonly string[]} */ ([
  'ar',
  'bg',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'kn',
  'ko',
  'lt',
  'mr',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
  'zh-Hant',
]);

/** The ones written right to left. */
export const RTL = new Set(['ar', 'he']);
