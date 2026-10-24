// A short note after an action: read out by screen readers, and shown briefly on screen when `show`.
import { $ } from './dom';

let noteT: ReturnType<typeof setTimeout> | undefined;
let toastT: ReturnType<typeof setTimeout> | undefined;

export function note(msg: string, opts: { show?: boolean; ms?: number } = {}) {
  const status = $('[data-status]');
  if (status) {
    status.textContent = msg;
    clearTimeout(noteT);
    noteT = setTimeout(() => (status.textContent = ''), 4000);
  }
  const toast = $('[data-toast]');
  if (opts.show && toast) {
    toast.textContent = msg;
    toast.dataset.show = '';
    clearTimeout(toastT);
    toastT = setTimeout(() => delete toast.dataset.show, opts.ms ?? 2600);
  }
}
