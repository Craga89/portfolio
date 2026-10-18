// A stand-in for the browser's built-in Translator and LanguageDetector APIs, for tests: CI
// browsers have no on-device language models. Pass to page.addInitScript().
// Translations are the English text tagged «xx», so tests can see what was translated. Anything
// mentioning "monorepo" comes back with its markup tokens dropped, to exercise the fallback.
export function translatorStub() {
  window.__trCalls = 0;
  const avail = () => { try { return localStorage.getItem('stub-dl') ? 'available' : 'downloadable'; } catch (e) { return 'downloadable'; } };
  self.Translator = {
    availability: async () => avail(),
    create: async (o) => {
      if (o.monitor) o.monitor({ addEventListener: (n, f) => { setTimeout(() => f({ loaded: 0.5 }), 5); setTimeout(() => f({ loaded: 1 }), 10); } });
      try { localStorage.setItem('stub-dl', '1'); } catch (e) {}
      return {
        translate: async (s) => {
          window.__trCalls++;
          if (o.targetLanguage === 'en') return 'EN:' + s;
          return /monorepo/i.test(s) && /\{\d/.test(s) ? '«' + o.targetLanguage + '» ' + s.replace(/\{\/?\d+\}/g, '') : '«' + o.targetLanguage + '» ' + s;
        },
        destroy() {},
      };
    },
  };
  self.LanguageDetector = { create: async () => ({ detect: async (t) => [{ detectedLanguage: /\b(hat|der|die|und|Erfahrung)\b/.test(t) ? 'de' : 'en', confidence: 0.9 }] }) };
}
