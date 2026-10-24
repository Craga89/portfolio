// Counting visits, without cookies or anything that identifies anyone: one small beacon as the
// visitor leaves (the page, the site they came from, the kind of device, the home page's
// sections they saw, time on the page). Skipped for Do Not Track and Global Privacy Control.
import { WORKER_ORIGIN } from '../site';

(function hit() {
  // A page loaded ahead of a click (speculation rules) only counts once it's shown.
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', hit, { once: true });
    return;
  }
  if (
    !WORKER_ORIGIN ||
    (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl ||
    navigator.doNotTrack === '1' ||
    !navigator.sendBeacon
  )
    return;
  const t0 = Date.now();
  const seen = new Set<string>();
  const sections = document.querySelectorAll('main > section[id]');
  if (sections.length) {
    seen.add('top');
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && seen.add(e.target.id)), {
      threshold: 0.2,
    });
    sections.forEach((s) => io.observe(s));
  }
  let sent = false;
  const send = () => {
    if (sent) return;
    sent = true;
    const w = innerWidth;
    const body = {
      path: location.pathname,
      ref: document.referrer,
      device: w < 601 ? 'mobile' : w < 1025 ? 'tablet' : 'desktop',
      sections: [...seen],
      seconds: (Date.now() - t0) / 1000,
      lang: window.CRAGA_LANG && window.CRAGA_LANG !== 'en' ? window.CRAGA_LANG : null,
      offer: window.CRAGA_I18N_OFFER || null,
    };
    navigator.sendBeacon(WORKER_ORIGIN + '/hit', new Blob([JSON.stringify(body)], { type: 'text/plain' }));
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && send());
  addEventListener('pagehide', send);
})();
