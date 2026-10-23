// Glossary toggletips: every <Term> opens the one shared popover (#c-tip), filled in from the
// glossary embedded in the page. Placed by CSS anchor positioning where supported, else here.
import { $, $$ } from './dom';

type Glossary = Record<string, { title: string; text: string }>;

const pop = $('#c-tip');
const data = $('#c-glossary');

if (pop && data) {
  const glossary = JSON.parse(data.textContent || '{}') as Glossary;
  const anchored = CSS.supports('position-area: bottom') && CSS.supports('anchor-name: --a');
  let current: HTMLElement | null = null;

  const place = () => {
    if (anchored || !current) return;
    const r = current.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12));
    const top = r.bottom + 8 + h > innerHeight - 8 && r.top - 8 - h > 8 ? r.top - 8 - h : r.bottom + 8;
    pop.style.position = 'fixed';
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
  };

  // Fill it in before it opens (the button's own popovertarget opens it).
  document.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('.c-term');
      if (!btn) return;
      const g = glossary[btn.dataset.term ?? ''];
      if (!g) return;
      for (const b of $$('.c-term[aria-expanded="true"]')) b.setAttribute('aria-expanded', 'false');
      current = btn;
      btn.setAttribute('aria-expanded', 'true');
      $('.title', pop)!.textContent = g.title;
      $('.text', pop)!.textContent = g.text;
      requestAnimationFrame(place);
    },
    true,
  );

  pop.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'closed') {
      current?.setAttribute('aria-expanded', 'false');
      current = null;
    }
  });
  addEventListener('resize', place);
  addEventListener('scroll', place, { capture: true, passive: true });
}
