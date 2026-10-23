// Reading an answer aloud. A natural voice comes from the Worker (Deepgram Aura on Workers AI),
// played a little faster with the pitch kept; if that isn't available (or the answer isn't in
// English), the browser's own best voice for the language reads it instead.
import { note } from './toast';
import { ASK_ENDPOINT } from '../site';

const RATE = 1.15;
let audio: HTMLAudioElement | null = null;
let unlocked = false;
let token = 0;
let current: number | null = null;
const cache = new Map<string, string>();

/** Which answer is being read, if any. */
export const speaking = () => current;

/** One audio element, unlocked during the click so iOS Safari plays it once the audio arrives. */
function audioEl() {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.preservesPitch = true;
  }
  if (!unlocked) {
    unlocked = true;
    try {
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.play().then(
        () => audio!.pause(),
        () => {},
      );
    } catch {
      // Not allowed yet: it'll be tried again with the real audio.
    }
  }
  return audio;
}

export function stopSpeaking() {
  token++;
  if (audio) {
    audio.onended = audio.onerror = null;
    audio.pause();
  }
  speechSynthesis?.cancel();
  current = null;
}

/** File names and the email address, said the way a person would. */
const spoken = (t: string) =>
  t
    .replace(/\bREADME\.md\b/gi, 'the README')
    .replace(/\bfaq\.md\b/gi, 'the FAQ')
    .replace(/\bcareer\.log\b/gi, 'the career log')
    .replace(/\b([a-z][\w-]*)\.md\b/gi, (_, f: string) => `the ${f.replace(/-/g, ' ')} file`)
    .replace(/craga89@gmail\.com/gi, 'craga89 at gmail dot com');

/**
 * Read text aloud as answer `i`, or stop if it's the one being read. `update` re-renders the
 * listen/stop buttons.
 */
export function speak(i: number, text: string, lang: string, update: () => void) {
  if (current === i) {
    stopSpeaking();
    update();
    return;
  }
  stopSpeaking();
  const mine = token;
  current = i;
  update();
  const done = () => {
    if (token !== mine) return;
    current = null;
    update();
  };
  const browser = () => {
    if (token !== mine) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') throw new Error('no speech');
      const u = new SpeechSynthesisUtterance(lang ? text : spoken(text));
      const score = (v: SpeechSynthesisVoice) => (/^en-GB/i.test(v.lang) ? 4 : 0) + (/natural|neural|premium|enhanced|online/i.test(v.name) ? 6 : 0) + (/google|microsoft|siri/i.test(v.name) ? 2 : 0);
      const want = lang ? new RegExp(`^${lang.split('-')[0]}([-_]|$)`, 'i') : /^en([-_]|$)/i;
      const v = synth
        .getVoices()
        .filter((x) => want.test(x.lang))
        .sort((a, b) => score(b) - score(a))[0];
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = lang || 'en-GB';
      u.rate = 1.1;
      let started = false;
      u.onstart = () => (started = true);
      u.onend = u.onerror = done;
      synth.speak(u);
      // Some browsers have no voices and never start: give up quietly.
      setTimeout(() => {
        if (!started && token === mine) {
          synth.cancel();
          done();
          note("Reading aloud isn't available in this browser");
        }
      }, 3000);
    } catch {
      done();
      note("Reading aloud isn't available in this browser");
    }
  };
  const a = audioEl();
  const play = (src: string) => {
    if (token !== mine) return;
    if (!a) return browser();
    a.defaultPlaybackRate = RATE;
    a.src = src;
    a.playbackRate = RATE;
    a.onended = done;
    a.onerror = () => {
      a.onerror = null;
      browser();
    };
    a.play().catch(browser);
  };
  // The site's own voice is English, so other languages use the browser's.
  if (lang || !ASK_ENDPOINT || !a) return browser();
  const hit = cache.get(text);
  if (hit) return play(hit);
  // Over today's free AI allowance (503), or anything else failing: the browser's voice.
  fetch(ASK_ENDPOINT.replace(/\/ask$/, '/speak'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`speak ${r.status}`))))
    .then((b) => {
      const u = URL.createObjectURL(b);
      cache.set(text, u);
      play(u);
    })
    .catch(browser);
}
