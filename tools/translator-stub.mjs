// A stand-in for the browser's built-in Translator and LanguageDetector APIs, for tests: CI
// browsers have no on-device language models. Pass to page.addInitScript().
// Translations are the English text tagged «xx», so tests can see what was translated. Anything
// mentioning "monorepo" comes back with its markup tokens dropped, to exercise the fallback.
export function translatorStub() {
  const w = /** @type {Window & { __trCalls: number }} */ (/** @type {unknown} */ (window));
  w.__trCalls = 0;
  const avail = () => { try { return localStorage.getItem('stub-dl') ? 'available' : 'downloadable'; } catch { return 'downloadable'; } };
  self.Translator = /** @type {TranslatorStatic} */ ({
    availability: async () => avail(),
    create: async (o) => {
      if (o.monitor) {
        // Reports a download in two steps, as Chrome does while it fetches a language model.
        const monitor = { addEventListener: (/** @type {string} */ _type, /** @type {(e: { loaded: number }) => void} */ f) => { setTimeout(() => f({ loaded: 0.5 }), 5); setTimeout(() => f({ loaded: 1 }), 10); } };
        o.monitor(/** @type {EventTarget} */ (/** @type {unknown} */ (monitor)));
      }
      try { localStorage.setItem('stub-dl', '1'); } catch { /* storage blocked: the model just stays "downloadable" */ }
      return {
        translate: async (s) => {
          w.__trCalls++;
          if (o.targetLanguage === 'en') return 'EN:' + s;
          return /monorepo/i.test(s) && /\{\d/.test(s) ? '«' + o.targetLanguage + '» ' + s.replace(/\{\/?\d+\}/g, '') : '«' + o.targetLanguage + '» ' + s;
        },
        destroy() {},
      };
    },
  });
  self.LanguageDetector = /** @type {LanguageDetectorStatic} */ ({ create: async () => ({ detect: async (t) => [{ detectedLanguage: /\b(hat|der|die|und|Erfahrung)\b/.test(t) ? 'de' : 'en', confidence: 0.9 }] }) });
}
