// Copy buttons ([data-copy]): copy the value, mark the button done for a moment, and say so.
import { note } from './toast';

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  // Older browsers and plain http: a hidden textarea and execCommand.
  const t = document.createElement('textarea');
  t.value = text;
  t.setAttribute('readonly', '');
  t.className = 'c-sr';
  document.body.append(t);
  t.select();
  const ok = document.execCommand('copy');
  t.remove();
  if (!ok) throw new Error('copy failed');
}

/** Mark an element done (data-done) for a couple of seconds, e.g. to show a tick. */
export function flagDone(elm: HTMLElement, ms = 2000) {
  elm.dataset.done = '';
  clearTimeout(Number(elm.dataset.doneT));
  elm.dataset.doneT = String(setTimeout(() => delete elm.dataset.done, ms));
}

document.addEventListener('click', async (e) => {
  const b = (e.target as Element).closest<HTMLElement>('[data-copy]');
  if (!b) return;
  const value = b.dataset.copy ?? '';
  try {
    await copyText(value);
  } catch {
    // No clipboard: an email address still works as a link.
    if (value.includes('@')) location.href = 'mailto:' + value;
    return;
  }
  flagDone(b);
  const label = b.querySelector<HTMLElement>('[data-copy-label]');
  if (label) {
    const was = label.textContent;
    label.textContent = 'copied';
    setTimeout(() => (label.textContent = was), 2000);
  }
  note(b.dataset.copyNote ?? 'Copied');
});
