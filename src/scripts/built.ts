// The build it came from, in the sidebar: "main@abc1234 · 2 days ago". CI fills in the commit and
// time at deploy; locally they stay as placeholders and this leaves them alone.
import { $ } from './dom';

const a = $<HTMLAnchorElement>('[data-built]');
const at = a?.dataset.built;
const ago = a && $('[data-built-ago]', a);
if (ago && at && /^\d{4}-/.test(at)) {
  const mins = (Date.now() - new Date(at).getTime()) / 60000;
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  ago.textContent =
    mins < 60 ? 'just now' : mins < 1440 ? rtf.format(-Math.round(mins / 60), 'hour') : mins < 20160 ? rtf.format(-Math.round(mins / 1440), 'day') : mins < 86400 ? rtf.format(-Math.round(mins / 10080), 'week') : rtf.format(-Math.round(mins / 43200), 'month');
}

// The share button, where the device has a share sheet.
const share = document.querySelectorAll<HTMLButtonElement>('[data-share]');
if (typeof navigator.share === 'function' && window.isSecureContext) {
  for (const b of share) {
    b.hidden = false;
    b.addEventListener('click', () => navigator.share({ title: document.title, text: 'Craig Michael Thompson · Head of Engineering', url: location.origin + location.pathname }).catch(() => {}));
  }
}
