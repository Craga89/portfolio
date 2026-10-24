// "Pause animations" (WCAG 2.2.2): one switch that stops every moving thing, saved for next time.
import { store } from './dom';
import { note } from './toast';

export const motionOff = () => document.documentElement.dataset.motion === 'off';

export function toggleMotion() {
  const h = document.documentElement;
  const off = !motionOff();
  if (off) h.dataset.motion = 'off';
  else delete h.dataset.motion;
  store.set('motion', off ? 'off' : 'on');
  note(off ? 'Animations paused' : 'Animations on');
  dispatchEvent(new CustomEvent('craga:motion', { detail: { off } }));
}

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-motion-toggle]')) toggleMotion();
});
