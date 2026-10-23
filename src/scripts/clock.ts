// The time in Newcastle, with its UTC offset ([data-clock]), kept up to date.
import { $$ } from './dom';

function now() {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
    const off = 'UTC' + (get('timeZoneName').replace(/^GMT/, '') || '+0');
    return { h: get('hour'), m: get('minute'), off, sr: `${get('hour')}:${get('minute')} ${off}` };
  } catch {
    return null;
  }
}

function tick() {
  const c = now();
  if (!c) return;
  for (const box of $$('[data-clock]')) {
    const put = (sel: string, v: string) => {
      const n = box.querySelector(sel);
      if (n && n.textContent !== v) n.textContent = v;
    };
    put('[data-clock-h]', c.h);
    put('[data-clock-m]', c.m);
    put('[data-clock-off]', `(${c.off})`);
    put('[data-clock-sr]', c.sr);
    box.hidden = false;
  }
}

if ($$('[data-clock]').length) {
  tick();
  setInterval(tick, 15000);
}
