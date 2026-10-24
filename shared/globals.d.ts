// Browser APIs the site uses that TypeScript's DOM library doesn't describe yet, and the globals
// the page sets for its own modules. Types only: nothing here is shipped.

/** Chrome's built-in Translator API. */
interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}
interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?(m: EventTarget): void;
}
interface TranslatorStatic {
  create(options: TranslatorCreateOptions): Promise<TranslatorInstance>;
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
}
/** Chrome's built-in Language Detector API. */
interface LanguageDetectorInstance {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
}
interface LanguageDetectorStatic {
  create(): Promise<LanguageDetectorInstance>;
}

interface Window {
  Translator: TranslatorStatic;
  LanguageDetector: LanguageDetectorStatic;
  /** The language the page is shown in ("en" unless translated). */
  CRAGA_LANG?: string;
  /** What the visitor did with the translation offer, for the visit beacon. */
  CRAGA_I18N_OFFER?: 'shown' | 'accepted' | 'dismissed';
  /** On-device translation, where the browser has it (src/scripts/i18n.ts). */
  CRAGA_I18N?: { langs: readonly string[]; load(): Promise<typeof import('../src/i18n.js')> };
}
declare let Translator: TranslatorStatic;
declare let LanguageDetector: LanguageDetectorStatic;

interface Document {
  /** True while the page is being prerendered ahead of a click (speculation rules). */
  readonly prerendering?: boolean;
}
