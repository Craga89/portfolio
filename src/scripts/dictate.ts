// Dictating a question, with the browser's own speech recognition.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

const SR = (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

let rec: Recognition | null = null;
let broken = false;

export const canDictate = () => !!SR && !broken;

/**
 * Start dictating into `field` (or stop, if already listening). `onText` gets what was said, so
 * the answer can be read back to someone who spoke the question.
 */
export function dictate(field: HTMLInputElement, mic: HTMLButtonElement, onText: (v: string) => void) {
  if (rec) {
    rec.stop();
    return;
  }
  if (!SR) return;
  const base = field.value.trim();
  const placeholder = field.placeholder;
  const r = (rec = new SR());
  r.lang = /^en\b/i.test(navigator.language) ? navigator.language : 'en-GB';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    let said = '';
    for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
    let v = ((base ? base + ' ' : '') + said.trim()).replace(/\s+/g, ' ');
    v = v.charAt(0).toUpperCase() + v.slice(1);
    field.value = v;
    onText(v);
  };
  r.onerror = (e) => {
    const msg = e.error === 'not-allowed' ? 'Microphone access is blocked' : e.error === 'no-speech' ? "Didn't catch that. Try again?" : e.error === 'aborted' ? '' : "Voice input isn't available here";
    if (msg) field.placeholder = msg;
    if (['network', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
      broken = true;
      mic.hidden = true;
    }
  };
  r.onend = () => {
    rec = null;
    mic.setAttribute('aria-pressed', 'false');
    mic.setAttribute('aria-label', 'Dictate a question');
    if (field.placeholder === 'Listening…') field.placeholder = placeholder;
    if (matchMedia('(pointer: fine)').matches) field.focus();
  };
  mic.setAttribute('aria-pressed', 'true');
  mic.setAttribute('aria-label', 'Stop dictating');
  field.placeholder = 'Listening…';
  try {
    r.start();
  } catch {
    rec = null;
    mic.setAttribute('aria-pressed', 'false');
    field.placeholder = placeholder;
  }
}
