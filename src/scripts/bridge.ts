// The easter egg: ↑↑↓↓←→←→BA (or "bridge" in ask.sh) lights up the Tyne Bridge behind the intro.
import { goTo } from './anchors';
import { note } from './toast';

let t: ReturnType<typeof setTimeout> | undefined;

export function lightBridge() {
  const h = document.documentElement;
  clearTimeout(t);
  goTo('top');
  h.dataset.bridge = '';
  note('The Tyne Bridge, lit up · opened 1928', { show: true, ms: 9000 });
  t = setTimeout(() => delete h.dataset.bridge, 9000);
  console.log('%c🌉 ↑↑↓↓←→←→BA', 'font:600 14px ui-monospace,monospace;color:#86D4A9');
}

addEventListener('craga:bridge', lightBridge);
